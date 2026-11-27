import * as Cloudflare from "@alchemy.run/cloudflare";
import * as DomainCloudflare from "@alchemy.run/domain/Cloudflare";
import * as Drizzle from "@alchemy.run/drizzle/Providers";
import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { Website } from "../web/src/website.js";
import { ChromeScribeWorker } from "../worker/src/worker.js";
import { chromeScribeState } from "./src/state-store.js";

export default Alchemy.Stack(
  "ChromeScribe",
  {
    providers: Layer.mergeAll(
      Cloudflare.providers(),
      DomainCloudflare.providers(),
      Drizzle.providers()
    ),
    state: chromeScribeState(),
  },
  Effect.gen(function* stack() {
    const worker = yield* ChromeScribeWorker;
    const website = yield* Website;

    return {
      workerName: worker.workerName,
      websiteUrl: website.url,
    };
  })
);
