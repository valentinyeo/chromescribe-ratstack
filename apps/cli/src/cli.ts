#!/usr/bin/env node

import { Approval } from "@chromescribe/capability";
import { FileInspector } from "@chromescribe/core";
import { FlagActor } from "@chromescribe/core/flag-control";
import { eventFlags, Flags } from "@chromescribe/core/flags";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect, Layer } from "effect";

import { runCommand } from "./command.js";

const program = runCommand(process.argv.slice(2)).pipe(
  Effect.provideService(FlagActor, "local-cli"),
  // oxlint-disable-next-line promise/prefer-await-to-callbacks -- Oxlint mistakes this Effect handler for an async Promise callback.
  Effect.catchTag("FileStatsError", (error) =>
    Console.error(error.message).pipe(Effect.andThen(Effect.fail(error)))
  ),
  Effect.provide(
    Layer.mergeAll(
      Layer.provideMerge(FileInspector.layer, NodeServices.layer),
      Flags.defaults(eventFlags),
      Approval.denyAll
    )
  )
);

NodeRuntime.runMain(program);
