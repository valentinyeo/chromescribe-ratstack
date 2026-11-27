import { implement } from "@chromescribe/capability/implement";
import { Effect } from "effect";

import {
  getTranscriptAroundContract,
  getTranscriptContentContract,
  getTranscriptContract,
  getTranscriptThumbnailContract,
  listCategoriesContract,
  listTranscriptsContract,
  searchTranscriptsContract,
} from "./contracts.js";
import { TranscriptContentStore, TranscriptRepository } from "./transcripts.js";

export const listTranscripts = implement(listTranscriptsContract, (input) =>
  TranscriptRepository.pipe(
    Effect.flatMap((repository) => repository.list(input))
  )
);

export const getTranscript = implement(getTranscriptContract, ({ id }) =>
  TranscriptRepository.pipe(
    Effect.flatMap((repository) => repository.getById(id))
  )
);

export const getTranscriptAround = implement(
  getTranscriptAroundContract,
  ({ id }) =>
    TranscriptRepository.pipe(
      Effect.flatMap((repository) => repository.getAround(id))
    )
);

export const getTranscriptContent = implement(
  getTranscriptContentContract,
  Effect.fn("getTranscriptContent")(function* getTranscriptContent({
    id,
  }: {
    readonly id: number;
  }) {
    const repository = yield* TranscriptRepository;
    const content = yield* TranscriptContentStore;
    const transcript = yield* repository.getById(id);

    return yield* content.readMarkdown(transcript.srt_path);
  })
);

export const searchTranscripts = implement(
  searchTranscriptsContract,
  ({ query }) =>
    TranscriptRepository.pipe(
      Effect.flatMap((repository) => repository.search(query))
    )
);

export const listCategories = implement(listCategoriesContract, () =>
  TranscriptRepository.pipe(
    Effect.flatMap((repository) => repository.listCategories())
  )
);

export const getTranscriptThumbnail = implement(
  getTranscriptThumbnailContract,
  ({ videoId }) =>
    TranscriptContentStore.pipe(
      Effect.flatMap((content) => content.getThumbnail(videoId))
    )
);

export const transcriptCapabilities = [
  listTranscripts,
  getTranscript,
  getTranscriptAround,
  getTranscriptContent,
  searchTranscripts,
  listCategories,
  getTranscriptThumbnail,
] as const;
