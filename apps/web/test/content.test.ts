import { expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import * as Arbitrary from "effect/Arbitrary";

import { mediaFor, safeLink, splitSections, timestampSeconds } from "../src/client/content.js";

const minute = Arbitrary.schema(Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 59 })));
const hour = Arbitrary.schema(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 48 })));
const pad = (value: number) => String(value).padStart(2, "0");
const time = Arbitrary.all({ hours: hour, minutes: minute, seconds: minute });

it.prop("timestamp labels seek the exact second", time, ({ hours, minutes, seconds }) => {
  expect(timestampSeconds(`[${hours}:${pad(minutes)}:${pad(seconds)}]`)).toBe(hours * 3600 + minutes * 60 + seconds);
  expect(timestampSeconds(`[${minutes}:${pad(seconds)}]`)).toBe(minutes * 60 + seconds);
});

it.effect("timestamp property rejects a planted minutes-as-seconds bug", () => Effect.gen(function* () {
  const result = yield* Arbitrary.checkEffect(time, ({ hours, minutes, seconds }) => timestampSeconds(`[${hours}:${pad(minutes)}:${pad(seconds)}]`) === hours * 3600 + minutes + seconds);
  expect(result).toHaveProperty("shrunkInput");
}));

it("rejects malformed and out-of-range timestamp labels", () => {
  for (const label of ["[0:60]", "[1:60:00]", "[-1:00]", "1:20", "[1:2]", "[1:23] extra"]) { expect(timestampSeconds(label)).toBeUndefined(); }
});

it("keeps summary, article and talking points separate from the full transcript", () => {
  const saved = "# Title\n\n## TL;DR\nThe point.\n\n---\n\n## Summary\nThe article.\n\n## Talking Points\n- [1:02] Detail.\n\n---\n\n## Full Transcript\n[0:00] Opening.\n[1:02] Detail.";
  const sections = splitSections(saved);
  expect(sections.summary).toContain("The article.");
  expect(sections.summary).not.toContain("Opening.");
  expect(sections.transcript).toBe("[0:00] Opening.\n[1:02] Detail.");
  expect(splitSections("Raw transcript")).toEqual({ summary: "", transcript: "Raw transcript" });
  expect(splitSections("## TL;DR\nJust a summary.")).toEqual({ summary: "## TL;DR\nJust a summary.", transcript: "" });
  expect(splitSections("## Summary\r\nShort.\r\n## Full Transcript\r\nLong.")).toEqual({ summary: "## Summary\r\nShort.", transcript: "Long." });
});

it("recognizes article, YouTube, TikTok and X without treating arbitrary IDs as embed URLs", () => {
  expect(mediaFor("article:abcdefghijk").kind).toBe("article");
  expect(mediaFor("abcdefghijk").src).toBe("https://www.youtube.com/embed/abcdefghijk?enablejsapi=1");
  expect(mediaFor("tiktok:123456789").src).toBe("https://www.tiktok.com/player/v1/123456789");
  expect(mediaFor("x:1234").src).toContain("id=1234");
  expect(mediaFor('tiktok:123" onload="bad').src).toBe("");
  expect(mediaFor("javascript:alert(1)").src).toBe("");
});

it("allows web links but never executable markdown destinations", () => {
  expect(safeLink("https://example.com/article")).toBe("https://example.com/article");
  for (const href of ["javascript:alert(1)", "data:text/html,bad", "//example.com", "/rpc"]) { expect(safeLink(href)).toBeUndefined(); }
});
