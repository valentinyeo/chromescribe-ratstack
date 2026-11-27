import { defineContract } from "@chromescribe/capability/contract";
import { Schema } from "effect";

import { FileStatsError, FileStatsSchema } from "./stats.js";
import {
  CategoryCount,
  TranscriptAround,
  TranscriptDetail,
  TranscriptFailure,
  TranscriptListInput,
  TranscriptListResult,
} from "./transcripts.js";

export const listTranscriptsContract = defineContract("listTranscripts", {
  annotations: { idempotent: true, readOnly: true },
  description: "Read a bounded page of transcript metadata",
  failure: TranscriptFailure,
  input: TranscriptListInput,
  output: TranscriptListResult,
});

export const getTranscriptContract = defineContract("getTranscript", {
  annotations: { idempotent: true, readOnly: true },
  description: "Read one transcript's metadata",
  failure: TranscriptFailure,
  input: Schema.Struct({ id: Schema.Int }),
  output: TranscriptDetail,
});

export const getTranscriptAroundContract = defineContract("getTranscriptAround", {
  annotations: { idempotent: true, readOnly: true },
  description: "Read the transcript's neighbours and position",
  failure: TranscriptFailure,
  input: Schema.Struct({ id: Schema.Int }),
  output: TranscriptAround,
});

export const getTranscriptContentContract = defineContract("getTranscriptContent", {
  annotations: { idempotent: true, readOnly: true },
  description: "Read the stored transcript markdown",
  failure: TranscriptFailure,
  input: Schema.Struct({ id: Schema.Int }),
  output: Schema.String,
});

export const searchTranscriptsContract = defineContract("searchTranscripts", {
  annotations: { idempotent: true, readOnly: true },
  description: "Search transcript titles, channels and video identifiers",
  failure: TranscriptFailure,
  input: Schema.Struct({ query: Schema.NonEmptyString }),
  output: Schema.Array(TranscriptDetail),
});

export const listCategoriesContract = defineContract("listCategories", {
  annotations: { idempotent: true, readOnly: true },
  description: "Read transcript category counts",
  failure: TranscriptFailure,
  input: Schema.Struct({}),
  output: Schema.Array(CategoryCount),
});

export const getTranscriptThumbnailContract = defineContract("getTranscriptThumbnail", {
  annotations: { idempotent: true, readOnly: true },
  description: "Read a cached transcript thumbnail",
  failure: TranscriptFailure,
  input: Schema.Struct({ videoId: Schema.String }),
  output: Schema.Struct({ bytes: Schema.Uint8ArrayFromBase64, contentType: Schema.String }),
});

export { FileStatsError, FileStatsSchema } from "./stats.js";

export { healthContract, HealthReportSchema } from "./health.js";

export {
  flipFeatureFlagContract,
  getFlagContract,
  listFlagsContract,
  readFlagLedgerContract,
  recordFlagEvidenceContract,
} from "./flag-contracts.js";

export const inspectFileContract = defineContract("inspectFile", {
  annotations: { idempotent: true, readOnly: true },
  description: "Count bytes, characters, words, and lines in a file",
  failure: FileStatsError,
  input: Schema.Struct({
    path: Schema.String.annotate({ description: "File to inspect" }),
  }),
  output: FileStatsSchema,
});
