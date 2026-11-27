import { expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { health } from "../src/health.js";

it.effect("reports the Worker runtime as healthy", () =>
  Effect.gen(function* reportHealth() {
    const report = yield* health.handler({});

    expect(report).toStrictEqual({
      runtime: "cloudflare-worker",
      status: "ok",
    });
  })
);
