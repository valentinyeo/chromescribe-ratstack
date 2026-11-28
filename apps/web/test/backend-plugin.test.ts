import { expect, it } from "@effect/vitest";

import { transformFoldkitFetchEntry } from "../backend-plugin.js";

it.each([
  "\0distilled:worker-entry:virtual:foldkit/fetch",
  "/src/entry.server.ts",
  "virtual:foldkit/fetch?other",
])("leaves non-Foldkit module %s untouched", (id) => {
  const code = 'export { default } from "virtual:foldkit/fetch";';
  expect(transformFoldkitFetchEntry(code, id)).toBeNull();
});

it.each(["virtual:foldkit/fetch", "\0virtual:foldkit/fetch"])(
  "forwards backend requests from Foldkit entry %s",
  (id) => {
    const code = transformFoldkitFetchEntry(
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
    transformFoldkitFetchEntry("export default handler;", "\0virtual:foldkit/fetch")
  ).toThrow(
    "Foldkit fetch entry changed. Backend forwarding requires its generated handler. Fix: update `apps/web/backend-plugin.ts` for the pinned Foldkit version."
  );
});
