import { ExecuteError } from "@chromescribe/capability";
import { toRpcGroup } from "@chromescribe/capability/rpc-group";
import { gateOutcome } from "@chromescribe/check-harness";
import { healthContract } from "@chromescribe/core/contracts";
import { expect, it } from "@effect/vitest";
import { Effect, Layer, Predicate, Schema } from "effect";
import * as HttpClient from "effect/http/HttpClient";
import type * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as RpcServer from "effect/rpc/RpcServer";

import {
  contentVersionRetryDefaults,
  postDeployChecks,
  rpcHealthCheck,
} from "../src/checks.js";

const { group: healthGroup } = toRpcGroup([healthContract]);

const healthServer = () =>
  RpcServer.toHttpEffect(healthGroup).pipe(
    Effect.provide(
      Layer.mergeAll(
        healthGroup.toLayer({
          health: () =>
            Effect.succeed({
              runtime: "cloudflare-worker",
              status: "ok" as const,
            }),
        }),
        RpcSerialization.layerJson
      )
    )
  );

const isRpcUrl = (url: string) => /^\/rpc\/?$/u.test(new URL(url).pathname);

const answerRpc = (
  server: Effect.Success<ReturnType<typeof healthServer>>,
  request: HttpClientRequest.HttpClientRequest,
  body: string
) =>
  server.pipe(
    Effect.provideService(
      HttpServerRequest.HttpServerRequest,
      HttpServerRequest.fromWeb(
        new Request(request.url, {
          body,
          headers: request.headers,
          method: request.method,
        })
      )
    ),
    Effect.scoped,
    Effect.map((response) =>
      HttpClientResponse.fromWeb(request, HttpServerResponse.toWeb(response))
    )
  );

const sandboxStatus = (body: string) =>
  body.includes("while(true)") || body.includes("fetch") ? 422 : 200;

const bodyFor = (url: string, body: string) => {
  if (["/news", "/directory", "/llms.txt"].includes(new URL(url).pathname)) {
    return "cafe-news.yml cafe-project.yml File only after the person approves that exact issue. Listing is not guaranteed.";
  }

  if (url === "https://isitagentready.com/api/scan") {
    return {
      level: 5,
      levelName: "Agent-Native",
      scannedAt: "2026-10-06T06:00:00.000Z",
    };
  }

  if (url.endsWith("/openapi.json")) {
    return {
      paths: { "/api/execute": { post: { responses: { "429": {} } } } },
    };
  }

  if (url.endsWith("/mcp")) {
    if (body.includes("tools/list")) {
      return {
        result: {
          tools: ["search", "read", "execute"].map((name) => ({ name })),
        },
      };
    }

    return {
      result: {
        structuredContent: {
          matches: [{ id: "ratstack://skills/learn-rat-stack" }],
        },
      },
    };
  }

  if (body.includes("while(true)")) {
    return new ExecuteError({
      kind: "TimeoutExceeded",
      logs: [],
      message: "The program exceeded its time limit",
      toolCalls: [],
      truncated: false,
    });
  }

  if (body.includes("fetch")) {
    return new ExecuteError({
      kind: "ExecutionFailure",
      logs: [],
      message:
        "This worker is not permitted to access the internet via global functions",
      toolCalls: [],
      truncated: false,
    });
  }

  return {
    result: {
      id: "ratstack://skills/learn-rat-stack",
      text: "fixture skill content",
    },
  };
};

const markdownCanonicalHeader = (path: string, absolute: boolean) =>
  `<${absolute ? "https://example.com" : ""}${path === "/log.md" ? "/log" : path}>; rel="canonical"`;

it.effect.prop(
  "health requires valid protocols, matching content, workshop indexing, and submission instructions",
  {
    broken: Schema.Boolean,
    guideComplete: Schema.Boolean,
    markdownCanonical: Schema.Boolean,
    matchesGeneration: Schema.Boolean,
    pageIndexable: Schema.Boolean,
    sitemapChildrenExcluded: Schema.Boolean,
    sitemapListed: Schema.Boolean,
    subpathsNoindex: Schema.Boolean,
  },
  ({
    broken,
    guideComplete,
    matchesGeneration,
    pageIndexable,
    sitemapListed,
    sitemapChildrenExcluded,
    markdownCanonical,
    subpathsNoindex,
  }) =>
    Effect.gen(function* test() {
      const requests: string[] = [];
      const rpc = yield* healthServer();

      const client = HttpClient.make((request) => {
        requests.push(request.url);
        let body = "";

        if (Predicate.isTagged(request.body, "Uint8Array")) {
          body = new TextDecoder().decode(request.body.body);
        }

        if (isRpcUrl(request.url) && !broken) {
          return answerRpc(rpc, request, body);
        }

        const value =
          request.headers.accept === "text/markdown" && !guideComplete
            ? "No submission instructions"
            : bodyFor(request.url, body);

        const path = new URL(request.url).pathname;
        const workshop = path === "/tokenmaxx";
        const sitemap = path === "/sitemap.xml";
        const transaction = path.startsWith("/tokenmaxx/");

        const headers = new Headers({
          "cache-control": "no-store",
          "content-type": "application/json",
          etag: `W/"${matchesGeneration ? "test-generation" : "old-generation"}:default:${encodeURIComponent(path)}"`,
          link: markdownCanonicalHeader(path, markdownCanonical),
          "x-content-generation": matchesGeneration
            ? "test-generation"
            : "old-generation",
        });

        if ((workshop && !pageIndexable) || (transaction && subpathsNoindex)) {
          headers.set("x-robots-tag", "noindex");
        }

        const sitemapBody = [
          "<urlset>",
          ...(sitemapListed
            ? ["<url><loc>https://example.com/tokenmaxx</loc></url>"]
            : []),
          ...(sitemapChildrenExcluded
            ? []
            : ["<url><loc>https://example.com/tokenmaxx/prep</loc></url>"]),
          "</urlset>",
        ].join("");

        const response =
          workshop || sitemap
            ? new Response(sitemap ? sitemapBody : "Workshop", {
                headers,
                status: broken ? 503 : 200,
              })
            : Response.json(broken ? {} : value, {
                headers,
                status: broken ? 503 : sandboxStatus(body),
              });

        return Effect.succeed(HttpClientResponse.fromWeb(request, response));
      });

      const results = yield* postDeployChecks(
        "https://example.com",
        "test-generation",
        0,
        { ...contentVersionRetryDefaults, deadlineMs: 0 }
      ).pipe(Effect.provideService(HttpClient.HttpClient, client));

      expect(results.every((result) => gateOutcome(result) === "pass")).toBe(
        [
          !broken,
          guideComplete,
          matchesGeneration,
          pageIndexable,
          sitemapListed,
          sitemapChildrenExcluded,
          markdownCanonical,
          subpathsNoindex,
        ].every(Boolean)
      );
      expect(
        results
          .filter((result) => result.check === "markdown-canonicals")
          .map(gateOutcome)
      ).toStrictEqual([!broken && markdownCanonical ? "pass" : "fail"]);
      expect(
        results
          .filter((result) => result.check === "tokenmaxx-sitemap")
          .map(gateOutcome)
      ).toStrictEqual([
        !broken && sitemapListed && sitemapChildrenExcluded ? "pass" : "fail",
      ]);
      expect(requests).toHaveLength(broken ? 32 : 31);
      expect(results).toHaveLength(28);
    }).pipe(Effect.scoped),
  { arbitrary: { runs: 50 } }
);

it.effect.prop(
  "sandbox health requires HTTP 422, a complete typed failure, matching kind, and refused fetch",
  {
    completeFailure: Schema.Boolean,
    networkKind: Schema.Literals(["ExecutionFailure", "TimeoutExceeded"]),
    refusedFetch: Schema.Boolean,
    status: Schema.Literals([200, 422, 500]),
    timeoutKind: Schema.Literals(["TimeoutExceeded", "ExecutionFailure"]),
  },
  ({ status, completeFailure, timeoutKind, networkKind, refusedFetch }) =>
    Effect.gen(function* qualifiesSandboxDiagnostics() {
      const rpc = yield* healthServer();

      const client = HttpClient.make((request) => {
        const body = Predicate.isTagged(request.body, "Uint8Array")
          ? new TextDecoder().decode(request.body.body)
          : "";

        if (isRpcUrl(request.url)) {
          return answerRpc(rpc, request, body);
        }

        const timeout = body.includes("while(true)");
        const network = body.includes("fetch");
        const sandbox = timeout || network;

        const failure = new ExecuteError({
          kind: timeout ? timeoutKind : networkKind,
          logs: [],
          message:
            network && refusedFetch
              ? "This worker is not permitted to access the internet"
              : "Unrelated execution failure",
          toolCalls: [],
          truncated: false,
        });

        const document = completeFailure
          ? failure
          : { kind: failure.kind, message: failure.message };

        const value = sandbox ? document : bodyFor(request.url, body);

        return Effect.succeed(
          HttpClientResponse.fromWeb(
            request,
            Response.json(value, {
              headers: { etag: 'W/"test-generation:default:route"' },
              status: sandbox ? status : 200,
            })
          )
        );
      });

      const results = yield* postDeployChecks(
        "https://example.com",
        "test-generation",
        0,
        { ...contentVersionRetryDefaults, deadlineMs: 0 }
      ).pipe(Effect.provideService(HttpClient.HttpClient, client));

      const timeout = results.find((row) => row.check === "sandbox-timeout");

      const network = results.find(
        (row) => row.check === "sandbox-network-refused"
      );

      if (completeFailure) {
        expect(timeout?.outcome).toBe(
          status === 422 && timeoutKind === "TimeoutExceeded"
            ? "passed"
            : "failed"
        );
        expect(network?.outcome).toBe(
          status === 422 && networkKind === "ExecutionFailure" && refusedFetch
            ? "passed"
            : "failed"
        );
      } else {
        expect(timeout?.outcome).toBe("errored");
        expect(network?.outcome).toBe("errored");
      }
    }).pipe(Effect.scoped),
  { arbitrary: { runs: 100 } }
);

it.effect.prop(
  "worker health is green only when POST /rpc answers 200 with ok",
  {
    status: Schema.Literals([200, 404, 503]),
  },
  ({ status }) =>
    Effect.gen(function* qualifiesBrowserSearch() {
      const rpc = yield* healthServer();
      const seen: string[] = [];

      const client = HttpClient.make((request) => {
        seen.push(
          `${request.method} ${isRpcUrl(request.url) ? "rpc" : request.url}`
        );

        const body = Predicate.isTagged(request.body, "Uint8Array")
          ? new TextDecoder().decode(request.body.body)
          : "";

        return status === 200
          ? answerRpc(rpc, request, body)
          : Effect.succeed(
              HttpClientResponse.fromWeb(
                request,
                new Response("Not found", { status })
              )
            );
      });

      const verdict = yield* rpcHealthCheck("https://example.com").pipe(
        Effect.provideService(HttpClient.HttpClient, client)
      );

      expect(seen).toStrictEqual(["POST rpc"]);
      expect(gateOutcome(verdict) === "pass").toBe(status === 200);
    }).pipe(Effect.scoped),
  { arbitrary: { runs: 50 } }
);
