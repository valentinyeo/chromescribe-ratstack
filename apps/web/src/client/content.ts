export const splitSections = (markdown: string) => {
  const full = /^#{1,6}\s+(?:Full\s+)?Transcript\s*\r?$/imu.exec(markdown);
  if (full) {
    return { summary: markdown.slice(0, full.index).replace(/(?:\r?\n)?---\s*$/u, "").trim(), transcript: markdown.slice(full.index + full[0].length).trim() };
  }
  const summary = /^#{1,6}\s+(?:TL;DR|Summary)\s*\r?$/imu.exec(markdown);
  return summary ? { summary: markdown.trim(), transcript: "" } : { summary: "", transcript: markdown.trim() };
};

export const timestampSeconds = (text: string): number | undefined => {
  const match = /^\[(?:(\d+):)?(\d{1,2}):(\d{2})\]$/u.exec(text);
  if (!match) { return undefined; }
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (seconds > 59 || (match[1] !== undefined && minutes > 59)) { return undefined; }
  return hours * 3600 + minutes * 60 + seconds;
};

export const mediaFor = (videoId: string) => {
  if (videoId.startsWith("article:")) { return { kind: "article", src: "", label: "Article" }; }
  if (/^[\w-]{11}$/u.test(videoId)) { return { kind: "youtube", src: `https://www.youtube.com/embed/${videoId}?enablejsapi=1`, label: "YouTube" }; }
  if (/^tiktok:\d+$/u.test(videoId)) { return { kind: "tiktok", src: `https://www.tiktok.com/player/v1/${videoId.slice(7)}`, label: "TikTok" }; }
  if (/^x:\d+$/u.test(videoId)) { return { kind: "x", src: `https://platform.twitter.com/embed/Tweet.html?dnt=true&id=${videoId.slice(2)}`, label: "X" }; }
  return { kind: "unknown", src: "", label: "Video" };
};

export const safeLink = (href: string) => /^https?:\/\//iu.test(href) ? href : undefined;
export const sourceHref = (id: number) => `/api/transcripts/${id}/source`;
export const thumbnailHref = (videoId: string) => `/api/thumb/${encodeURIComponent(videoId)}`;
