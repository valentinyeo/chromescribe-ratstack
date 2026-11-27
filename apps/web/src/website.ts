import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Effect from "effect/Effect";

export class Website extends Cloudflare.Website.Foldkit<Website>()(
  "Website",
  Effect.succeed({
    rootDir: ".",
    workersDev: false,
  } satisfies Cloudflare.Website.FoldkitProps)
) {}
