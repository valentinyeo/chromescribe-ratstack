import { Schema } from "effect";

export class TranscriptStorageError extends Schema.TaggedError<
  TranscriptStorageError,
  { readonly brand: unique symbol }
>()("TranscriptStorageError", {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {}
