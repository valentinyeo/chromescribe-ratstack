import {
  CategoryCount,
  TranscriptDetail,
  TranscriptListInput,
  TranscriptNotFound,
  TranscriptRepository,
  TranscriptStorageError,
  TranscriptSummary,
} from "@chromescribe/core";
import { Effect, Layer, Schema } from "effect";

export interface TranscriptSql {
  readonly query: (
    sql: string,
    params: readonly (string | number | null)[]
  ) => Effect.Effect<readonly Schema.Json[], TranscriptStorageError>;
}

const listColumns =
  "id, video_id, title, channel, duration, word_count, created_at, category, tags";
const detailColumns = `${listColumns}, srt_path, thumbnail_url`;
const Count = Schema.Struct({ total: Schema.Int });
const Id = Schema.Struct({ id: Schema.Int });

export const transcriptRepositoryLayer = (sql: TranscriptSql) => {
  const summaries = Effect.fn("TranscriptRepository.summaries")(
    function* summaries(
      statement: string,
      params: readonly (string | number | null)[]
    ) {
      const rows = yield* sql.query(statement, params);
      return yield* Schema.decodeUnknownEffect(Schema.Array(TranscriptSummary))(
        rows
      ).pipe(
        Effect.mapError(
          (cause) =>
            new TranscriptStorageError({ cause, operation: "decodeSummary" })
        )
      );
    }
  );
  const details = Effect.fn("TranscriptRepository.details")(function* details(
    statement: string,
    params: readonly (string | number | null)[]
  ) {
    const rows = yield* sql.query(statement, params);
    return yield* Schema.decodeUnknownEffect(Schema.Array(TranscriptDetail))(
      rows
    ).pipe(
      Effect.mapError(
        (cause) =>
          new TranscriptStorageError({ cause, operation: "decodeDetail" })
      )
    );
  });
  const count = Effect.fn("TranscriptRepository.count")(function* count(
    where: string,
    params: readonly (string | number | null)[]
  ) {
    const rows = yield* sql.query(
      `SELECT COUNT(*) AS total FROM transcripts ${where}`,
      params
    );
    const result = yield* Schema.decodeUnknownEffect(
      Schema.NonEmptyArray(Count)
    )(rows).pipe(
      Effect.mapError(
        (cause) => new TranscriptStorageError({ cause, operation: "count" })
      )
    );
    return result[0].total;
  });
  const getById = Effect.fn("TranscriptRepository.getById")(function* getById(
    id: number
  ) {
    const rows = yield* details(
      `SELECT ${detailColumns} FROM transcripts WHERE id = ? LIMIT 1`,
      [id]
    );
    const row = rows[0];
    if (!row) return yield* new TranscriptNotFound({ id });
    return row;
  });
  const neighbour = Effect.fn("TranscriptRepository.neighbour")(
    function* neighbour(
      where: string,
      order: string,
      params: readonly (string | number | null)[]
    ) {
      const rows = yield* sql.query(
        `SELECT id FROM transcripts WHERE ${where} ORDER BY created_at ${order}, id ${order} LIMIT 1`,
        params
      );
      const decoded = yield* Schema.decodeUnknownEffect(Schema.Array(Id))(
        rows
      ).pipe(
        Effect.mapError(
          (cause) =>
            new TranscriptStorageError({ cause, operation: "neighbour" })
        )
      );
      return decoded[0]?.id ?? null;
    }
  );

  return Layer.succeed(TranscriptRepository, {
    list: Effect.fn("TranscriptRepository.list")(function* list(
      input: typeof TranscriptListInput.Type
    ) {
      const limit = Math.min(500, Math.max(1, Math.trunc(input.limit ?? 500)));
      const offset = Math.max(0, Math.trunc(input.offset ?? 0));
      const clauses: string[] = [];
      const params: (string | number)[] = [];
      if (input.videoId) {
        clauses.push("video_id = ?");
        params.push(input.videoId);
      }
      if (input.channel) {
        clauses.push("channel = ?");
        params.push(input.channel);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const data = yield* summaries(
        `SELECT ${listColumns} FROM transcripts ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );
      const total = yield* count(where, params);
      return { data, total };
    }),
    getById,
    getAround: Effect.fn("TranscriptRepository.getAround")(function* getAround(
      id: number
    ) {
      const current = yield* getById(id);
      const params = [current.created_at, current.created_at, current.id];
      const newer = "created_at > ? OR (created_at = ? AND id > ?)";
      const older = "created_at < ? OR (created_at = ? AND id < ?)";
      const prev = yield* neighbour(newer, "ASC", params);
      const next = yield* neighbour(older, "DESC", params);
      const index = yield* count(`WHERE ${newer}`, params);
      const total = yield* count("", []);
      return { prev, next, index, total };
    }),
    findByVideoId: (videoId) =>
      details(
        `SELECT ${detailColumns} FROM transcripts WHERE video_id = ? LIMIT 1`,
        [videoId]
      ),
    search: (query) =>
      details(
        `SELECT ${detailColumns} FROM transcripts WHERE title LIKE ? OR channel LIKE ? OR video_id LIKE ? ORDER BY created_at DESC, id DESC LIMIT 500`,
        [`%${query}%`, `%${query}%`, `%${query}%`]
      ),
    listCategories: Effect.fn("TranscriptRepository.listCategories")(
      function* listCategories() {
        const rows = yield* sql.query(
          "SELECT category, COUNT(*) AS count FROM transcripts WHERE category IS NOT NULL AND category != '' GROUP BY category ORDER BY count DESC, category ASC LIMIT 500",
          []
        );
        return yield* Schema.decodeUnknownEffect(Schema.Array(CategoryCount))(
          rows
        ).pipe(
          Effect.mapError(
            (cause) =>
              new TranscriptStorageError({ cause, operation: "listCategories" })
          )
        );
      }
    ),
  });
};
