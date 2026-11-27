// @effect-diagnostics-next-line nodeBuiltinImport:off -- The Node HTTP server is the one place where nothing in Effect wraps the built-in: `NodeHttpServer.layer` takes a `node:http` server factory.
import { createServer } from "node:http";

import type { AnyCapability } from "@chromescribe/capability";
import { toCommand, toHttpApi, toToolkit } from "@chromescribe/capability";
import { capabilities as coreCapabilities } from "@chromescribe/core";
import { flagWriteCapabilities } from "@chromescribe/core/flag-write-capabilities";
import { devtools, devtoolsLayer } from "@chromescribe/devtools";
import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer, Logger } from "effect";
import { McpServer } from "effect/ai";
import { HttpRouter } from "effect/http";
import { HttpApiBuilder, HttpApiScalar } from "effect/http-api";

import { mcpProtocols } from "./mcp-protocols.js";
import { VERSION } from "./version.js";

export const capabilities = [...coreCapabilities] as const;

export const commandCapabilities = [
  ...coreCapabilities,
  ...flagWriteCapabilities,
] as const;

export const http = toHttpApi("ChromeScribe", capabilities);

export const tools = toToolkit(capabilities);

export const routes = Layer.merge(
  HttpApiBuilder.layer(http.api, { openapiPath: "/openapi.json" }).pipe(
    Layer.provide(http.layer)
  ),
  HttpApiScalar.layer(http.api, { path: "/docs" })
);

export const SERVE_HOST = "127.0.0.1";

export const serverLayer = (port: number) =>
  NodeHttpServer.layer(() => createServer(), { host: SERVE_HOST, port });

export const webServer = (port: number) =>
  HttpRouter.serve(routes).pipe(Layer.provide(serverLayer(port)));

const stdio = McpServer.layerStdio({
  name: "chromescribe",
  protocols: mcpProtocols,
  version: VERSION,
});

const withStdio = <A, E, R>(server: Layer.Layer<A, E, R>) =>
  server.pipe(
    Layer.provide(stdio),
    Layer.provide(Layer.succeed(Logger.LogToStderr, true))
  );

export const DEVTOOLS_MCP_PATH = "/__chromescribe/mcp";

const withDevtools = <const Caps extends readonly AnyCapability[], A, E, R>(
  caps: Caps,
  build: (
    projected: Effect.Success<ReturnType<typeof devtools<Caps>>>
  ) => Layer.Layer<A, E, R>
) => Layer.unwrap(Effect.map(devtools(caps), build));

const toolkitServer = <const Caps extends readonly AnyCapability[]>(
  all: Caps
) => {
  const projected = toToolkit(all);

  return McpServer.toolkit(projected.toolkit).pipe(
    Layer.provideMerge(projected.layer)
  );
};

export const devtoolsRoutes = withDevtools(
  capabilities,
  ({ capabilities: all, recorded }) => {
    const api = toHttpApi("ChromeScribe", recorded);

    return Layer.mergeAll(
      HttpApiBuilder.layer(api.api, { openapiPath: "/openapi.json" }).pipe(
        Layer.provide(api.layer)
      ),
      HttpApiScalar.layer(api.api, { path: "/docs" }),
      toolkitServer(all).pipe(
        Layer.provide(
          McpServer.layerHttp({
            name: "chromescribe-devtools",
            path: DEVTOOLS_MCP_PATH,
            protocols: mcpProtocols,
            version: VERSION,
          })
        )
      )
    );
  }
);

export const devtoolsWebServer = (port: number) =>
  HttpRouter.serve(devtoolsRoutes).pipe(
    Layer.provide(devtoolsLayer()),
    Layer.provide(serverLayer(port))
  );

export const mcpServer = {
  devtools: withStdio(
    withDevtools(capabilities, ({ capabilities: all }) => toolkitServer(all))
  ).pipe(Layer.provide(devtoolsLayer())),
  tools: withStdio(
    McpServer.toolkit(tools.toolkit).pipe(Layer.provideMerge(tools.layer))
  ),
} as const;

export const commandFor = toCommand;
