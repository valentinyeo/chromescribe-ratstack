import { toCommand } from "@chromescribe/capability";
import { formatFileStats, inspectFile } from "@chromescribe/core";
import { flipFeatureFlag } from "@chromescribe/core/flag-write-capabilities";
import { Console, Effect, Layer } from "effect";
import { Command, Flag } from "effect/cli";

import {
  capabilities,
  commandCapabilities,
  DEVTOOLS_MCP_PATH,
  devtoolsWebServer,
  http,
  mcpServer,
  SERVE_HOST,
  webServer,
} from "./surfaces.js";
import { VERSION } from "./version.js";

export { VERSION } from "./version.js";

const capabilityCommands = commandCapabilities.map((capability) => {
  const command =
    capability === inspectFile
      ? toCommand(capability, {
          positional: ["path"],
          render: formatFileStats,
        }).pipe(Command.withAlias("stats"))
      : toCommand(
          capability,
          capability === flipFeatureFlag
            ? { promptForApproval: true }
            : undefined
        );

  return command;
});

const openapiCommand = Command.make("openapi", {}, () =>
  Console.log(JSON.stringify(http.openApi(), null, 2))
).pipe(Command.withDescription("Print the OpenAPI document for the REST API"));

const devtoolsFlag = Flag.Boolean("devtools").pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    "Record every capability call and add the rat_* devtools tools"
  )
);

const serveCommand = Command.make(
  "serve",
  {
    devtools: devtoolsFlag,
    port: Flag.Int("port").pipe(
      Flag.withDefault(3000),
      Flag.withDescription("TCP port to listen on")
    ),
  },
  ({ devtools, port }) =>
    devtools
      ? Console.error(
          `🐀 devtools MCP: http://${SERVE_HOST}:${port}${DEVTOOLS_MCP_PATH}`
        ).pipe(
          Effect.andThen(Layer.launch(devtoolsWebServer(port))),
          Effect.orDie
        )
      : Layer.launch(webServer(port))
).pipe(
  Command.withDescription(
    "Serve the REST API, /openapi.json, and /docs until interrupted; --devtools adds MCP on 127.0.0.1"
  )
);

const mcpCommand = Command.make(
  "mcp",
  { devtools: devtoolsFlag },
  ({ devtools }) =>
    devtools
      ? Layer.launch(mcpServer.devtools).pipe(Effect.orDie)
      : Layer.launch(mcpServer.tools).pipe(Effect.orDie)
).pipe(
  Command.withDescription("Serve the capabilities as an MCP server over stdio")
);

export const rootCommand = Command.make("chromescribe").pipe(
  Command.withDescription(
    `Inspect files and read ChromeScribe flags: ${capabilities.length} capabilities across CLI, REST, and MCP`
  ),
  Command.withSubcommands([
    ...capabilityCommands,
    openapiCommand,
    serveCommand,
    mcpCommand,
  ])
);

export const runCommand = Command.runWith(rootCommand, { version: VERSION });
