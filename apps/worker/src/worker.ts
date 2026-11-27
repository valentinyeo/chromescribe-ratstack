import * as Cloudflare from "@alchemy.run/cloudflare";
import { adopt } from "alchemy/AdoptPolicy";
import { retain } from "alchemy/RemovalPolicy";
import { Config, Effect } from "effect";

export const chromeScribeResources = Effect.gen(
  function* chromeScribeResources() {
    const database = yield* Cloudflare.D1.Database("ChromeScribeDatabase", {
      name: "chromescribe",
    }).pipe(adopt(true), retain(true));
    const transcripts = yield* Cloudflare.R2.Bucket("ChromeScribeTranscripts", {
      name: "chromescribe-transcripts",
    }).pipe(adopt(true), retain(true));
    return { database, transcripts };
  }
);

export class ChromeScribeWorker extends Cloudflare.Worker<ChromeScribeWorker>()(
  "ChromeScribeWorker",
  Effect.gen(function* workerProps() {
    const { database, transcripts } = yield* chromeScribeResources;
    const audience = yield* Config.Redacted("ACCESS_AUD").pipe(
      Config.withDefault(""),
      Effect.orDie
    );
    const gate = yield* Config.String("CHRO10_API_GATE").pipe(
      Config.withDefault("1"),
      Effect.orDie
    );
    const certs = yield* Config.String("ACCESS_CERTS_URL").pipe(
      Config.withDefault(
        "https://vwo-analyzer.cloudflareaccess.com/cdn-cgi/access/certs"
      ),
      Effect.orDie
    );
    return {
      bundle: true,
      compatibility: { date: "2026-05-28" },
      main: "./src/index.ts",
      workersDev: false,
      env: {
        DB: database,
        TRANSCRIPTS: transcripts,
        ACCESS_AUD: audience,
        CHRO10_API_GATE: gate,
        ACCESS_CERTS_URL: certs,
      },
    };
  })
) {}
