import { Schema } from "effect";

import { TranscriptContentNotFound } from "./transcript-content-not-found.js";
import { TranscriptNotFound } from "./transcript-not-found.js";
import { TranscriptStorageError } from "./transcript-storage-error.js";

export {
  TranscriptNotFound,
  TranscriptStorageError,
  TranscriptContentNotFound,
};

export { TranscriptRepository } from "./transcript-repository.js";

export { TranscriptContentStore } from "./transcript-content-store.js";

export type { TranscriptThumbnail } from "./transcript-content-store.js";

export { AccessVerifier } from "./access-verifier.js";

export const TranscriptSummarySchema = Schema.Struct({
  id: Schema.Int,
  video_id: Schema.String,
  title: Schema.String,
  channel: Schema.NullOr(Schema.String),
  duration: Schema.NullOr(Schema.Int),
  word_count: Schema.NullOr(Schema.Int),
  created_at: Schema.NullOr(Schema.String),
  category: Schema.NullOr(Schema.String),
  tags: Schema.NullOr(Schema.String),
});

export type TranscriptSummary = typeof TranscriptSummarySchema.Type;

export const TranscriptDetailSchema = Schema.Struct({
  ...TranscriptSummarySchema.fields,
  srt_path: Schema.String,
  thumbnail_url: Schema.NullOr(Schema.String),
});

export type TranscriptDetail = typeof TranscriptDetailSchema.Type;

export const TranscriptAround = Schema.Struct({
  prev: Schema.NullOr(Schema.Int),
  next: Schema.NullOr(Schema.Int),
  index: Schema.Int,
  total: Schema.Int,
});

export const CategoryCount = Schema.Struct({
  category: Schema.String,
  count: Schema.Int,
});

export const TranscriptListResult = Schema.Struct({
  data: Schema.Array(TranscriptSummarySchema),
  total: Schema.Int,
});

export const TranscriptListInput = Schema.Struct({
  limit: Schema.optionalKey(Schema.Finite),
  offset: Schema.optionalKey(Schema.Finite),
  videoId: Schema.optionalKey(Schema.String),
  channel: Schema.optionalKey(Schema.String),
});

export const TranscriptFailureSchema = Schema.Union([
  TranscriptNotFound,
  TranscriptStorageError,
  TranscriptContentNotFound,
]);

export type TranscriptFailure = typeof TranscriptFailureSchema.Type;
