import { Context, Effect, Layer, Schema } from "effect";

export const TranscriptSummary = Schema.Struct({
  id: Schema.Int,
  video_id: Schema.String,
  title: Schema.String,
  channel: Schema.NullOr(Schema.String),
  duration: Schema.NullOr(Schema.Int),
  word_count: Schema.NullOr(Schema.Int),
  created_at: Schema.NullOr(Schema.String),
  category: Schema.NullOr(Schema.String),
  tags: Schema.NullOr(Schema.String),
});

export type TranscriptSummary = typeof TranscriptSummary.Type;

export const TranscriptDetail = Schema.Struct({
  ...TranscriptSummary.fields,
  srt_path: Schema.String,
  thumbnail_url: Schema.NullOr(Schema.String),
});

export type TranscriptDetail = typeof TranscriptDetail.Type;

export const TranscriptAround = Schema.Struct({
  prev: Schema.NullOr(Schema.Int),
  next: Schema.NullOr(Schema.Int),
  index: Schema.Int,
  total: Schema.Int,
});

export const CategoryCount = Schema.Struct({
  category: Schema.String,
  count: Schema.Int,
});

export const TranscriptListResult = Schema.Struct({
  data: Schema.Array(TranscriptSummary),
  total: Schema.Int,
});

export const TranscriptListInput = Schema.Struct({
  limit: Schema.optionalKey(Schema.Finite),
  offset: Schema.optionalKey(Schema.Finite),
  videoId: Schema.optionalKey(Schema.String),
  channel: Schema.optionalKey(Schema.String),
});

export class TranscriptNotFound extends Schema.TaggedError<TranscriptNotFound>()(
  "TranscriptNotFound",
  { id: Schema.Int }
) {}

export class TranscriptStorageError extends Schema.TaggedError<TranscriptStorageError>()(
  "TranscriptStorageError",
  { operation: Schema.String, cause: Schema.Defect() }
) {}

export class TranscriptContentNotFound extends Schema.TaggedError<TranscriptContentNotFound>()(
  "TranscriptContentNotFound",
  { key: Schema.String }
) {}

export const TranscriptFailure = Schema.Union([
  TranscriptNotFound,
  TranscriptStorageError,
  TranscriptContentNotFound,
]);

export type TranscriptFailure = typeof TranscriptFailure.Type;

export class TranscriptRepository extends Context.Service<TranscriptRepository, {
  readonly list: (input: typeof TranscriptListInput.Type) => Effect.Effect<typeof TranscriptListResult.Type, TranscriptStorageError>;
  readonly getById: (id: number) => Effect.Effect<TranscriptDetail, TranscriptNotFound | TranscriptStorageError>;
  readonly getAround: (id: number) => Effect.Effect<typeof TranscriptAround.Type, TranscriptNotFound | TranscriptStorageError>;
  readonly findByVideoId: (videoId: string) => Effect.Effect<readonly TranscriptDetail[], TranscriptStorageError>;
  readonly search: (query: string) => Effect.Effect<readonly TranscriptDetail[], TranscriptStorageError>;
  readonly listCategories: () => Effect.Effect<readonly (typeof CategoryCount.Type)[], TranscriptStorageError>;
}>()("@chromescribe/core/TranscriptRepository") {}

export interface TranscriptThumbnail {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly contentType: string;
}

export class TranscriptContentStore extends Context.Service<TranscriptContentStore, {
  readonly readMarkdown: (srtPath: string) => Effect.Effect<string, TranscriptContentNotFound | TranscriptStorageError>;
  readonly getThumbnail: (videoId: string) => Effect.Effect<TranscriptThumbnail, TranscriptContentNotFound | TranscriptStorageError>;
}>()("@chromescribe/core/TranscriptContentStore") {
  static readonly memory = (
    markdown: ReadonlyMap<string, string>,
    thumbnails: ReadonlyMap<string, TranscriptThumbnail> = new Map()
  ) => Layer.succeed(TranscriptContentStore, {
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

export class AccessVerifier extends Context.Service<AccessVerifier, {
  readonly verify: (assertion: string | null) => Effect.Effect<boolean>;
}>()("@chromescribe/core/AccessVerifier") {}
