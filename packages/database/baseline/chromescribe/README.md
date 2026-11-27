# Existing ChromeScribe storage

This directory is a record, not a deployable migration set. No Alchemy resource registers it. The preview executes only SELECT statements.

`schema.sql` preserves the legacy transcript and expanded queue definitions, followed by the channel and report definitions created by the legacy Worker. `0001_queue.sql` is the original queue migration, copied unchanged. Never replay it on live D1. The old migration alone lacks the queue lifecycle columns; legacy ingestion already owns those upgrades.

`src/schema/chromescribe.ts` describes the same four tables in Drizzle. SQLite stores legacy `DATETIME` columns as timestamp text. No new table, index, constraint, or DDL is applied to the adopted database.

## Read limits

Lists clamp limits to 1–500 and nonnegative offsets. Summaries use the legacy paged `LIST_COLUMNS`, ordered by `created_at DESC, id DESC`. Unlike the legacy unpaged list, even an omitted limit is bounded and excludes storage paths. Responses always include a filtered total. Video and channel filters combine before pagination. Search and category aggregation return at most 500 rows.

Neighbour navigation uses the legacy timestamp and id comparisons. The video-id index handles exact matches; the created-at index supports ordering, with a secondary id sort for timestamp ties. LIKE substring search, category counts and neighbour positions can scan the existing table. These are bounded outputs, not claims of bounded scanned work. No production query-plan measurement or live resource verification has been performed in this code-only slice.

Thumbnails read existing `thumbs/<sanitized-video-id>.jpg` objects only. A cache miss returns 404 rather than fetching external media and filling R2. Transcript content uses the row's exact `srt_path`. Public report reads use `reports/<12-hex-id>.html` and do not invoke the JWT gate.

## Verification

GitHub Actions runs the full Rat Stack fence. Adapter tests use real in-memory SQLite with this schema. Worker tests exercise HTTP compatibility, generated HTTP, RPC transport and Access denial. Access tests generate and sign real Web Crypto RSA keypairs. No checks or builds run on the shared editing server.

Before any later deploy, inspect the Alchemy plan under the Yeo UX account, verify the existing D1 id and bucket name, ensure both resources are adopted and retained with no migrations, and confirm the preview hostname has Cloudflare Access protection. The production hostname must remain untouched.
