import { defineContract } from "@chromescribe/capability/contract";
import { implement } from "@chromescribe/capability/implement";
import { Effect, Schema } from "effect";

export const HealthReportSchema = Schema.Struct({
  runtime: Schema.String,
  status: Schema.Literal("ok"),
});

export type HealthReport = typeof HealthReportSchema.Type;

export const healthContract = defineContract("health", {
  annotations: { idempotent: true, readOnly: true, title: "Health" },
  description: "Report that this ChromeScribe runtime is serving",
  failure: Schema.Never,
  input: Schema.Struct({}),
  output: HealthReportSchema,
});

export const healthFor = (runtime: string) =>
  implement(healthContract, () =>
    Effect.succeed({ runtime, status: "ok" as const })
  );
