import { Schema } from "effect";

export class TranscriptContentNotFound extends Schema.TaggedError<
  TranscriptContentNotFound,
  { readonly brand: unique symbol }
>()("TranscriptContentNotFound", { key: Schema.String }) {}
