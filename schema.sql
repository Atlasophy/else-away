-- Else Away content schema (Cloudflare D1)
--
-- Shape mirrors content.js exactly, so the API can rebuild that file's JSON
-- without any translation layer.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS site (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS seasons (
  id       TEXT PRIMARY KEY,          -- spring | summer | autumn | winter
  label    TEXT NOT NULL,
  film     TEXT NOT NULL,             -- stock name shown above the season note
  note     TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id TEXT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  slug      TEXT NOT NULL,
  title     TEXT NOT NULL,
  type      TEXT NOT NULL,
  place     TEXT NOT NULL,
  location  TEXT NOT NULL,            -- free text, becomes the Google Maps query
  image     TEXT NOT NULL,
  deck      TEXT NOT NULL,
  story     TEXT NOT NULL,
  position  INTEGER NOT NULL,
  -- Slugs address stories in URLs, so they must be unique within a season.
  UNIQUE (season_id, slug)
);

CREATE TABLE IF NOT EXISTS postcards (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  image      TEXT NOT NULL,
  meta       TEXT NOT NULL,
  title      TEXT NOT NULL,
  season_id  TEXT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  story_slug TEXT NOT NULL,
  position   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_season ON projects(season_id, position);
CREATE INDEX IF NOT EXISTS idx_postcards_order ON postcards(position);

-- Every image Yaren uploads, so the dashboard can offer a picker rather than
-- asking her to remember filenames.
CREATE TABLE IF NOT EXISTS images (
  key        TEXT PRIMARY KEY,        -- R2 object key
  alt        TEXT NOT NULL DEFAULT '',
  width      INTEGER,
  height     INTEGER,
  bytes      INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
