// @effect-diagnostics nodeBuiltinImport:off globalConsole:off -- This build script measures the Worker's real bundle on disk; it runs under Node and reports to stdout.
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

import { build } from "esbuild";

const bundleBytes = (directory: string) =>
  readdirSync(directory)
    .map((name) => statSync(path.join(directory, name)))
    .filter((entry) => entry.isFile())
    .reduce((total, entry) => total + entry.size, 0);

const root = path.resolve(import.meta.dirname, "..");

const outdir = path.join(root, "dist", "bundle");

const result = await build({
  bundle: true,
  entryPoints: [path.join(root, "src", "index.ts")],
  external: ["cloudflare:*", "node:*"],
  format: "esm",
  logLevel: "warning",
  outdir,
  platform: "neutral",
  target: "es2023",
});

const bytes = bundleBytes(outdir);

process.stdout.write(
  `worker bundle: ${outdir} ${bytes} bytes (${(bytes / 1024).toFixed(1)} KiB), ${result.warnings.length} warnings, ${result.errors.length} errors\n`
);
