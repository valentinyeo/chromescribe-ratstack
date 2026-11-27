import { eventFlags } from "@chromescribe/core/flags";
import { NodeRuntime } from "@effect/platform-node";

import { checkFlagExpiry } from "./expiry.ts";

NodeRuntime.runMain(checkFlagExpiry(eventFlags));
