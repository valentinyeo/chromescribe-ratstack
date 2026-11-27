import { Context, Effect, Layer } from "effect";

import { TranscriptContentNotFound } from "./transcript-content-not-found.js";
import type { TranscriptStorageError } from "./transcript-storage-error.js";

export interface TranscriptThumbnail {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly contentType: string;
}

export class TranscriptContentStore extends Context.Service<
  TranscriptContentStore,
  {
    readonly readMarkdown: (
      srtPath: string
    ) => Effect.Effect<
      string,
      TranscriptContentNotFound | TranscriptStorageError
    >;
    readonly getThumbnail: (
      videoId: string
    ) => Effect.Effect<
      TranscriptThumbnail,
      TranscriptContentNotFound | TranscriptStorageError
    >;
  }
>()("@chromescribe/core/TranscriptContentStore") {
  static readonly memory = (
    markdown: ReadonlyMap<string, string>,
    thumbnails: ReadonlyMap<string, TranscriptThumbnail> = new Map()
  ) =>
    Layer.succeed(TranscriptContentStore, {
      readMarkdown: (key) => {
        const content = markdown.get(key);

        return content === undefined
          ? Effect.fail(new TranscriptContentNotFound({ key }))
          : Effect.succeed(content);
      },
      getThumbnail: (key) => {
        const content = thumbnails.get(key);

        return content === undefined
          ? Effect.fail(new TranscriptContentNotFound({ key }))
          : Effect.succeed(content);
      },
    });
}
