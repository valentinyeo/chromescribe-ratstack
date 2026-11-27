import type { Html, HtmlBuilder } from "foldkit/html";

import { safeLink, timestampSeconds } from "../client/content.js";
import { Messages } from "../client/messages.js";
import type { AppMessage } from "../client/messages.js";
import { classes, styles } from "../styles.js";

const inline = (
  text: string,
  h: HtmlBuilder<AppMessage>,
  seekable: boolean
): readonly (Html | string)[] => {
  const tokens =
    /\[(?:\d+:)?\d{1,2}:\d{2}\]|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*/gu;

  const children: (Html | string)[] = [];
  let position = 0;

  for (const match of text.matchAll(tokens)) {
    children.push(text.slice(position, match.index));
    const [token] = match;
    const seconds = timestampSeconds(token);

    if (seconds !== undefined && seekable) {
      children.push(
        h.button(
          [
            h.Class(classes(styles.timestamp)),
            h.Type("button"),
            h.OnClick(Messages.RequestedSeek({ seconds })),
            h.Title(`Play from ${token}`),
          ],
          [token]
        )
      );
    } else if (token.startsWith("**")) {
      children.push(h.strong([], [token.slice(2, -2)]));
    } else if (token.startsWith("`")) {
      children.push(
        h.code([h.Class(classes(styles.code))], [token.slice(1, -1)])
      );
    } else if (token.startsWith("*")) {
      children.push(h.em([], [token.slice(1, -1)]));
    } else {
      const link = /^\[(?<label>[^\]]+)\]\((?<href>[^)]+)\)$/u.exec(token);
      const href = safeLink(link?.groups?.href ?? "");
      children.push(
        href !== undefined
          ? h.a(
              [
                h.Href(href),
                h.Target("_blank"),
                h.Rel("noopener noreferrer"),
                h.Class(classes(styles.link)),
              ],
              [link?.groups?.label ?? token]
            )
          : token
      );
    }

    position = match.index + token.length;
  }

  children.push(text.slice(position));

  return children;
};

export const markdownView = (
  markdown: string,
  h: HtmlBuilder<AppMessage>,
  seekable = false
): readonly Html[] => {
  if (!markdown.trim()) {
    return [h.p([], ["No readable content is stored for this item."])];
  }

  const blocks: Html[] = [];
  let paragraph: string[] = [];
  let code: string[] | undefined;
  let position = 0;

  const flush = () => {
    if (paragraph.length) {
      blocks.push(
        h.keyed("p")(
          `paragraph-${position}`,
          [h.Class(classes(styles.paragraph))],
          inline(paragraph.join("\n"), h, seekable)
        )
      );
      paragraph = [];
    }
  };

  for (const line of markdown.split(/\r?\n/u)) {
    position += line.length + 1;

    if (/^\s*```/u.test(line)) {
      flush();

      if (code) {
        blocks.push(
          h.keyed("pre")(
            `code-${position}`,
            [h.Class(classes(styles.pre))],
            [h.code([], [code.join("\n")])]
          )
        );
        code = undefined;
      } else {
        code = [];
      }
    } else if (code) {
      code.push(line);
    } else if (!line.trim()) {
      flush();
    } else if (/^\s*---+\s*$/u.test(line)) {
      flush();
      blocks.push(h.keyed("hr")(`rule-${position}`));
    } else {
      const heading = /^(?<level>#{1,6})\s+(?<text>.+)$/u.exec(line);
      const bullet = /^\s*(?:[-*+] |\d+\. )(?<text>.+)$/u.exec(line);

      if (heading) {
        flush();
        const text = inline(heading.groups?.text ?? "", h, seekable);
        blocks.push(
          h.keyed("h3")(
            `heading-${position}`,
            [h.Class(classes(styles.proseHeading))],
            text
          )
        );
      } else if (bullet) {
        flush();
        blocks.push(
          h.keyed("ul")(
            `list-${position}`,
            [],
            [h.li([], inline(bullet.groups?.text ?? "", h, seekable))]
          )
        );
      } else {
        paragraph.push(line);
      }
    }
  }

  flush();

  if (code) {
    blocks.push(h.pre([h.Class(classes(styles.pre))], [code.join("\n")]));
  }

  return blocks;
};
