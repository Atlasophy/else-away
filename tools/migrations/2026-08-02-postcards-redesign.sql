-- Migration: replace the seasons/projects ("A year in stories") data model
-- with the new postcards model (city, country, time, note, many photographs).
-- Run once against the live else-away D1 database, then deploy the matching
-- code. Safe to run only once — it drops the old postcards table shape.

PRAGMA foreign_keys = OFF;

-- 1. Build the new postcards table alongside the old one so no data is lost
--    mid-migration.
CREATE TABLE postcards_new (
  id         INTEGER PRIMARY KEY,
  city       TEXT NOT NULL DEFAULT '',
  country    TEXT NOT NULL DEFAULT '',
  time_label TEXT NOT NULL DEFAULT '',
  note       TEXT NOT NULL DEFAULT '',
  position   INTEGER NOT NULL
);

-- Best-effort carry-over: the old "meta" caption was "City · detail", so the
-- text before the middle dot becomes the new city. Country and time are left
-- blank for Yaren to fill in from the admin. The old title (an evocative
-- sentence) becomes the note, since it already reads like the "details"
-- field the new form asks for.
INSERT INTO postcards_new (id, city, country, time_label, note, position)
SELECT
  id,
  CASE WHEN instr(meta, ' · ') > 0 THEN trim(substr(meta, 1, instr(meta, ' · ') - 1)) ELSE trim(meta) END,
  '',
  '',
  title,
  position
FROM postcards;

-- 2. Carry the one photograph every existing postcard already had into the
--    new many-photographs table, before the old postcards table is dropped.
CREATE TABLE postcard_images (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  postcard_id INTEGER NOT NULL REFERENCES postcards_new(id) ON DELETE CASCADE,
  image       TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0
);

INSERT INTO postcard_images (postcard_id, image, position)
SELECT id, image, 0 FROM postcards;

-- 3. Swap the tables.
DROP TABLE postcards;
ALTER TABLE postcards_new RENAME TO postcards;

CREATE INDEX IF NOT EXISTS idx_postcards_order ON postcards(position);
CREATE INDEX IF NOT EXISTS idx_postcard_images ON postcard_images(postcard_id, position);

-- 4. The Stories section is gone from the site, so its data goes too.
--    (If you ever want it back, restore from a D1 export taken before this
--    migration runs — Cloudflare dashboard → D1 → else-away → Export.)
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS seasons;

PRAGMA foreign_keys = ON;
