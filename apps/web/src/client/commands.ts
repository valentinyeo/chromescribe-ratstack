import { Cause, Effect, Schema } from "effect";
import { Command } from "foldkit";

import { Messages } from "./messages.js";
import { Theme } from "./model.js";
import { TranscriptRpc } from "./rpc.js";

class BrowserActionFailed extends Schema.TaggedError<
  BrowserActionFailed,
  { readonly brand: unique symbol }
>()("BrowserActionFailed", { cause: Schema.Defect() }) {}

export const ReadLocation = Command.define("ReadLocation", {
  messages: [Messages.LoadedLocation],
  execute: Effect.gen(function* readLocation() {
    const stored = yield* Effect.try({
      try: () => localStorage.getItem("cs-theme"),
      catch: (cause) => new BrowserActionFailed({ cause }),
    }).pipe(Effect.orElseSucceed(() => "dark"));

    return Messages.LoadedLocation({
      href: window.location.href,
      theme: stored === "light" ? "light" : "dark",
    });
  }),
});

export const LoadHome = Command.define("LoadHome", {
  args: {
    query: Schema.String,
    channel: Schema.String,
    offset: Schema.Int,
    revision: Schema.Int,
  },
  messages: [Messages.LoadedHome, Messages.FailedLoad],
  execute: ({ query, channel, offset, revision }) =>
    Effect.gen(function* loadHome() {
      const rpc = yield* TranscriptRpc;

      if (query.trim()) {
        const rows = yield* rpc.searchTranscripts({ query: query.trim() });

        const data = channel
          ? rows.filter((row) => row.channel === channel)
          : rows;

        return Messages.LoadedHome({
          revision,
          offset: 0,
          result: { data, total: data.length },
        });
      }

      const result = yield* rpc.listTranscripts({
        limit: 60,
        offset,
        channel,
      });

      return Messages.LoadedHome({ revision, offset, result });
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.succeed(
          Messages.FailedLoad({ revision, error: Cause.pretty(cause) })
        )
      )
    ),
});

export const LoadCategories = Command.define("LoadCategories", {
  messages: [Messages.LoadedCategories, Messages.FailedCategories],
  execute: Effect.gen(function* loadCategories() {
    const rpc = yield* TranscriptRpc;
    const categories = yield* rpc.listCategories({});

    return Messages.LoadedCategories({ categories });
  }).pipe(
    Effect.catchCause((cause) =>
      Effect.succeed(Messages.FailedCategories({ error: Cause.pretty(cause) }))
    )
  ),
});

export const LoadTranscript = Command.define("LoadTranscript", {
  args: { id: Schema.Int, revision: Schema.Int },
  messages: [Messages.LoadedTranscript, Messages.FailedLoad],
  execute: ({ id, revision }) =>
    Effect.gen(function* loadTranscript() {
      const rpc = yield* TranscriptRpc;

      const transcript = yield* Effect.all(
        {
          detail: rpc.getTranscript({ id }),
          markdown: rpc.getTranscriptContent({ id }),
          around: rpc.getTranscriptAround({ id }),
        },
        { concurrency: "unbounded" }
      );

      return Messages.LoadedTranscript({ revision, transcript });
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.succeed(
          Messages.FailedLoad({ revision, error: Cause.pretty(cause) })
        )
      )
    ),
});

export const PersistTheme = Command.define("PersistTheme", {
  args: { theme: Theme },
  messages: [Messages.CompletedTheme],
  execute: ({ theme }) =>
    Effect.try({
      try: () => {
        localStorage.setItem("cs-theme", theme);
      },
      catch: (cause) => new BrowserActionFailed({ cause }),
    }).pipe(
      Effect.match({
        onSuccess: () => Messages.CompletedTheme({ notice: "" }),
        onFailure: () =>
          Messages.CompletedTheme({
            notice:
              "Theme changed. This browser could not save your preference.",
          }),
      })
    ),
});

export const CopyMarkdown = Command.define("CopyMarkdown", {
  args: { markdown: Schema.String },
  messages: [Messages.CompletedAction],
  execute: ({ markdown }) =>
    Effect.tryPromise({
      try: () => navigator.clipboard.writeText(markdown),
      catch: (cause) => new BrowserActionFailed({ cause }),
    }).pipe(
      Effect.match({
        onSuccess: () =>
          Messages.CompletedAction({ notice: "Markdown copied." }),
        onFailure: () =>
          Messages.CompletedAction({
            notice: "Clipboard unavailable. Use Download MD instead.",
          }),
      })
    ),
});

export const DownloadMarkdown = Command.define("DownloadMarkdown", {
  args: { markdown: Schema.String, id: Schema.Int },
  messages: [Messages.CompletedAction],
  execute: ({ markdown, id }) =>
    Effect.try({
      try: () => {
        const href = URL.createObjectURL(
          new Blob([markdown], { type: "text/markdown;charset=utf-8" })
        );

        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.download = `chromescribe-${id}.md`;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(href);
      },
      catch: (cause) => new BrowserActionFailed({ cause }),
    }).pipe(
      Effect.match({
        onSuccess: () =>
          Messages.CompletedAction({ notice: "Markdown downloaded." }),
        onFailure: () =>
          Messages.CompletedAction({
            notice: "Download unavailable. Use Copy markdown instead.",
          }),
      })
    ),
});

export const SeekVideo = Command.define("SeekVideo", {
  args: { seconds: Schema.Int },
  messages: [Messages.CompletedAction],
  execute: ({ seconds }) =>
    Effect.sync(() => {
      const frame = document.querySelector("#video-player");

      if (
        !(frame instanceof HTMLIFrameElement) ||
        !frame.src.startsWith("https://www.youtube.com/embed/")
      ) {
        return Messages.CompletedAction({
          notice: "Timestamp seeking is available for YouTube videos.",
        });
      }

      frame.contentWindow?.postMessage(
        JSON.stringify({
          event: "command",
          func: "seekTo",
          args: [seconds, true],
        }),
        "https://www.youtube.com"
      );
      frame.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "playVideo", args: [] }),
        "https://www.youtube.com"
      );

      return Messages.CompletedAction({
        notice: `Playing from ${seconds} seconds.`,
      });
    }),
});
