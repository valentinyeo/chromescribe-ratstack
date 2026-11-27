// @effect-diagnostics nodeBuiltinImport:off -- This test reads the built bundle from disk to prove what production ships.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const dist = path.resolve(import.meta.dirname, "../dist");

const bundleFiles = (directory: string): readonly string[] =>
  existsSync(directory)
    ? readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const candidate = path.join(directory, entry.name);

        if (entry.isDirectory()) {
          return bundleFiles(candidate);
        }

        return statSync(candidate).isFile() &&
          /\.(?:html|js|json)$/u.test(candidate)
          ? [candidate]
          : [];
      })
    : [];

const files = bundleFiles(dist);

const contents = () =>
  files.map((file) => readFileSync(file, "utf-8")).join("\n");

describe("production web bundle", () => {
  it("builds at least one client and server artifact", () => {
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((file) => file.endsWith(".html"))).toBe(true);
  });

  it("ships no devtools, rat_call, or dev composition", () => {
    const bundle = contents();

    for (const marker of [
      "rat_call",
      "rat_list_calls",
      "@chromescribe/devtools",
      "/__chromescribe",
    ]) {
      expect(bundle).not.toContain(marker);
    }
  });
});
