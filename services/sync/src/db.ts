// SQLite state. One small schema describing recordings, processing jobs, and archive status.
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "./config.js";

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
fs.mkdirSync(config.recordingsDir, { recursive: true });

export const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS recordings (
    id            TEXT PRIMARY KEY,        -- Plaud file id (or local uuid)
    title         TEXT,
    source        TEXT NOT NULL,           -- 'plaud' | 'upload'
    created_at    INTEGER,                 -- recording time (epoch ms)
    mirrored_at   INTEGER,                 -- when audio finished downloading
    audio_path    TEXT,
    duration_sec  REAL,
    has_plaud_transcript INTEGER DEFAULT 0,
    has_local_transcript INTEGER DEFAULT 0,
    has_local_summary    INTEGER DEFAULT 0,
    archive_status TEXT DEFAULT 'pending', -- 'pending' | 'archived' | 'error'
    drive_folder_id TEXT
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    recording_id TEXT NOT NULL,
    kind        TEXT NOT NULL,             -- 'transcribe' | 'analyze' | 'archive'
    status      TEXT NOT NULL DEFAULT 'queued', -- queued|running|done|error
    detail      TEXT,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );
`);

export interface Recording {
  id: string;
  title: string | null;
  source: string;
  created_at: number | null;
  mirrored_at: number | null;
  audio_path: string | null;
  duration_sec: number | null;
  has_plaud_transcript: number;
  has_local_transcript: number;
  has_local_summary: number;
  archive_status: string;
  drive_folder_id: string | null;
}

export const upsertRecording = db.prepare(`
  INSERT INTO recordings (id, title, source, created_at, mirrored_at, audio_path, duration_sec, has_plaud_transcript)
  VALUES (@id, @title, @source, @created_at, @mirrored_at, @audio_path, @duration_sec, @has_plaud_transcript)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    mirrored_at = excluded.mirrored_at,
    audio_path = excluded.audio_path,
    duration_sec = excluded.duration_sec,
    has_plaud_transcript = excluded.has_plaud_transcript
`);

export const listRecordings = db.prepare(
  `SELECT * FROM recordings ORDER BY created_at DESC`
);
export const getRecording = db.prepare(`SELECT * FROM recordings WHERE id = ?`);

// Only these boolean flag columns may be written via setFlag — guards the interpolation below.
const FLAG_COLUMNS = new Set([
  "has_plaud_transcript",
  "has_local_transcript",
  "has_local_summary",
]);
export const setFlag = (id: string, column: string, value: number) => {
  if (!FLAG_COLUMNS.has(column)) throw new Error(`illegal flag column: ${column}`);
  return db.prepare(`UPDATE recordings SET ${column} = ? WHERE id = ?`).run(value, id);
};

export const setArchiveStatus = db.prepare(
  `UPDATE recordings SET archive_status = ?, drive_folder_id = ? WHERE id = ?`
);

export const createJob = db.prepare(`
  INSERT INTO jobs (recording_id, kind, status, created_at, updated_at)
  VALUES (?, ?, 'queued', ?, ?)
`);
export const updateJob = db.prepare(
  `UPDATE jobs SET status = ?, detail = ?, updated_at = ? WHERE id = ?`
);
export const getJob = db.prepare(`SELECT * FROM jobs WHERE id = ?`);
