import { describe, expect, it } from "vitest";

import stack from "../alchemy.run.js";

describe("ChromeScribe Stack", () => {
  it("names the stack and keeps its provider layers attached", () => {
    expect(stack.stackName).toBe("ChromeScribe");
    expect(stack.providers).toBeDefined();
    expect(stack.state).toBeDefined();
  });
});
