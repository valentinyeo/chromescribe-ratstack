
CREATE TABLE IF NOT EXISTS transcripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    channel TEXT DEFAULT 'Unknown',
    duration INTEGER DEFAULT 0,
    srt_path TEXT NOT NULL,
    word_count INTEGER DEFAULT 0,
    thumbnail_url TEXT,
    category TEXT,
    tags TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_video_id ON transcripts(video_id);
CREATE INDEX IF NOT EXISTS idx_created_at ON transcripts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_title ON transcripts(title);
CREATE INDEX IF NOT EXISTS idx_category ON transcripts(category);

CREATE TABLE IF NOT EXISTS queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    video_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    finished_at DATETIME,
    error TEXT,
    attempts INTEGER DEFAULT 0,
    transcript_id INTEGER
);
CREATE INDEX IF NOT EXISTS idx_queue_status ON queue(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_queue_pending_video
    ON queue(video_id) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL CHECK (platform IN ('youtube', 'tiktok')),
    handle TEXT NOT NULL,
    name TEXT NOT NULL,
    paused INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    channel TEXT NOT NULL,
    topic TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
