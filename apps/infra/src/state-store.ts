import * as Cloudflare from "@alchemy.run/cloudflare";

export const chromeScribeStateStoreName =
  "alchemy-state-store-chromescribe-state-store";

export const chromeScribeState = (state = Cloudflare.state) =>
  state({ workerName: chromeScribeStateStoreName });
