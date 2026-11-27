import type { Workers } from "@alchemy.run/cloudflare";
import { Effect, Layer } from "effect";

import { accessVerifierLayer } from "./access-gate.js";
import type { AccessSettings } from "./access-gate.js";
import { transcriptServer } from "./app.js";
import { d1TranscriptLayer, r2ContentLayer } from "./storage.js";
import type { TranscriptBucket, TranscriptDatabase } from "./storage.js";
import type { ChromeScribeWorker } from "./worker.js";

export interface WorkerBindings extends AccessSettings {
  readonly DB: TranscriptDatabase;
  readonly TRANSCRIPTS: TranscriptBucket;
}

const servers = new WeakMap<
  WorkerBindings,
  ReturnType<typeof transcriptServer>
>();

const publicReport = Effect.fn("publicReport")(function* publicReport(
  bucket: TranscriptBucket,
  id: string
) {
  const object = yield* Effect.promise(() => bucket.get(`reports/${id}.html`));

  if (!object) {
    return new Response("Report not found", { status: 404 });
  }

  const html = yield* Effect.promise(() => object.text());

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});

export const handleRequest = (
  request: Request,
  env: WorkerBindings
): Promise<Response> => {
  const report = /^\/reports\/(?<id>[a-f0-9]{12})$/u.exec(
    new URL(request.url).pathname
  );

  if (request.method === "GET" && report?.groups?.id !== undefined) {
    return Effect.runPromise(publicReport(env.TRANSCRIPTS, report.groups.id));
  }

  let server = servers.get(env);

  if (!server) {
    server = transcriptServer(
      Layer.mergeAll(
        d1TranscriptLayer(env.DB),
        r2ContentLayer(env.TRANSCRIPTS),
        accessVerifierLayer(env)
      )
    );
    servers.set(env, server);
  }

  return server.handler(request);
};

export default {
  fetch: (
    request: Request,
    env: Workers.InferEnv<typeof ChromeScribeWorker>
  ): Promise<Response> => handleRequest(request, env),
};
