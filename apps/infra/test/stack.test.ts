import type { Workers } from "@alchemy.run/cloudflare";
import { describe, expect, expectTypeOf, it } from "vitest";

import type { Website } from "../../web/src/website.js";
import type { ChromeScribeWorker } from "../../worker/src/worker.js";
import stack from "../alchemy.run.js";

describe("ChromeScribe Stack", () => {
  it("names the stack and keeps its provider layers attached", () => {
    expect(stack.stackName).toBe("ChromeScribe");
    expect(stack.providers).toBeDefined();
    expect(stack.state).toBeDefined();
  });
  it("declares the backend storage and private Website binding", () => {
    expectTypeOf<Workers.InferEnv<typeof ChromeScribeWorker>>().toHaveProperty(
      "DB"
    );
    expectTypeOf<Workers.InferEnv<typeof ChromeScribeWorker>>().toHaveProperty(
      "TRANSCRIPTS"
    );
    expectTypeOf<Workers.InferEnv<typeof Website>>().toHaveProperty(
      "RPC_BACKEND"
    );
  });
});
