import { getTranscriptAroundContract, getTranscriptContract, listCategoriesContract, listTranscriptsContract } from "@chromescribe/core/contracts";
import { Option, Schema } from "effect";

export const Page = Schema.Literals(["boot", "home", "transcript", "not-found"]);
export const Theme = Schema.Literals(["dark", "light"]);
export const Status = Schema.Literals(["loading", "ready", "error"]);
export const Tab = Schema.Literals(["summary", "transcript"]);
export const TranscriptPage = Schema.Struct({
  detail: getTranscriptContract.output,
  markdown: Schema.String,
  around: getTranscriptAroundContract.output,
});
export type TranscriptPage = typeof TranscriptPage.Type;
export type Transcript = typeof listTranscriptsContract.output.Type.data[number];

export const Model = Schema.Struct({
  page: Page,
  theme: Theme,
  query: Schema.String,
  channel: Schema.String,
  category: Schema.String,
  revision: Schema.Int,
  status: Status,
  rows: Schema.Array(listTranscriptsContract.output.fields.data.value),
  total: Schema.Int,
  offset: Schema.Int,
  categories: listCategoriesContract.output,
  transcript: Schema.Option(TranscriptPage),
  transcriptId: Schema.Int,
  tab: Tab,
  error: Schema.String,
  notice: Schema.String,
  failedThumbnails: Schema.Array(Schema.Int),
});
export type Model = typeof Model.Type;

export const initialModel: Model = {
  page: "boot", theme: "dark", query: "", channel: "", category: "", revision: 0,
  status: "loading", rows: [], total: 0, offset: 0, categories: [],
  transcript: Option.none(), transcriptId: 0, tab: "summary", error: "", notice: "", failedThumbnails: [],
};

export const libraryHref = (query = "", channel = "") => {
  const params = new URLSearchParams();
  if (query) { params.set("q", query); }
  if (channel) { params.set("channel", channel); }
  const suffix = params.toString();
  return suffix ? `/?${suffix}` : "/";
};
export const transcriptHref = (id: number) => `/transcript?id=${id}`;

export const parseLocation = (href: string) => {
  const url = new URL(href, "https://next.chromescribe.yeoux.net");
  if (url.pathname === "/" || url.pathname === "/index.html") {
    return { page: "home" as const, query: url.searchParams.get("q") ?? "", channel: url.searchParams.get("channel") ?? "", id: 0 };
  }
  const id = Number(url.searchParams.get("id"));
  if ((url.pathname === "/transcript" || url.pathname === "/transcript.html") && Number.isSafeInteger(id) && id > 0) {
    return { page: "transcript" as const, query: "", channel: "", id };
  }
  return { page: "not-found" as const, query: "", channel: "", id: 0 };
};

export const pinnedGroups = [
  { id: "group:ai", label: "AI", matches: /\b(?:ai|llm|claude|gpt|coding|programming|software|tech|developer|openai|agentic|mcp|typescript|automation)\b/iu },
  { id: "group:health", label: "Health", matches: /health|nutrition|diet|medical|medicine|longevity|sleep|exercise|fitness|protein|physionic|siim land|peter attia/iu },
  { id: "group:russia", label: "Russia", matches: /russia|putin|kremlin|moscow|ukrain|kyiv|kiev|zelensky|soviet|crimea/iu },
  { id: "group:seo", label: "SEO", matches: /\bseo\b|keyword|backlink|serp|search engine|organic traffic|google search/iu },
];
export const visibleRows = (model: Model): readonly Transcript[] => model.rows.filter((row) => {
  if (model.channel && row.channel !== model.channel) { return false; }
  if (!model.category) { return true; }
  const group = pinnedGroups.find((candidate) => candidate.id === model.category);
  return group ? group.matches.test([row.title, row.channel, row.category, row.tags].join(" ")) : row.category === model.category;
});
