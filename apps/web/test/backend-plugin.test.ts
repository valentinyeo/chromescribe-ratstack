import { expect, it } from "@effect/vitest";

import { backendPlugin } from "../backend-plugin.js";

const hook = backendPlugin().transform;

if (!hook) {
  throw new Error("Backend plugin must provide a transform hook.");
}

const transform: (code: string, id: string) => unknown =
  typeof hook === "function" ? hook : hook.handler;

it.each([
  "\0distilled:worker-entry:virtual:foldkit/fetch",
  "/src/entry.server.ts",
  "virtual:foldkit/fetch?other",
])("leaves non-Foldkit module %s untouched", async (id) => {
  const code = 'export { default } from "virtual:foldkit/fetch";';
  expect(await transform(code, id)).toBeNull();
});

it.each(["virtual:foldkit/fetch", "\0virtual:foldkit/fetch"])(
  "forwards backend requests from Foldkit entry %s",
  async (id) => {
    const code = await transform(
      "export default { fetch(request) { return new Response('ok'); } }",
      id
    );

    expect(code).toContain(
      'import { routeWebsiteRequest } from "/src/server/website-bindings.ts";'
    );
    expect(code).toContain(
      "const foldkitHandler = { fetch(request) { return new Response('ok'); } }"
    );
    expect(code).toContain("fetch(request, env) {");
    expect(code).toContain(
      "return routeWebsiteRequest(request, env, foldkitHandler.fetch);"
    );
  }
);

it("rejects a changed Foldkit fetch handler", () => {
  expect(() =>
    transform("export default handler;", "\0virtual:foldkit/fetch")
  ).toThrow(
    "Foldkit fetch entry changed. Backend forwarding requires its generated handler. Fix: update `apps/web/backend-plugin.ts` for the pinned Foldkit version."
  );
});
