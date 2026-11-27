import { Schema } from "effect";

export class TranscriptNotFound extends Schema.TaggedError<
  TranscriptNotFound,
  { readonly brand: unique symbol }
>()("TranscriptNotFound", { id: Schema.Int }) {}
