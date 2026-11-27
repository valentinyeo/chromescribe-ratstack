import type { HtmlBuilder } from "foldkit/html";

import { mediaFor, sourceHref, splitSections } from "../client/content.js";
import { Messages } from "../client/messages.js";
import type { AppMessage } from "../client/messages.js";
import { libraryHref, transcriptHref } from "../client/model.js";
import type { Model, TranscriptPage } from "../client/model.js";
import { classes, styles } from "../styles.js";
import { markdownView } from "./markdown.js";

export const transcriptView = (
  model: Model,
  page: TranscriptPage,
  h: HtmlBuilder<AppMessage>
) => {
  const { detail, markdown, around } = page;
  const media = mediaFor(detail.video_id);
  const sections = splitSections(markdown);

  return h.article(
    [h.Class(classes(media.kind === "article" && styles.reader))],
    [
      h.nav(
        [
          h.Class(classes(styles.nav)),
          h.Attribute("aria-label", "Transcript navigation"),
        ],
        [
          h.a(
            [h.Href(libraryHref()), h.Class(classes(styles.link))],
            ["← Back to Library"]
          ),
          h.div(
            [h.Class(classes(styles.toolbar))],
            [
              around.prev === null
                ? h.button(
                    [h.Class(classes(styles.button)), h.Disabled(true)],
                    ["← Prev"]
                  )
                : h.a(
                    [
                      h.Href(transcriptHref(around.prev)),
                      h.Class(classes(styles.button)),
                      h.Rel("prev"),
                    ],
                    ["← Prev"]
                  ),
              h.span(
                [h.Class(classes(styles.metadata))],
                [`${around.index + 1} of ${around.total}`]
              ),
              around.next === null
                ? h.button(
                    [h.Class(classes(styles.button)), h.Disabled(true)],
                    ["Next →"]
                  )
                : h.a(
                    [
                      h.Href(transcriptHref(around.next)),
                      h.Class(classes(styles.button)),
                      h.Rel("next"),
                    ],
                    ["Next →"]
                  ),
            ]
          ),
        ]
      ),
      h.p(
        [h.Class(classes(styles.eyebrow))],
        [media.label, detail.category !== null ? ` / ${detail.category}` : ""]
      ),
      h.h1([h.Class(classes(styles.title))], [detail.title]),
      h.p(
        [h.Class(classes(styles.subtitle))],
        [
          detail.channel ?? "",
          detail.created_at !== null ? ` · ${detail.created_at.slice(0, 10)}` : "",
        ]
      ),
      media.src
        ? h.iframe([
            h.Id("video-player"),
            h.Src(media.src),
            h.Title(`${media.label}: ${detail.title}`),
            h.Class(
              classes(
                styles.video,
                media.kind === "tiktok" && styles.portraitVideo
              )
            ),
            h.Allow(
              "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            ),
            h.Attribute("allowfullscreen", ""),
            h.Referrerpolicy("strict-origin-when-cross-origin"),
          ])
        : h.empty,
      h.div(
        [h.Class(classes(styles.toolbar))],
        [
          h.button(
            [
              h.Type("button"),
              h.Class(classes(styles.button)),
              h.OnClick(Messages.RequestedCopy()),
            ],
            ["Copy markdown"]
          ),
          h.button(
            [
              h.Type("button"),
              h.Class(classes(styles.button)),
              h.OnClick(Messages.RequestedDownload()),
            ],
            ["Download MD"]
          ),
          h.a(
            [
              h.Href(sourceHref(detail.id)),
              h.Target("_blank"),
              h.Rel("noopener noreferrer"),
              h.Class(classes(styles.button)),
            ],
            [media.kind === "article" ? "Read original ↗" : "Open original ↗"]
          ),
        ]
      ),
      media.kind === "article"
        ? h.empty
        : h.div(
            [
              h.Class(classes(styles.mobileTabs)),
              h.Attribute("role", "group"),
              h.Attribute("aria-label", "Reading section"),
            ],
            [
              h.button(
                [
                  h.Type("button"),
                  h.Class(
                    classes(
                      styles.button,
                      model.tab === "summary" && styles.selected
                    )
                  ),
                  h.Attribute("aria-pressed", String(model.tab === "summary")),
                  h.OnClick(Messages.SelectedTab({ tab: "summary" })),
                ],
                ["Summary"]
              ),
              h.button(
                [
                  h.Type("button"),
                  h.Class(
                    classes(
                      styles.button,
                      model.tab === "transcript" && styles.selected
                    )
                  ),
                  h.Attribute(
                    "aria-pressed",
                    String(model.tab === "transcript")
                  ),
                  h.OnClick(Messages.SelectedTab({ tab: "transcript" })),
                ],
                ["Transcript"]
              ),
            ]
          ),
      media.kind === "article"
        ? h.section(
            [
              h.Class(classes(styles.prose)),
              h.Attribute("aria-label", "Article"),
            ],
            markdownView(markdown, h)
          )
        : h.div(
            [h.Class(classes(styles.columns))],
            [
              h.section(
                [
                  h.Class(
                    classes(
                      styles.prose,
                      model.tab !== "summary" && styles.mobileHidden
                    )
                  ),
                  h.Attribute("aria-label", "Summary"),
                ],
                [
                  h.h2(
                    [h.Class(classes(styles.proseHeading))],
                    [media.kind === "article" ? "Article" : "Summary"]
                  ),
                  ...(sections.summary
                    ? markdownView(
                        sections.summary,
                        h,
                        media.kind === "youtube"
                      )
                    : [
                        h.p(
                          [],
                          [
                            "No summary is stored for this item. Read the full transcript instead.",
                          ]
                        ),
                      ]),
                ]
              ),
              h.section(
                [
                  h.Class(
                    classes(
                      styles.prose,
                      model.tab !== "transcript" && styles.mobileHidden
                    )
                  ),
                  h.Attribute("aria-label", "Full transcript"),
                ],
                [
                  h.h2(
                    [h.Class(classes(styles.proseHeading))],
                    ["Full transcript"]
                  ),
                  ...(sections.transcript
                    ? markdownView(
                        sections.transcript,
                        h,
                        media.kind === "youtube"
                      )
                    : [
                        h.p(
                          [],
                          [
                            "No separate transcript is stored. The saved content is in Summary.",
                          ]
                        ),
                      ]),
                ]
              ),
            ]
          ),
    ]
  );
};
