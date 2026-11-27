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
  Effect.flatMap(TranscriptRepository, (repository) => repository.list(input))
);

export const getTranscript = implement(getTranscriptContract, ({ id }) =>
  Effect.flatMap(TranscriptRepository, (repository) => repository.getById(id))
);

export const getTranscriptAround = implement(
  getTranscriptAroundContract,
  ({ id }) =>
    Effect.flatMap(TranscriptRepository, (repository) =>
      repository.getAround(id)
    )
);

export const getTranscriptContent = implement(
  getTranscriptContentContract,
  Effect.fn("getTranscriptContent")(function* getTranscriptContent({ id }) {
    const repository = yield* TranscriptRepository;
    const content = yield* TranscriptContentStore;
    const transcript = yield* repository.getById(id);
    return yield* content.readMarkdown(transcript.srt_path);
  })
);

export const searchTranscripts = implement(
  searchTranscriptsContract,
  ({ query }) =>
    Effect.flatMap(TranscriptRepository, (repository) =>
      repository.search(query)
    )
);

export const listCategories = implement(listCategoriesContract, () =>
  Effect.flatMap(TranscriptRepository, (repository) =>
    repository.listCategories()
  )
);

export const getTranscriptThumbnail = implement(
  getTranscriptThumbnailContract,
  ({ videoId }) =>
    Effect.flatMap(TranscriptContentStore, (content) =>
      content.getThumbnail(videoId)
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
