import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export function openDb(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      destination TEXT NOT NULL,
      redirect_type INTEGER NOT NULL DEFAULT 302,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      link_id INTEGER NOT NULL REFERENCES links(id) ON DELETE CASCADE,
      ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      referrer TEXT,
      user_agent TEXT,
      device TEXT,
      browser TEXT,
      os TEXT,
      country TEXT,
      visitor_hash TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_clicks_link ON clicks(link_id);
    CREATE INDEX IF NOT EXISTS idx_clicks_ts ON clicks(link_id, ts);
  `);
  return db;
}
