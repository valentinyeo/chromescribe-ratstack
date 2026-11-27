// @effect-diagnostics-next-line nodeBuiltinImport:off -- This adapter seam reads its immutable fixture schema and uses the host runtime.
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import { TranscriptContentStore } from "@chromescribe/core/transcripts";
import { expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";

import { accessVerifierLayer } from "../src/access-gate.js";
import { transcriptServer } from "../src/app.js";
import { handleRequest } from "../src/index.js";
import { d1TranscriptLayer } from "../src/storage.js";
import { extractSourceUrl } from "../src/transcript-http.js";

const RpcRequest = Schema.TaggedStruct("Request", {
  id: Schema.String,
  tag: Schema.String,
  payload: Schema.Struct({ id: Schema.Union([Schema.Int, Schema.String]) }),
  headers: Schema.Array(Schema.Tuple([Schema.String, Schema.String])),
});

const ListBody = Schema.Struct({
  success: Schema.Boolean,
  total: Schema.Int,
  data: Schema.Array(
    Schema.Struct({
      id: Schema.Int,
      title: Schema.String,
      duration_formatted: Schema.String,
      created_at_formatted: Schema.String,
    })
  ),
});

const NavigationBody = Schema.Struct({
  data: Schema.Struct({
    prev: Schema.NullOr(Schema.Int),
    next: Schema.NullOr(Schema.Int),
    index: Schema.Int,
    total: Schema.Int,
  }),
});

const decodeResponse = <
  S extends Schema.Top & { readonly DecodingServices: never },
>(
  schema: S,
  response: Response
) =>
  Effect.promise(() => response.json()).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(schema))
  );

const fixture = Effect.fn("fixture")(function* fixture(gate?: string) {
  const db = yield* Effect.acquireRelease(
    Effect.sync(() => {
      const database = new DatabaseSync(":memory:");
      database.exec(
        readFileSync(
          new URL(
            "../../../packages/database/baseline/chromescribe/schema.sql",
            import.meta.url
          ),
          "utf-8"
        )
      );

      const insert = database.prepare(
        "INSERT INTO transcripts(id, video_id, title, channel, duration, srt_path, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      );

      for (let id = 1; id <= 7; id += 1) {
        insert.run(
          id,
          `video-${id}`,
          `Title ${id}`,
          "Channel",
          61,
          `content/${id}.md`,
          "AI",
          "2025-05-05 05:05:05"
        );
      }

      return database;
    }),
    (database) =>
      Effect.sync(() => {
        database.close();
      })
  );

  const DB = {
    prepare: (sql: string) => ({
      bind: (...params: (string | number | null)[]) => ({
        all: () => Promise.resolve({ results: db.prepare(sql).all(...params) }),
      }),
    }),
  };

  const markdown = new Map([
    [
      "content/4.md",
      "# Title\n\n**Source:** https://example.com/article\nwords",
    ],
    ["content/3.md", "No source"],
  ]);

  const content = TranscriptContentStore.memory(
    markdown,
    new Map([
      [
        "video-4",
        { bytes: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" },
      ],
    ])
  );

  const server = transcriptServer(
    Layer.mergeAll(
      d1TranscriptLayer(DB),
      content,
      accessVerifierLayer({ CHRO10_API_GATE: gate ?? "0" })
    )
  );

  yield* Effect.addFinalizer(() => Effect.promise(server.dispose));

  const call = (path: string, init?: RequestInit) =>
    Effect.promise(() =>
      server.handler(
        new Request(`https://next.chromescribe.yeoux.net${path}`, init)
      )
    );

  return { call, DB };
});

it.effect("serves bounded formatted pages, filters and conditional ETags", () =>
  Effect.gen(function* pages() {
    const { call, DB } = yield* fixture();
    const first = yield* call("/api/transcripts?limit=3");
    const body = yield* decodeResponse(ListBody, first);
    expect(body.data.map((row) => row.id)).toEqual([7, 6, 5]);
    expect(body.total).toBe(7);
    expect(body.data[0]?.duration_formatted).toBe("1:01");
    expect(body.data[0]?.created_at_formatted).toContain("2025");
    const etag = first.headers.get("ETag");
    expect(etag).toMatch(/^"[a-f0-9]{64}"$/u);
    expect(first.headers.get("Cache-Control")).toBe("private, no-cache");

    const again = yield* call("/api/transcripts?limit=3", {
      headers: { "If-None-Match": `W/${etag}` },
    });

    expect(again.status).toBe(304);
    expect(yield* Effect.promise(() => again.text())).toBe("");
    yield* Effect.promise(() =>
      DB.prepare("UPDATE transcripts SET title = ? WHERE id = ?")
        .bind("Changed", 7)
        .all()
    );

    const changed = yield* call("/api/transcripts?limit=3", {
      headers: { "If-None-Match": etag ?? "" },
    });

    expect(changed.status).toBe(200);
    expect(changed.headers.get("ETag")).not.toBe(etag);
    expect(yield* Effect.promise(() => changed.text())).toContain("Changed");
    expect(
      (yield* decodeResponse(
        ListBody,
        yield* call("/api/transcripts?limit=3&offset=3")
      )).data.map((row) => row.id)
    ).toEqual([4, 3, 2]);
    expect(
      (yield* decodeResponse(
        ListBody,
        yield* call("/api/transcripts?video_id=video-1")
      )).data.map((row) => row.id)
    ).toEqual([1]);
    expect((yield* call("/api/transcripts?limit=abc")).status).toBe(200);
    expect(
      (yield* decodeResponse(
        ListBody,
        yield* call("/api/transcripts?limit=1tail")
      )).data
    ).toHaveLength(1);
  })
);

it.effect(
  "serves metadata, content, source redirects and typed missing records",
  () =>
    Effect.gen(function* detail() {
      const { call } = yield* fixture();
      const meta = yield* call("/api/transcripts/4");
      expect(yield* Effect.promise(() => meta.text())).toContain(
        '"srt_path":"content/4.md"'
      );
      const content = yield* call("/api/transcript/4/content");
      expect(content.headers.get("Content-Type")).toBe("text/plain");
      expect(yield* Effect.promise(() => content.text())).toContain("words");
      const source = yield* call("/api/transcripts/4/source");
      expect(source.status).toBe(302);
      expect(source.headers.get("Location")).toBe(
        "https://example.com/article"
      );

      const noSource = yield* call("/api/transcripts/3/source");

      expect(yield* Effect.promise(() => noSource.text())).toBe(
        "Source not found"
      );

      for (const path of [
        "/api/transcripts/99",
        "/api/transcripts/99/source",
        "/api/transcript/99/content",
        "/api/transcript/2/content",
        "/api/transcripts/3/source",
      ]) {
        expect((yield* call(path)).status).toBe(404);
      }
    })
);

it.effect(
  "reads neighbours, search, category counts and cached thumbnails",
  () =>
    Effect.gen(function* reads() {
      const { call } = yield* fixture();
      expect(
        (yield* decodeResponse(
          NavigationBody,
          yield* call("/api/transcripts?around=4")
        )).data
      ).toEqual({ prev: 5, next: 3, index: 3, total: 7 });
      expect((yield* call("/api/transcripts?around=99")).status).toBe(404);
      const search = yield* call("/api/search?q=Title%201");
      expect(yield* Effect.promise(() => search.text())).toContain(
        '"video_id":"video-1"'
      );
      expect((yield* call("/api/search")).status).toBe(400);
      const categories = yield* call("/api/categories");
      expect(yield* Effect.promise(() => categories.text())).toContain(
        '"count":7'
      );
      const thumb = yield* call("/api/thumb/video-4");
      expect(thumb.headers.get("Content-Type")).toBe("image/jpeg");
      expect(
        new Uint8Array(yield* Effect.promise(() => thumb.arrayBuffer()))
      ).toEqual(new Uint8Array([1, 2, 3]));
      expect((yield* call("/api/thumb/unknown")).status).toBe(404);
    })
);

it.effect(
  "dispatches the same handlers through generated HTTP and real RPC transport",
  () =>
    Effect.gen(function* projections() {
      const { call } = yield* fixture();

      const generated = yield* call("/getTranscript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: 4 }),
      });

      expect(generated.status).toBe(200);
      expect(yield* Effect.promise(() => generated.text())).toContain(
        '"title":"Title 4"'
      );

      const rpc = yield* call("/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          RpcRequest.make({
            id: "1",
            tag: "getTranscript",
            payload: { id: 4 },
            headers: [],
          })
        ),
      });

      expect(rpc.status).toBe(200);
      expect(yield* Effect.promise(() => rpc.text())).toContain(
        '"title":"Title 4"'
      );

      const invalid = yield* call("/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          RpcRequest.make({
            id: "2",
            tag: "getTranscript",
            payload: { id: "invalid" },
            headers: [],
          })
        ),
      });

      expect(yield* Effect.promise(() => invalid.text())).toContain(
        '"Failure"'
      );
    })
);

it.effect(
  "gates every API, RPC and generated route, adds no CORS and refuses writes",
  () =>
    Effect.gen(function* security() {
      const { call } = yield* fixture("1");

      for (const path of [
        "/api/health",
        "/api/transcripts",
        "/rpc",
        "/getTranscript",
      ]) {
        const response = yield* call(path);
        expect(response.status).toBe(401);
        expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
      }

      const open = yield* fixture();

      for (const method of ["POST", "DELETE", "PATCH", "OPTIONS"]) {
        const response = yield* open.call("/api/transcripts/4", { method });
        expect(response.status).not.toBe(200);
        expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
      }
    })
);

it.effect(
  "keeps public report reads outside Access and extracts only complete HTTP source lines",
  () =>
    Effect.gen(function* publicReports() {
      const { DB } = yield* fixture("1");

      const report = yield* Effect.promise(() =>
        handleRequest(
          new Request(
            "https://next.chromescribe.yeoux.net/reports/abcdefabcdef"
          ),
          {
            DB,
            TRANSCRIPTS: {
              get: () =>
                Promise.resolve({
                  text: () => Promise.resolve("<h1>Report</h1>"),
                  arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
                }),
            },
          }
        )
      );

      expect(report.status).toBe(200);
      expect(report.headers.has("Access-Control-Allow-Origin")).toBe(false);

      for (const value of [
        // oxlint-disable-next-line no-script-url -- This malicious fixture proves source redirects reject script URLs.
        "javascript:alert(1)",
        "//example.com",
        "https://",
        "https://example.com extra",
        "file:///tmp/a",
      ]) {
        expect(extractSourceUrl(`**Source:** ${value}`)).toBeNull();
      }

      expect(
        extractSourceUrl("**Source:** https://example.com/a?q=1#x\r\n")
      ).toBe("https://example.com/a?q=1#x");
    })
);
