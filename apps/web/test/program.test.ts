import { TranscriptNotFound } from "@chromescribe/core/transcripts";
import { expect, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import * as RpcTest from "effect/rpc/RpcTest";

import {
  LoadCategories,
  LoadHome,
  LoadTranscript,
} from "../src/client/commands.js";
import { Messages } from "../src/client/messages.js";
import {
  initialModel,
  parseLocation,
  transcriptHref,
  visibleRows,
} from "../src/client/model.js";
import type { Transcript } from "../src/client/model.js";
import { TranscriptRpc, transcriptRpc } from "../src/client/rpc.js";
import { update } from "../src/client/update.js";

const row = (id: number, channel = "Channel"): Transcript => ({
  id,
  channel,
  video_id: "abcdefghijk",
  title: `AI video ${id}`,
  duration: 90,
  word_count: 100,
  created_at: "2026-01-02",
  category: "Software",
  tags: null,
});

const detail = { ...row(2), srt_path: "2.md", thumbnail_url: null };

const markdown =
  "## TL;DR\nA useful thought.\n\n## Full Transcript\n[1:23] The full thought.";

const handlers = transcriptRpc.group.toLayer({
  listTranscripts: ({ offset = 0, channel }) =>
    Effect.succeed({ data: [row(offset + 1, channel)], total: 3 }),
  searchTranscripts: ({ query }) =>
    Effect.succeed(query === "empty" ? [] : [{ ...detail, title: query }]),
  listCategories: () => Effect.succeed([{ category: "Software", count: 3 }]),
  getTranscript: ({ id }) =>
    id === 404
      ? Effect.fail(new TranscriptNotFound({ id }))
      : Effect.succeed({ ...detail, id }),
  getTranscriptContent: () => Effect.succeed(markdown),
  getTranscriptAround: () =>
    Effect.succeed({ prev: 1, next: 3, index: 1, total: 3 }),
});

const rpcLayer = Layer.effect(
  TranscriptRpc,
  RpcTest.makeClient(transcriptRpc.group)
).pipe(Layer.provide(handlers));

it.layer(rpcLayer)("library and viewer commands", (test) => {
  test.effect(
    "loads the requested channel, categories, then appends the next page",
    () =>
      Effect.gen(function* libraryPaging() {
        const started = update(
          initialModel,
          Messages.LoadedLocation({
            href: "https://next.chromescribe.yeoux.net/?channel=Selected",
            theme: "dark",
          })
        );

        expect(started.model.channel).toBe("Selected");
        expect(started.model.status).toBe("loading");

        const loaded = yield* LoadHome({
          query: "",
          channel: started.model.channel,
          offset: 0,
          revision: started.model.revision,
        }).effect;

        const first = update(started.model, loaded).model;
        expect(first.rows[0]?.channel).toBe("Selected");
        expect(first.offset).toBe(1);
        const categories = yield* LoadCategories().effect;
        const withCategories = update(first, categories).model;
        expect(withCategories.categories[0]?.count).toBe(3);
        const more = update(withCategories, Messages.RequestedMore());
        expect(more.commands?.[0]?.args?.offset).toBe(1);

        const second = yield* LoadHome({
          query: "",
          channel: "Selected",
          offset: 1,
          revision: more.model.revision,
        }).effect;

        const appended = update(more.model, second).model;
        expect(appended.rows.map((item) => item.id)).toEqual([1, 2]);
        expect(appended.offset).toBe(2);
      })
  );

  test.effect(
    "search replaces pages, preserves channel filtering and can be empty",
    () =>
      Effect.gen(function* librarySearch() {
        const changed = update(
          { ...initialModel, page: "home", rows: [row(1)], offset: 1 },
          Messages.ChangedSearch({ query: "memory" })
        );

        expect(changed.model.rows).toHaveLength(0);

        const result = yield* LoadHome({
          query: "memory",
          channel: "Channel",
          offset: 0,
          revision: changed.model.revision,
        }).effect;

        expect(update(changed.model, result).model.rows[0]?.title).toBe(
          "memory"
        );

        const excluded = yield* LoadHome({
          query: "memory",
          channel: "Other",
          offset: 0,
          revision: changed.model.revision,
        }).effect;

        expect(update(changed.model, excluded).model.total).toBe(0);

        const empty = yield* LoadHome({
          query: "empty",
          channel: "",
          offset: 0,
          revision: changed.model.revision,
        }).effect;

        expect(update(changed.model, empty).model.status).toBe("ready");
        expect(update(changed.model, empty).model.rows).toHaveLength(0);
      })
  );

  test.effect(
    "loads metadata, stored markdown and both neighbours through RPC",
    () =>
      Effect.gen(function* viewerLoading() {
        const started = update(
          initialModel,
          Messages.LoadedLocation({
            href: "https://next.chromescribe.yeoux.net/transcript.html?id=2",
            theme: "light",
          })
        );

        const loaded = yield* LoadTranscript({
          id: 2,
          revision: started.model.revision,
        }).effect;

        const { model } = update(started.model, loaded);
        expect(model.status).toBe("ready");
        const page = Option.getOrThrow(model.transcript);
        expect(page.detail.id).toBe(2);
        expect(page.markdown).toBe(markdown);
        expect(page.around).toEqual({ prev: 1, next: 3, index: 1, total: 3 });

        for (const id of [page.around.prev, page.around.next]) {
          if (id !== null) {
            const next = update(
              model,
              Messages.LoadedLocation({
                href: `https://next.chromescribe.yeoux.net${transcriptHref(id)}`,
                theme: model.theme,
              })
            );

            expect(next.model.transcriptId).toBe(id);
            expect(Option.isNone(next.model.transcript)).toBe(true);
            expect(next.commands?.[0]?.args?.id).toBe(id);
          }
        }

        expect(
          update(model, Messages.SelectedTab({ tab: "transcript" })).model.tab
        ).toBe("transcript");
      })
  );

  test.effect("keeps a typed failure visible and retryable", () =>
    Effect.gen(function* viewerFailure() {
      const started = update(
        initialModel,
        Messages.LoadedLocation({
          href: "https://next.chromescribe.yeoux.net/transcript?id=404",
          theme: "dark",
        })
      );

      const failed = yield* LoadTranscript({
        id: 404,
        revision: started.model.revision,
      }).effect;

      const { model } = update(started.model, failed);
      expect(model.status).toBe("error");
      expect(model.error).toContain("TranscriptNotFound");
      const retry = update(model, Messages.RequestedRetry());
      expect(retry.model.status).toBe("loading");
      expect(retry.commands?.[0]?.args?.id).toBe(404);
    })
  );
});

it("filters pinned groups and database categories without losing pagination", () => {
  const model = {
    ...initialModel,
    rows: [row(1), { ...row(2), title: "Nutrition", category: "Health" }],
    total: 80,
    offset: 2,
  };

  const health = update(
    model,
    Messages.SelectedCategory({ category: "group:health" })
  ).model;

  expect(visibleRows(health).map((item) => item.id)).toEqual([2]);

  const software = update(
    model,
    Messages.SelectedCategory({ category: "Software" })
  ).model;

  expect(visibleRows(software).map((item) => item.id)).toEqual([1]);
  expect(software.total).toBe(80);
});

it("rejects stale search successes and failures", () => {
  const first = update(
    initialModel,
    Messages.ChangedSearch({ query: "first" })
  ).model;

  const second = update(
    first,
    Messages.ChangedSearch({ query: "second" })
  ).model;

  expect(
    update(
      second,
      Messages.LoadedHome({
        revision: first.revision,
        offset: 0,
        result: { data: [row(1)], total: 1 },
      })
    ).model
  ).toBe(second);
  expect(
    update(
      second,
      Messages.FailedLoad({ revision: first.revision, error: "old request" })
    ).model
  ).toBe(second);
});

it("preserves completed pages when a later page fails", () => {
  const model = {
    ...initialModel,
    page: "home" as const,
    status: "ready" as const,
    rows: [row(1)],
    total: 3,
    offset: 1,
  };

  const loading = update(model, Messages.RequestedMore()).model;

  const failed = update(
    loading,
    Messages.FailedLoad({ revision: loading.revision, error: "offline" })
  ).model;

  expect(failed.rows).toEqual(model.rows);
  expect(
    update(failed, Messages.RequestedRetry()).commands?.[0]?.args?.offset
  ).toBe(1);
});

it("routes both legacy aliases, query filters and invalid IDs", () => {
  expect(parseLocation("/index.html?channel=One&q=two")).toMatchObject({
    page: "home",
    channel: "One",
    query: "two",
  });

  for (const path of ["/transcript?id=7", "/transcript.html?id=7"]) {
    expect(parseLocation(path)).toMatchObject({ page: "transcript", id: 7 });
  }

  for (const path of [
    "/transcript",
    "/transcript?id=0",
    "/transcript?id=1.5",
    "/transcript?id=no",
    "/unknown",
  ]) {
    expect(parseLocation(path).page).toBe("not-found");
  }
});
