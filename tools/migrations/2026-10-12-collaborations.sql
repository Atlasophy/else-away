-- Additive migration: adds the collaborations feature to an already-running
-- database. Safe to run more than once (every statement is IF NOT EXISTS) and
-- touches nothing else — existing site, postcards, postcard_images and images
-- rows are untouched. Run before deploying the code that depends on it:
--
--   wrangler d1 execute else-away --remote --file=tools/migrations/2026-10-12-collaborations.sql
--
-- These statements are identical to the ones schema.sql carries for fresh
-- installs. Keep the two in sync if this table shape ever changes.
--
-- collaborations.id is a caller-supplied TEXT id (a UUID from the studio),
-- not an autoincrement integer, so it stays stable across edits, reorders
-- and republishing. See functions/lib/content.js.

PRAGMA foreign_keys = ON;

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

CREATE TABLE IF NOT EXISTS collaboration_images (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  collaboration_id TEXT NOT NULL REFERENCES collaborations(id) ON DELETE CASCADE,
  image            TEXT NOT NULL,
  position         INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_collaborations_order ON collaborations(position);
CREATE INDEX IF NOT EXISTS idx_collaboration_images ON collaboration_images(collaboration_id, position);
