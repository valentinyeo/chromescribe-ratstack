import { toHttpApi, toRpc } from "@chromescribe/capability";
import { transcriptCapabilities } from "@chromescribe/core";
import type {
  AccessVerifier,
  TranscriptContentStore,
  TranscriptRepository,
} from "@chromescribe/core";
import { Effect, Layer } from "effect";
import {
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/http";
import { HttpApiBuilder } from "effect/http-api";
import { RpcSerialization, RpcServer } from "effect/rpc";

import { accessGate } from "./access-gate.js";
import { health } from "./health.js";
import { transcriptHttp } from "./transcript-http.js";

const capabilities = [health, ...transcriptCapabilities] as const;

export const rpc = toRpc(capabilities);

export const http = toHttpApi(
  "ChromeScribeTranscripts",
  capabilities
);

const compatibility = HttpRouter.add(
  "GET",
  "/api/*",
  Effect.gen(function* compatibility() {
    const incoming = yield* HttpServerRequest.HttpServerRequest;
    const request = yield* HttpServerRequest.toWeb(incoming);
    const response = yield* transcriptHttp(request);

    return HttpServerResponse.fromWeb(response);
  })
);

const gate = HttpRouter.middleware(
  (httpEffect) =>
    Effect.gen(function* gate() {
      const incoming = yield* HttpServerRequest.HttpServerRequest;
      const request = yield* HttpServerRequest.toWeb(incoming);
      const denied = yield* accessGate(request);

      if (denied) {
        return HttpServerResponse.fromWeb(denied);
      }
      return yield* httpEffect;
    }),
  { global: true }
);

export const transcriptServer = (
  services: Layer.Layer<
    AccessVerifier | TranscriptRepository | TranscriptContentStore
  >
) => {
  const routes = Layer.mergeAll(
    compatibility,
    HttpApiBuilder.layer(http.api).pipe(Layer.provide(http.layer)),
    RpcServer.layerHttp({
      group: rpc.group,
      path: "/rpc",
      protocol: "http",
    }).pipe(
      Layer.provide(rpc.layer),
      Layer.provide(RpcSerialization.layerJson)
    ),
    gate
  ).pipe(Layer.provideMerge(services), Layer.provideMerge(HttpServer.layerServices));

  return HttpRouter.toWebHandler(routes, { disableLogger: true });
};
