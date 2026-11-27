import type { HtmlBuilder } from "foldkit/html";

import { mediaFor, thumbnailHref } from "../client/content.js";
import { Messages } from "../client/messages.js";
import type { AppMessage } from "../client/messages.js";
import {
  libraryHref,
  pinnedGroups,
  transcriptHref,
  visibleRows,
} from "../client/model.js";
import type { Model, Transcript } from "../client/model.js";
import { classes, styles } from "../styles.js";

const card = (row: Transcript, model: Model, h: HtmlBuilder<AppMessage>) => {
  const media = mediaFor(row.video_id);

  const hasThumbnail =
    media.kind !== "article" && !model.failedThumbnails.includes(row.id);

  return h.keyed("article")(
    row.id,
    [h.Class(classes(styles.card))],
    [
      h.a(
        [
          h.Href(transcriptHref(row.id)),
          h.Class(classes(styles.cardLink)),
          h.DataAttribute("transcript-card", String(row.id)),
        ],
        [
          hasThumbnail
            ? h.img([
                h.Src(thumbnailHref(row.video_id)),
                h.Alt(""),
                h.Loading("lazy"),
                h.Class(classes(styles.thumbnail)),
                h.OnError(Messages.FailedThumbnail({ id: row.id })),
              ])
            : h.div(
                [
                  h.Class(classes(styles.placeholder)),
                  h.Attribute("aria-hidden", "true"),
                ],
                [media.kind === "article" ? "Aa" : "▷"]
              ),
          h.div(
            [h.Class(classes(styles.cardBody))],
            [
              h.h2([h.Class(classes(styles.cardTitle))], [row.title]),
              h.span(
                [h.Class(classes(styles.label))],
                [row.category ?? media.label]
              ),
            ]
          ),
        ]
      ),
      h.div(
        [h.Class(classes(styles.cardBody, styles.metadata))],
        [
          row.channel !== null
            ? h.a(
                [
                  h.Href(libraryHref("", row.channel)),
                  h.Class(classes(styles.link)),
                ],
                [row.channel]
              )
            : "Unknown channel",
          h.div(
            [],
            [
              [
                row.created_at?.slice(0, 10),
                row.duration !== null ? `${Math.floor(row.duration / 60)} min` : "",
                row.word_count !== null
                  ? `${row.word_count.toLocaleString("en-US")} words`
                  : "",
              ]
                .filter(Boolean)
                .join(" · "),
            ]
          ),
        ]
      ),
    ]
  );
};

export const homeView = (model: Model, h: HtmlBuilder<AppMessage>) => {
  const rows = visibleRows(model);

  const categories = [
    { id: "", label: "All" },
    ...pinnedGroups,
    ...model.categories.map((category) => ({
      id: category.category,
      label: `${category.category} (${category.count})`,
    })),
  ];

  return h.section(
    [],
    [
      h.p([h.Class(classes(styles.eyebrow))], ["Your personal library"]),
      h.h1(
        [h.Class(classes(styles.title))],
        [model.channel || "Saved for a closer look."]
      ),
      h.p(
        [h.Class(classes(styles.subtitle))],
        [
          "Your videos and articles, transcribed. Find a thought, revisit a moment, keep reading.",
        ]
      ),
      model.channel
        ? h.p(
            [],
            [
              h.a(
                [
                  h.Href(libraryHref(model.query)),
                  h.Class(classes(styles.link)),
                ],
                ["← All channels"]
              ),
            ]
          )
        : h.empty,
      h.label(
        [h.For("library-search"), h.Class(classes(styles.metadata))],
        ["Search titles and channels"]
      ),
      h.div(
        [h.Class(classes(styles.toolbar))],
        [
          h.input([
            h.Id("library-search"),
            h.Type("search"),
            h.Value(model.query),
            h.Placeholder("Search your library…"),
            h.Class(classes(styles.search)),
            h.OnInput((query) => Messages.ChangedSearch({ query })),
          ]),
        ]
      ),
      h.nav(
        [
          h.Class(classes(styles.chips)),
          h.Attribute("aria-label", "Filter by category"),
        ],
        categories.map((category) =>
          h.keyed("button")(
            category.id || "all",
            [
              h.Type("button"),
              h.Class(
                classes(
                  styles.button,
                  styles.chip,
                  model.category === category.id && styles.selected
                )
              ),
              h.Attribute(
                "aria-pressed",
                String(model.category === category.id)
              ),
              h.OnClick(Messages.SelectedCategory({ category: category.id })),
            ],
            [category.label]
          )
        )
      ),
      h.p(
        [h.Class(classes(styles.metadata)), h.Attribute("aria-live", "polite")],
        [
          `${rows.length} shown · ${model.offset} loaded · ${model.total} ${model.query.trim() ? "search matches" : "in library"}`,
        ]
      ),
      model.category
        ? h.p(
            [h.Class(classes(styles.metadata))],
            [
              "Category filters apply to loaded results. Load more to explore further.",
            ]
          )
        : h.empty,
      h.div(
        [
          h.Class(classes(styles.grid)),
          h.Attribute("aria-busy", String(model.status === "loading")),
        ],
        rows.map((row) => card(row, model, h))
      ),
      model.status === "ready" && rows.length === 0
        ? h.div(
            [h.Class(classes(styles.state))],
            [
              "No transcripts match these filters. Try another search or category.",
            ]
          )
        : h.empty,
      !model.query.trim() && model.offset < model.total
        ? h.div(
            [h.Class(classes(styles.center))],
            [
              h.button(
                [
                  h.Type("button"),
                  h.Class(classes(styles.button)),
                  h.Disabled(model.status === "loading"),
                  h.OnClick(Messages.RequestedMore()),
                ],
                [model.status === "loading" ? "Loading…" : "Load more"]
              ),
            ]
          )
        : h.empty,
      h.p(
        [h.Class(classes(styles.metadata, styles.center))],
        ["Read-only preview · Your original library stays unchanged."]
      ),
    ]
  );
};
