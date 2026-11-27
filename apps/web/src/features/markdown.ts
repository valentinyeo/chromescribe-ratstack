import type { Child, Html, HtmlBuilder } from "foldkit/html";

import { safeLink, timestampSeconds } from "../client/content.js";
import { Messages } from "../client/messages.js";
import { classes, styles } from "../styles.js";

const inline = (text: string, h: HtmlBuilder<Messages>, seekable: boolean): readonly Child[] => {
  const tokens = /\[(?:\d+:)?\d{1,2}:\d{2}\]|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*/gu;
  const children: Child[] = [];
  let position = 0;
  for (const match of text.matchAll(tokens)) {
    children.push(text.slice(position, match.index));
    const token = match[0];
    const seconds = timestampSeconds(token);
    if (seconds !== undefined && seekable) {
      children.push(h.button([h.Class(classes(styles.timestamp)), h.Type("button"), h.OnClick(Messages.RequestedSeek({ seconds })), h.Title(`Play from ${token}`)], [token]));
    } else if (token.startsWith("**")) {
      children.push(h.strong([], [token.slice(2, -2)]));
    } else if (token.startsWith("`")) {
      children.push(h.code([h.Class(classes(styles.code))], [token.slice(1, -1)]));
    } else if (token.startsWith("*")) {
      children.push(h.em([], [token.slice(1, -1)]));
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/u.exec(token);
      const href = link?.[2] ? safeLink(link[2]) : undefined;
      children.push(href ? h.a([h.Href(href), h.Target("_blank"), h.Rel("noopener noreferrer"), h.Class(classes(styles.link))], [link?.[1] ?? token]) : token);
    }
    position = match.index + token.length;
  }
  children.push(text.slice(position));
  return children;
};

export const markdownView = (markdown: string, h: HtmlBuilder<Messages>, seekable = false): readonly Html[] => {
  if (!markdown.trim()) { return [h.p([], ["No readable content is stored for this item."])]; }
  const blocks: Html[] = [];
  let paragraph: string[] = [];
  let code: string[] | undefined;
  let position = 0;
  const flush = () => {
    if (paragraph.length) {
      blocks.push(h.keyed("p")(`paragraph-${position}`, [h.Class(classes(styles.paragraph))], inline(paragraph.join("\n"), h, seekable)));
      paragraph = [];
    }
  };
  for (const line of markdown.split(/\r?\n/u)) {
    position += line.length + 1;
    if (/^\s*```/u.test(line)) {
      flush();
      if (code) {
        blocks.push(h.keyed("pre")(`code-${position}`, [h.Class(classes(styles.pre))], [h.code([], [code.join("\n")])]));
        code = undefined;
      } else { code = []; }
    } else if (code) { code.push(line); }
    else if (!line.trim()) { flush(); }
    else if (/^\s*---+\s*$/u.test(line)) { flush(); blocks.push(h.keyed("hr")(`rule-${position}`)); }
    else {
      const heading = /^(#{1,6})\s+(.+)$/u.exec(line);
      const bullet = /^\s*(?:[-*+] |\d+\. )(.+)$/u.exec(line);
      if (heading) {
        flush();
        const text = inline(heading[2] ?? "", h, seekable);
        blocks.push(h.keyed("h3")(`heading-${position}`, [h.Class(classes(styles.proseHeading))], text));
      } else if (bullet) {
        flush();
        blocks.push(h.keyed("ul")(`list-${position}`, [], [h.li([], inline(bullet[1] ?? "", h, seekable))]));
      } else { paragraph.push(line); }
    }
  }
  flush();
  if (code) { blocks.push(h.pre([h.Class(classes(styles.pre))], [code.join("\n")])); }
  return blocks;
};
