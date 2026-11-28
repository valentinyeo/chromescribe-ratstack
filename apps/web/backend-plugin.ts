import type { Plugin } from "vite";

export const backendPlugin = (): Plugin => ({
  name: "chromescribe-backend",
  enforce: "post",
  transform(code, id) {
    if (id !== "virtual:foldkit/fetch" && id !== "\0virtual:foldkit/fetch") {
      return null;
    }

    if (!code.includes("export default {")) {
      throw new Error(
        "Foldkit fetch entry changed. Backend forwarding requires its generated handler. Fix: update `apps/web/backend-plugin.ts` for the pinned Foldkit version."
      );
    }

    return `${code.replace("export default {", "const foldkitHandler = {")}
import { routeWebsiteRequest } from "/src/server/website-bindings.ts";
export default {
  fetch(request, env) {
    return routeWebsiteRequest(request, env, foldkitHandler.fetch);
  }
};
`;
  },
});
