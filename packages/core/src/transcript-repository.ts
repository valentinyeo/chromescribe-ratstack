import { Context } from "effect";
import type { Effect } from "effect";

import type { CategoryCount, TranscriptAround, TranscriptDetail, TranscriptListInput, TranscriptListResult } from "./transcripts.js";
import type { TranscriptNotFound } from "./transcript-not-found.js";
import type { TranscriptStorageError } from "./transcript-storage-error.js";

export class TranscriptRepository extends Context.Service<
  TranscriptRepository,
  {
    readonly list: (
      input: typeof TranscriptListInput.Type
    ) => Effect.Effect<
      typeof TranscriptListResult.Type,
      TranscriptStorageError
    >;
    readonly getById: (
      id: number
    ) => Effect.Effect<
      TranscriptDetail,
      TranscriptNotFound | TranscriptStorageError
    >;
    readonly getAround: (
      id: number
    ) => Effect.Effect<
      typeof TranscriptAround.Type,
      TranscriptNotFound | TranscriptStorageError
    >;
    readonly findByVideoId: (
      videoId: string
    ) => Effect.Effect<readonly TranscriptDetail[], TranscriptStorageError>;
    readonly search: (
      query: string
    ) => Effect.Effect<readonly TranscriptDetail[], TranscriptStorageError>;
    readonly listCategories: () => Effect.Effect<
      readonly (typeof CategoryCount.Type)[],
      TranscriptStorageError
    >;
  }
>()("@chromescribe/core/TranscriptRepository") {}
