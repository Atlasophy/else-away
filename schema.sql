-- elseaway content schema (Cloudflare D1)
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

-- A collaboration is a travel partnership: a place Yaren stayed at, ate at,
-- or worked with, told through a short story and a small gallery. Mirrors the
-- postcards tables above, so publishing follows the same atomic pattern (see
-- functions/lib/content.js). Added 2026-10-12 — see
-- tools/migrations/2026-10-12-collaborations.sql for the equivalent, additive
-- statement to run against an already-running database.
-- Collaborations use a caller-supplied, stable TEXT id (a UUID from the
-- studio) rather than an autoincrement integer, since the brief requires the
-- id to survive edits, reorders and republishing instead of being
-- repositional like a postcard's. This table has never been deployed, so the
-- id shape can still be chosen outright here.
CREATE TABLE IF NOT EXISTS collaborations (
  id         TEXT PRIMARY KEY,
  place      TEXT NOT NULL DEFAULT '',
  category   TEXT NOT NULL DEFAULT 'Other',
  city       TEXT NOT NULL DEFAULT '',
  country    TEXT NOT NULL DEFAULT '',
  time_label TEXT NOT NULL DEFAULT '',
  story      TEXT NOT NULL DEFAULT '',
  url        TEXT NOT NULL DEFAULT '',
  position   INTEGER NOT NULL
);

-- A collaboration can carry more than one photograph, shown in its gallery in
-- this order. Deleting a collaboration cascades to its photographs.
CREATE TABLE IF NOT EXISTS collaboration_images (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  collaboration_id TEXT NOT NULL REFERENCES collaborations(id) ON DELETE CASCADE,
  image            TEXT NOT NULL,
  position         INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_collaborations_order ON collaborations(position);
CREATE INDEX IF NOT EXISTS idx_collaboration_images ON collaboration_images(collaboration_id, position);
