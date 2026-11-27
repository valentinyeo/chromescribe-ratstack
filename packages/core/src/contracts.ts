import { defineContract } from "@chromescribe/capability/contract";
import { Schema } from "effect";

import { FileStatsError, FileStatsSchema } from "./stats.js";

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
