-- Else Away content schema (Cloudflare D1)
--
-- Shape mirrors content.js exactly, so the API can rebuild that file's JSON
-- without any translation layer.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS site (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- A postcard is a place: where, roughly when, what it looked like, and a
-- note about it. Publishing writes the whole table in one pass (see
-- functions/lib/content.js), so position is reassigned every time rather
-- than something the UI has to maintain by hand.
CREATE TABLE IF NOT EXISTS postcards (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  city       TEXT NOT NULL DEFAULT '',
  country    TEXT NOT NULL DEFAULT '',
  time_label TEXT NOT NULL DEFAULT '',
  note       TEXT NOT NULL DEFAULT '',
  position   INTEGER NOT NULL
);

-- A postcard can carry more than one photograph, shown in the lightbox in
-- this order. Deleting a postcard cascades to its photographs.
CREATE TABLE IF NOT EXISTS postcard_images (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  postcard_id INTEGER NOT NULL REFERENCES postcards(id) ON DELETE CASCADE,
  image       TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_postcards_order ON postcards(position);
CREATE INDEX IF NOT EXISTS idx_postcard_images ON postcard_images(postcard_id, position);

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
