// @effect-diagnostics-next-line nodeBuiltinImport:off -- This adapter seam reads its immutable fixture schema and uses the host runtime.
import { readFileSync } from "node:fs";
// @effect-diagnostics-next-line nodeBuiltinImport:off -- This adapter seam reads its immutable fixture schema and uses the host runtime.
import { pathToFileURL } from "node:url";

import { expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import type { WebsiteBindings } from "../src/server/website-bindings.js";

const Manifest = Schema.Struct({ serverEntry: Schema.String });

interface BuiltWebsite {
  readonly default: {
    readonly fetch: (
      request: Request,
      bindings: WebsiteBindings
    ) => Promise<Response>;
  };
}

it.effect(
  "forwards API and RPC bodies and Access assertions through the built service binding",
  () =>
    Effect.gen(function* binding() {
      const manifest = yield* Schema.decodeEffect(
        Schema.fromJsonString(Manifest)
      )(
        readFileSync(
          new URL("../dist/server/foldkit.build.json", import.meta.url),
          "utf-8"
        )
      );
      const entry = new URL(
        `../dist/server/${manifest.serverEntry}`,
        import.meta.url
      );
      const website: BuiltWebsite = yield* Effect.promise(
        () => import(pathToFileURL(entry.pathname).href)
      );
      const calls: Request[] = [];

      const bindings: WebsiteBindings = {
        RPC_BACKEND: {
          fetch: (request) => {
            calls.push(request);

            return Promise.resolve(new Response("backend", { status: 202 }));
          },
        },
      };

      for (const path of [
        "/api/transcripts",
        "/api/transcript/4/content",
        "/rpc",
        "/reports/abcdefabcdef",
      ]) {
        const method = path === "/rpc" ? "POST" : "GET";

        const options: RequestInit = {
          method,
          headers: { "Cf-Access-Jwt-Assertion": "assertion", Accept: "application/json" },
        };

        if (method === "POST") options.body = "rpc-body";

        const request = new Request(
          `https://next.chromescribe.yeoux.net${path}`,
          options
        );

        const response = yield* Effect.promise(() =>
          website.default.fetch(request, bindings)
        );
        expect(response.status).toBe(202);
        expect(calls.at(-1)).toBe(request);
        expect(calls.at(-1)?.headers.get("Cf-Access-Jwt-Assertion")).toBe(
          "assertion"
        );

        if (method === "POST") {
          expect(yield* Effect.promise(() => request.text())).toBe("rpc-body");
        }
      }

      const page = yield* Effect.promise(() =>
        website.default.fetch(
          new Request("https://next.chromescribe.yeoux.net/"),
          bindings
        )
      );
      expect(page.status).toBe(200);
      expect(calls).toHaveLength(4);
    })
);
