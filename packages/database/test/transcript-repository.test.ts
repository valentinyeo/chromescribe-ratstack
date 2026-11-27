// @effect-diagnostics-next-line nodeBuiltinImport:off -- This adapter seam reads its immutable fixture schema and uses the host runtime.
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import {
  TranscriptNotFound,
  TranscriptRepository,
  TranscriptStorageError,
} from "@chromescribe/core/transcripts";
import { expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";

import { transcriptRepositoryLayer } from "../src/transcript-repository.js";

const sqliteLayer = Layer.unwrap(
  Effect.gen(function* sqliteLayer() {
    const database = yield* Effect.acquireRelease(
      Effect.sync(() => {
        const connection = new DatabaseSync(":memory:");
        connection.exec(
          readFileSync(
            new URL("../baseline/chromescribe/schema.sql", import.meta.url),
            "utf-8"
          )
        );

        const insert = connection.prepare(
          "INSERT INTO transcripts(id, video_id, title, channel, duration, srt_path, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );

        for (let id = 1; id <= 520; id += 1) {
          insert.run(
            id,
            `video-${id}`,
            `Title ${id}`,
            id % 2 ? "Odd" : "Even",
            id * 60,
            `content/${id}.md`,
            id % 2 ? "Health" : "AI",
            "2025-05-05 05:05:05"
          );
        }

        return connection;
      }),
      (connection) =>
        Effect.sync(() => {
          connection.close();
        })
    );

    return transcriptRepositoryLayer({
      query: (sql, params) =>
        Effect.try({
          try: () => database.prepare(sql).all(...params),
          catch: (cause) =>
            new TranscriptStorageError({ cause, operation: "sqlite.query" }),
        }).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(Schema.Json))),
          Effect.mapError(
            (cause) =>
              new TranscriptStorageError({ cause, operation: "sqlite.decode" })
          )
        ),
    });
  })
);

it.layer(sqliteLayer)("transcript repository", (test) => {
  test.effect(
    "pages tied timestamps without gaps, exposes only card fields and reports total",
    () =>
      Effect.gen(function* pagination() {
        const repository = yield* TranscriptRepository;
        const first = yield* repository.list({ limit: 3 });
        const second = yield* repository.list({ limit: 3, offset: 3 });
        expect(first.data.map((row) => row.id)).toEqual([520, 519, 518]);
        expect(second.data.map((row) => row.id)).toEqual([517, 516, 515]);
        expect(first.total).toBe(520);
        expect(first.data[0]).not.toHaveProperty("srt_path");
        expect((yield* repository.list({ offset: 999 })).data).toEqual([]);
      })
  );

  test.effect("clamps page limits and negative offsets", () =>
    Effect.gen(function* bounds() {
      const repository = yield* TranscriptRepository;
      expect((yield* repository.list({ limit: 9000 })).data).toHaveLength(500);
      expect(
        (yield* repository.list({ limit: 0, offset: -10 })).data.map(
          (row) => row.id
        )
      ).toEqual([520]);
      expect((yield* repository.list({})).data).toHaveLength(500);
    })
  );

  test.effect("locates adjacent records and both ends with timestamp ties", () =>
    Effect.gen(function* around() {
      const repository = yield* TranscriptRepository;
      expect(yield* repository.getAround(519)).toEqual({
        prev: 520,
        next: 518,
        index: 1,
        total: 520,
      });
      expect(yield* repository.getAround(520)).toEqual({
        prev: null,
        next: 519,
        index: 0,
        total: 520,
      });
      expect(yield* repository.getAround(1)).toEqual({
        prev: 2,
        next: null,
        index: 519,
        total: 520,
      });
    })
  );

  test.effect(
    "filters video identifiers and channels before pagination and count",
    () =>
      Effect.gen(function* filters() {
        const repository = yield* TranscriptRepository;
        expect(
          (yield* repository.list({ videoId: "video-3" })).data.map(
            (row) => row.id
          )
        ).toEqual([3]);
        expect(
          (yield* repository.list({ channel: "Odd", limit: 2 })).total
        ).toBe(260);
        expect((yield* repository.findByVideoId("video-3"))[0]?.srt_path).toBe(
          "content/3.md"
        );
        expect(yield* repository.findByVideoId("missing")).toEqual([]);
      })
  );

  test.effect(
    "searches title, channel and video identifier outside the first page",
    () =>
      Effect.gen(function* search() {
        const repository = yield* TranscriptRepository;
        expect(
          (yield* repository.search("Title 1")).some((row) => row.id === 1)
        ).toBe(true);
        expect(yield* repository.search("Odd")).toHaveLength(260);
        expect(
          (yield* repository.search("video-520")).map((row) => row.id)
        ).toEqual([520]);
        expect(yield* repository.search("' OR 1=1 --")).toEqual([]);
        expect(yield* repository.search("%")).toHaveLength(500);
      })
  );

  test.effect("counts nonempty categories", () =>
    Effect.gen(function* categories() {
      const repository = yield* TranscriptRepository;
      expect(yield* repository.listCategories()).toEqual([
        { category: "AI", count: 260 },
        { category: "Health", count: 260 },
      ]);
    })
  );

  test.effect("returns a typed missing transcript failure", () =>
    Effect.gen(function* missing() {
      const repository = yield* TranscriptRepository;
      expect(
        Schema.is(TranscriptNotFound)(
          yield* repository.getById(9999).pipe(Effect.flip)
        )
      ).toBe(true);
      expect(
        Schema.is(TranscriptNotFound)(
          yield* repository.getAround(9999).pipe(Effect.flip)
        )
      ).toBe(true);
    })
  );
});
