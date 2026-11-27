import { Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import { HttpApiBuilder, HttpApiScalar } from "effect/http-api";

import { http } from "./health.js";

export const routes = Layer.merge(
  HttpApiBuilder.layer(http.api, { openapiPath: "/openapi.json" }).pipe(
    Layer.provide(http.layer)
  ),
  HttpApiScalar.layer(http.api, { path: "/docs" })
);

export const server = HttpRouter.toWebHandler(
  routes.pipe(Layer.provide(HttpServer.layerServices)),
  { disableLogger: true }
);
