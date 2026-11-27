import { implement } from "@chromescribe/capability/implement";

import { inspectFileContract } from "./contracts.js";
import { flagCapabilities } from "./flag-capabilities.js";
import { healthFor } from "./health.js";
import { runInspectMachine } from "./inspect-machine.js";

export const inspectFile = implement(inspectFileContract, ({ path }) =>
  runInspectMachine(path)
);

export const health = healthFor("node");

export const capabilities = [inspectFile, health, ...flagCapabilities] as const;
