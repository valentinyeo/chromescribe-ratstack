import { desc, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const transcripts = sqliteTable(
  "transcripts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    videoId: text("video_id").notNull().unique(),
    title: text("title").notNull(),
    channel: text("channel").default("Unknown"),
    duration: integer("duration").default(0),
    srtPath: text("srt_path").notNull(),
    wordCount: integer("word_count").default(0),
    thumbnailUrl: text("thumbnail_url"),
    category: text("category"),
    tags: text("tags"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_video_id").on(table.videoId),
    index("idx_created_at").on(desc(table.createdAt)),
    index("idx_title").on(table.title),
    index("idx_category").on(table.category),
  ]
);

export const queue = sqliteTable(
  "queue",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    url: text("url").notNull(),
    videoId: text("video_id").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    error: text("error"),
    attempts: integer("attempts").default(0),
    transcriptId: integer("transcript_id"),
  },
  (table) => [
    index("idx_queue_status").on(table.status),
    uniqueIndex("idx_queue_pending_video")
      .on(table.videoId)
      .where(sql`${table.status} = 'pending'`),
  ]
);

export const channels = sqliteTable(
  "channels",
  {
    id: text("id").primaryKey(),
    platform: text("platform").notNull(),
    handle: text("handle").notNull(),
    name: text("name").notNull(),
    paused: integer("paused").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check("channels_platform", sql`${table.platform} IN ('youtube', 'tiktok')`),
  ]
);

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  channel: text("channel").notNull(),
  topic: text("topic").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
