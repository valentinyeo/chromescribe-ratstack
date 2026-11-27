import * as Cloudflare from "@alchemy.run/cloudflare";
import { ALCHEMY_DEV, Stage } from "alchemy";
import { Config, Effect } from "effect";

import { ChromeScribeWorker } from "../../worker/src/worker.js";

export class Website extends Cloudflare.Website.Foldkit<Website>()(
  "Website",
  Effect.gen(function* websiteProps() {
    const backend = yield* ChromeScribeWorker;
    const stage = yield* Stage;
    const dev = yield* ALCHEMY_DEV.pipe(Effect.orDie);
    const domain = yield* Config.String("CHROMESCRIBE_PREVIEW_DOMAIN").pipe(Config.withDefault("next.chromescribe.yeoux.net"), Effect.orDie);
    return {
      rootDir: ".",
      workersDev: false,
      ...(stage === "preview" && !dev ? { domain } : {}),
      env: { RPC_BACKEND: backend },
      assets: { runWorkerFirst: ["/api/*", "/rpc", "/reports/*"] },
    };
  })
) {}
