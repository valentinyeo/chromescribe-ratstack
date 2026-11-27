# ChromeScribe

ChromeScribe makes Valentin's saved video transcripts and articles readable and searchable. Existing ingestion owns the data. Rat Stack provides the typed services, read-only backend and Foldkit interface that will replace the dashboard in small slices.

## First outcome

A read-only Foldkit preview at https://next.chromescribe.yeoux.net shows real transcript metadata and markdown behind Cloudflare Access. The production site at https://chromescribe.yeoux.net remains unchanged. Never show a workers.dev address.

This foundation slice declares infrastructure and supplies the read interfaces. It does not deploy, change Access policies, ingest content, transcribe audio, generate summaries, change subscriptions, mutate the queue, or write reports.

## Data ownership

- Existing D1 database `chromescribe` owns transcript metadata, queue entries, channels and report metadata. Its schema stays unchanged.
- Existing R2 bucket `chromescribe-transcripts` owns transcript markdown, cached thumbnails and public report HTML.
- The legacy ingestion and dashboard remain the only writers. The preview has no write operations or automatic migrations.
- Lists, counts, navigation and search are calculated from D1 on demand. There is no copied database or new source of truth.

## Runtime boundaries

Core defines schemas, job-shaped ports and shared read capabilities. The database cartridge implements bounded SQLite/D1 reads. The Worker supplies R2 reads and RS256 Cloudflare Access verification. HTTP compatibility routes and generated HTTP/RPC surfaces call the same capability handlers. Foldkit reaches the private backend through a service binding, including during server rendering.

Access stays in front of the preview. The backend independently checks Access assertions by default, fails closed without its audience, and sends no CORS headers. Public `/reports/:id` reads remain outside the backend JWT gate.

## Proof and release

All TypeScript, lint, formatting, test and build checks run on GitHub Actions `ubuntu-latest`, through Turbo with run summaries. This shared server is for editing and Git, never the full fence. Code has no prose comments.

Before a later deployment, review an Alchemy plan with the correct account and named profile. Adopt and retain the existing database and bucket without registering or replaying migrations. Deploying, replacing resources, changing Access policies and deleting live data require separate approval. This slice stops at a green, ready-for-review PR.
