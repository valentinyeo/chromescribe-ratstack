export { defineFlag, Flags } from "@chromescribe/core/flags";

export type { Flag, FlagContext } from "@chromescribe/core/flags";

export {
  flagCapabilities,
  getFlag,
  listFlags,
} from "@chromescribe/core/flag-capabilities";

export {
  evaluateFlag,
  FlagRule,
  Percentage,
  subjectBucket,
} from "./evaluate.js";

export type { Rule } from "./evaluate.js";

export { checkFlagExpiry, ExpiredFlags } from "./expiry.js";
