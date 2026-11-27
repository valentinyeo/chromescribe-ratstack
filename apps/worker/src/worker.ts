import * as Cloudflare from "@alchemy.run/cloudflare";

export class ChromeScribeWorker extends Cloudflare.Worker<ChromeScribeWorker>()(
  "ChromeScribeWorker",
  {
    bundle: true,
    compatibility: { date: "2026-05-28" },
    main: "./src/index.ts",
  }
) {}
