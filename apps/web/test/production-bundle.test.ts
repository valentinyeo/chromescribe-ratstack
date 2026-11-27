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

  it("loads scripts and styles only from the built site, never a CDN", () => {
    const html = files.filter((file) => file.endsWith(".html")).map((file) => readFileSync(file, "utf-8")).join("\n");
    expect(html).not.toMatch(/<(?:script|link)\b[^>]*(?:src|href)=["'](?:https?:)?\/\//iu);
    expect(html).not.toContain("fonts.googleapis.com");
    expect(html).not.toContain("#ff1493");
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
