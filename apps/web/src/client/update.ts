import { Option } from "effect";
import type { Update } from "foldkit";

import { CopyMarkdown, DownloadMarkdown, LoadCategories, LoadHome, LoadTranscript, PersistTheme, ReadLocation, SeekVideo } from "./commands.js";
import { Messages } from "./messages.js";
import { initialModel, parseLocation } from "./model.js";
import type { Model } from "./model.js";
import type { TranscriptRpc } from "./rpc.js";

type Result = Update.Return<Model, Messages, TranscriptRpc>;

const loadHome = (model: Model, append = false): Result => {
  const revision = model.revision + 1;
  const offset = append ? model.offset : 0;
  return {
    model: { ...model, revision, status: "loading", error: "", ...(append ? {} : { rows: [], offset: 0 }) },
    commands: [LoadHome({ query: model.query, channel: model.channel, offset, revision })],
  };
};

export const init = (): Result => ({ model: initialModel, commands: [ReadLocation()] });

export const update = (model: Model, message: Messages): Result => Messages.match<Result>(message, {
  LoadedLocation: ({ href, theme }) => {
    const route = parseLocation(href);
    const next = { ...initialModel, theme, page: route.page, query: route.query, channel: route.channel, transcriptId: route.id, revision: model.revision + 1 };
    if (route.page === "home") {
      const loaded = loadHome(next);
      return { ...loaded, commands: [...(loaded.commands ?? []), LoadCategories()] };
    }
    if (route.page === "transcript") {
      return { model: next, commands: [LoadTranscript({ id: route.id, revision: next.revision })] };
    }
    return { model: { ...next, status: "error", error: "This page or transcript ID is invalid. Return to the library." } };
  },
  ChangedSearch: ({ query }) => loadHome({ ...model, query }),
  SelectedCategory: ({ category }) => ({ model: { ...model, category } }),
  RequestedMore: () => model.status === "loading" || model.query.trim() || model.offset >= model.total ? { model } : loadHome(model, true),
  RequestedRetry: () => model.page === "transcript" ? {
    model: { ...model, status: "loading", error: "", revision: model.revision + 1 },
    commands: [LoadTranscript({ id: model.transcriptId, revision: model.revision + 1 })],
  } : loadHome(model, model.offset > 0),
  LoadedHome: ({ revision, offset, result }) => revision !== model.revision ? { model } : {
    model: { ...model, status: "ready", error: "", rows: offset === 0 ? result.data : [...model.rows, ...result.data.filter((row) => !model.rows.some((existing) => existing.id === row.id))], total: result.total, offset: offset + result.data.length },
  },
  LoadedCategories: ({ categories }) => ({ model: { ...model, categories } }),
  FailedCategories: ({ error }) => ({ model: { ...model, notice: `Categories unavailable. ${error}` } }),
  LoadedTranscript: ({ revision, transcript }) => revision !== model.revision ? { model } : {
    model: { ...model, status: "ready", transcript: Option.some(transcript), error: "" },
  },
  FailedLoad: ({ revision, error }) => revision !== model.revision ? { model } : { model: { ...model, status: "error", error } },
  SelectedTab: ({ tab }) => ({ model: { ...model, tab } }),
  ToggledTheme: () => {
    const theme = model.theme === "dark" ? "light" : "dark";
    return { model: { ...model, theme }, commands: [PersistTheme({ theme })] };
  },
  CompletedTheme: ({ notice }) => ({ model: { ...model, notice } }),
  RequestedCopy: () => Option.match(model.transcript, { onNone: () => ({ model }), onSome: (transcript) => ({ model, commands: [CopyMarkdown({ markdown: transcript.markdown })] }) }),
  RequestedDownload: () => Option.match(model.transcript, { onNone: () => ({ model }), onSome: (transcript) => ({ model, commands: [DownloadMarkdown({ markdown: transcript.markdown, id: transcript.detail.id })] }) }),
  RequestedSeek: ({ seconds }) => ({ model, commands: [SeekVideo({ seconds })] }),
  CompletedAction: ({ notice }) => ({ model: { ...model, notice } }),
  FailedThumbnail: ({ id }) => ({ model: { ...model, failedThumbnails: [...model.failedThumbnails, id] } }),
});
