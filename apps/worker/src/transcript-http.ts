import {
  getTranscript,
  getTranscriptAround,
  getTranscriptContent,
  getTranscriptThumbnail,
  listCategories,
  listTranscripts,
  searchTranscripts,
} from "@chromescribe/core";
import type { TranscriptSummary } from "@chromescribe/core";
import { DateTime, Effect, Option } from "effect";
import * as Digest from "effect/crypto/Digest";

const json = (data: object) => Response.json({ success: true, data });
const missing = (error: string, status = 404) => Response.json({ success: false, error }, { status });

const formatDuration = (duration: number | null) => {
  const seconds = duration ?? 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const tail = `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${tail.padStart(5, "0")}` : tail;
};

const listItem = (transcript: TranscriptSummary) => ({
  ...transcript,
  duration_formatted: formatDuration(transcript.duration),
  created_at_formatted: Option.match(DateTime.make(transcript.created_at ?? ""), {
    onNone: () => "Invalid Date",
    onSome: (date) => DateTime.formatUtc(date, {
      locale: "en-US", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    }),
  }),
});

export const extractSourceUrl = (markdown: string) => {
  const source = /^\*\*Source:\*\*[ \t]+(https?:\/\/[^\s<>]+)[ \t]*\r?$/mu.exec(markdown)?.[1];
  return source && URL.canParse(source) ? new URL(source).href : null;
};

const integerParameter = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const readResponse = Effect.fn("readResponse")(function* readResponse(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === "/api/health") return json({ status: "ok", runtime: "cloudflare-worker" });
  if (path === "/api/transcripts" || path === "/api/") {
    const around = url.searchParams.get("around");
    if (around) return json(yield* getTranscriptAround.handler({ id: integerParameter(around, -1) }));
    const videoId = url.searchParams.get("video_id");
    const channel = url.searchParams.get("channel");
    const result = yield* listTranscripts.handler({
      limit: integerParameter(url.searchParams.get("limit"), 500),
      offset: integerParameter(url.searchParams.get("offset"), 0),
      ...(videoId ? { videoId } : {}),
      ...(channel ? { channel } : {}),
    });
    const body = JSON.stringify({ success: true, data: result.data.map(listItem), total: result.total });
    const digest = yield* Digest.Digest;
    const etag = `"${yield* digest.digestHex(Digest.sha256, new TextEncoder().encode(body))}"`;
    const headers = { ETag: etag, "Cache-Control": "private, no-cache" };
    if (request.headers.get("If-None-Match")?.replace(/^W\//u, "") === etag) return new Response(null, { status: 304, headers });
    return new Response(body, { headers: { ...headers, "Content-Type": "application/json" } });
  }
  const transcriptMatch = /^\/api\/transcripts\/(\d+)(\/source)?$/u.exec(path);
  if (transcriptMatch) {
    const id = Number(transcriptMatch[1]);
    if (transcriptMatch[2]) {
      const markdown = yield* getTranscriptContent.handler({ id });
      const source = extractSourceUrl(markdown);
      return source ? Response.redirect(source, 302) : missing("Source not found");
    }
    return json(yield* getTranscript.handler({ id }));
  }
  const contentMatch = /^\/api\/transcript\/(\d+)\/content$/u.exec(path);
  if (contentMatch) return new Response(yield* getTranscriptContent.handler({ id: Number(contentMatch[1]) }), { headers: { "Content-Type": "text/plain" } });
  if (path === "/api/search") {
    const query = url.searchParams.get("q");
    if (!query) return missing("Search query required", 400);
    return json(yield* searchTranscripts.handler({ query }));
  }
  if (path === "/api/categories") return json(yield* listCategories.handler({}));
  const thumbnailMatch = /^\/api\/thumb\/([^/]+)$/u.exec(path);
  if (thumbnailMatch?.[1]) {
    const thumbnail = yield* getTranscriptThumbnail.handler({ videoId: decodeURIComponent(thumbnailMatch[1]) });
    return new Response(new Uint8Array(thumbnail.bytes), { headers: {
      "Content-Type": thumbnail.contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
    } });
  }
  return missing("Endpoint not found");
});

export const transcriptHttp = (request: Request) => readResponse(request).pipe(
  Effect.catchTags({
    TranscriptNotFound: () => Effect.succeed(missing("Transcript not found")),
    TranscriptContentNotFound: () => Effect.succeed(missing("Content file not found")),
    TranscriptStorageError: () => Effect.succeed(missing("Transcript storage unavailable", 503)),
  }),
  Effect.provide(Digest.layerWebCrypto)
);
