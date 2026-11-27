import {
  listCategoriesContract,
  listTranscriptsContract,
} from "@chromescribe/core/contracts";
import { Schema } from "effect";
import { Message } from "foldkit";

import { Tab, Theme, TranscriptPageSchema } from "./model.js";

export const Messages = Message.defineMessageUnion({
  LoadedLocation: { href: Schema.String, theme: Theme },
  ChangedSearch: { query: Schema.String },
  SelectedCategory: { category: Schema.String },
  RequestedMore: {},
  RequestedRetry: {},
  LoadedHome: {
    revision: Schema.Int,
    offset: Schema.Int,
    result: listTranscriptsContract.output,
  },
  LoadedCategories: { categories: listCategoriesContract.output },
  FailedCategories: { error: Schema.String },
  LoadedTranscript: { revision: Schema.Int, transcript: TranscriptPageSchema },
  FailedLoad: { revision: Schema.Int, error: Schema.String },
  SelectedTab: { tab: Tab },
  ToggledTheme: {},
  CompletedTheme: { notice: Schema.String },
  RequestedCopy: {},
  RequestedDownload: {},
  RequestedSeek: { seconds: Schema.Int },
  CompletedAction: { notice: Schema.String },
  FailedThumbnail: { id: Schema.Int },
});

export type AppMessage = typeof Messages.Type;
