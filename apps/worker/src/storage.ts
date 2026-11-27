import {
  TranscriptContentNotFound,
  TranscriptContentStore,
  TranscriptStorageError,
} from "@chromescribe/core";
import { transcriptRepositoryLayer } from "@chromescribe/database";
import { Effect, Layer, Schema } from "effect";

export interface TranscriptDatabase {
  readonly prepare: (sql: string) => {
    readonly bind: (...params: (string | number | null)[]) => {
      readonly all: () => Promise<{ readonly results: unknown }>;
    };
  };
}

export interface TranscriptBucket {
  readonly get: (key: string) => Promise<{
    readonly text: () => Promise<string>;
    readonly arrayBuffer: () => Promise<ArrayBuffer>;
    readonly httpMetadata?: { readonly contentType?: string };
  } | null>;
}

export const d1TranscriptLayer = (database: TranscriptDatabase) =>
  transcriptRepositoryLayer({
    query: (sql, params) =>
      Effect.tryPromise({
        try: () =>
          database
            .prepare(sql)
            .bind(...params)
            .all(),
        catch: (cause) =>
          new TranscriptStorageError({ cause, operation: "d1.query" }),
      }).pipe(
        Effect.flatMap((result) =>
          Schema.decodeUnknownEffect(Schema.Array(Schema.Json))(result.results)
        ),
        Effect.mapError(
          (cause) =>
            new TranscriptStorageError({ cause, operation: "d1.decode" })
        )
      ),
  });

export const r2ContentLayer = (bucket: TranscriptBucket) => {
  const read = Effect.fn("TranscriptContentStore.read")(function* read(
    key: string
  ) {
    const object = yield* Effect.tryPromise({
      try: () => bucket.get(key),
      catch: (cause) =>
        new TranscriptStorageError({ cause, operation: "r2.get" }),
    });

    if (!object) {
      return yield* new TranscriptContentNotFound({ key });
    }
    return object;
  });

  return Layer.succeed(TranscriptContentStore, {
    readMarkdown: Effect.fn("TranscriptContentStore.readMarkdown")(
      function* readMarkdown(key: string) {
        const object = yield* read(key);

        return yield* Effect.tryPromise({
          try: () => object.text(),
          catch: (cause) =>
            new TranscriptStorageError({ cause, operation: "r2.text" }),
        });
      }
    ),
    getThumbnail: Effect.fn("TranscriptContentStore.getThumbnail")(
      function* getThumbnail(videoId: string) {
        const object = yield* read(
          `thumbs/${videoId.replaceAll(/[^a-zA-Z0-9_:-]/gu, "_")}.jpg`
        );

        const buffer = yield* Effect.tryPromise({
          try: () => object.arrayBuffer(),
          catch: (cause) =>
            new TranscriptStorageError({ cause, operation: "r2.arrayBuffer" }),
        });

        return {
          bytes: new Uint8Array(buffer),
          contentType: object.httpMetadata?.contentType || "image/jpeg",
        };
      }
    ),
  });
};
