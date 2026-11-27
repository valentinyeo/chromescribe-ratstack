import { Option } from "effect";
import type { Document, HtmlBuilder } from "foldkit/html";

import { LibraryKeyboard } from "./client/keyboard.js";
import { Messages } from "./client/messages.js";
import { libraryHref } from "./client/model.js";
import type { Model } from "./client/model.js";
import { homeView } from "./features/home.js";
import { transcriptView } from "./features/transcript.js";
import { classes, styles } from "./styles.js";
import { lightTheme } from "./theme.stylex.js";

export const view = (model: Model, h: HtmlBuilder<Messages>): Document => ({
  title: Option.match(model.transcript, { onNone: () => "ChromeScribe · Library", onSome: ({ detail }) => `${detail.title} · ChromeScribe` }),
  body: h.main([h.Class(classes(styles.shell, model.theme === "light" && lightTheme, model.theme === "light" && styles.light)), h.OnMount(LibraryKeyboard())], [
    h.div([h.Class(classes(styles.container))], [
      h.header([h.Class(classes(styles.header))], [
        h.a([h.Href(libraryHref()), h.Class(classes(styles.brand))], [h.span([h.Class(classes(styles.brandMark)), h.Attribute("aria-hidden", "true")], ["[cs]"]), "ChromeScribe"]),
        h.button([h.Type("button"), h.Class(classes(styles.button)), h.OnClick(Messages.ToggledTheme()), h.Attribute("aria-label", `Switch to ${model.theme === "dark" ? "light" : "dark"} theme`)], [model.theme === "dark" ? "☀ Light" : "☾ Dark"]),
      ]),
      model.page === "home" ? homeView(model, h) : h.empty,
      Option.match(model.transcript, { onNone: () => h.empty, onSome: (transcript) => transcriptView(model, transcript, h) }),
      model.status === "loading" ? h.div([h.Class(classes(styles.state)), h.Attribute("role", "status")], ["Opening your library…"]) : h.empty,
      model.status === "error" ? h.section([h.Class(classes(styles.state)), h.Attribute("role", "alert")], [
        h.h2([h.Class(classes(styles.proseHeading))], ["We couldn’t open this content."]),
        h.p([], ["Check your connection and Cloudflare Access sign-in, then try again."]),
        h.details([], [h.summary([], ["Error details"]), h.pre([h.Class(classes(styles.error))], [model.error])]),
        h.div([h.Class(classes(styles.toolbar))], [
          model.page !== "not-found" ? h.button([h.Class(classes(styles.button)), h.Type("button"), h.OnClick(Messages.RequestedRetry())], ["Try again"]) : h.empty,
          h.a([h.Href(libraryHref()), h.Class(classes(styles.button))], ["Back to Library"]),
        ]),
      ]) : h.empty,
      h.p([h.Class(classes(styles.notice)), h.Attribute("role", "status"), h.Attribute("aria-live", "polite")], [model.notice]),
    ]),
  ]),
});
