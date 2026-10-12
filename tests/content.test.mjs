// Focused tests for functions/lib/content.js — compatibility, validation,
// preservation of existing data, and failure handling.
//
// Run with:
//   node --test tests/content.test.mjs
//
// Requires no installed packages. functions/lib/content.js is written as an
// ES module (as Cloudflare Pages Functions requires); this repository has no
// package.json, so Node is relied on to auto-detect ES module syntax in a
// plain .js file (stable default behaviour since Node 22.7). If an older
// Node is used, the static import below will fail with a syntax error before
// any test runs — check `node --version` first.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readContent, validateContent, writeContent } from '../functions/lib/content.js';

/* ------------------------------------------------------------- fixture DB */
/* A minimal in-memory stand-in for a Cloudflare D1 binding. It understands
   exactly the small, fixed set of statements functions/lib/content.js issues
   (SELECT / INSERT / DELETE against known tables, plus the sqlite_master
   schema check) — enough to exercise the real logic under test without a
   real database or any installed driver. */

const ALL_TABLES = ['site', 'postcards', 'postcard_images', 'collaborations', 'collaboration_images'];

class FakeStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql.trim();
    this.args = [];
  }

  bind(...args) {
    this.args = args;
    return this;
  }

  async all() {
    const sql = this.sql;

    if (/FROM sqlite_master/i.test(sql)) {
      // Matches both "name = 'x'" and "name IN ('x', 'y')" — whichever
      // quoted table names appear in the query, checked individually.
      const names = [...sql.matchAll(/'([^']+)'/g)].map(match => match[1]);
      return { results: names.filter(name => this.db.tables.has(name)).map(name => ({ name })) };
    }

    const table = /FROM (\w+)/i.exec(sql)?.[1];
    this.db.assertTableExists(table);
    const rows = this.db.rows[table].map(row => ({ ...row }));

    const orderMatch = /ORDER BY ([\w, ]+)/i.exec(sql);
    if (orderMatch) {
      const columns = orderMatch[1].split(',').map(part => part.trim());
      rows.sort((a, b) => {
        for (const column of columns) {
          if (a[column] < b[column]) return -1;
          if (a[column] > b[column]) return 1;
        }
        return 0;
      });
    }
    return { results: rows };
  }

  async run() {
    const sql = this.sql;

    const deleteMatch = /^DELETE FROM (\w+)/i.exec(sql);
    if (deleteMatch) {
      this.db.assertTableExists(deleteMatch[1]);
      this.db.rows[deleteMatch[1]] = [];
      return { success: true };
    }

    const insertMatch = /^INSERT INTO (\w+)\s*\(([^)]+)\)/i.exec(sql);
    if (insertMatch) {
      const [, table, columnList] = insertMatch;
      this.db.assertTableExists(table);
      const columns = columnList.split(',').map(part => part.trim());
      const row = {};
      columns.forEach((column, index) => { row[column] = this.args[index]; });
      this.db.rows[table].push(row);
      return { success: true };
    }

    throw new Error(`FakeD1 cannot run: ${sql}`);
  }
}

class FakeD1 {
  constructor({ missingTables = [] } = {}) {
    this.tables = new Set(ALL_TABLES.filter(table => !missingTables.includes(table)));
    this.rows = Object.fromEntries(ALL_TABLES.map(table => [table, []]));
  }

  assertTableExists(table) {
    if (!this.tables.has(table)) throw new Error(`no such table: ${table}`);
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }

  async batch(statements) {
    // Real D1 batches are atomic; these tests only ever call batch() through
    // writeContent, which already refuses to start the batch when the
    // database is not ready for what the payload asks it to do.
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }
}

/* ------------------------------------------------------------- fixtures */

const samplePostcard = (overrides = {}) => ({
  city: 'Menorca',
  country: 'Spain',
  time: 'After midnight',
  note: 'The table they set after everyone else had gone home',
  images: ['assets/stories/summer-5.webp'],
  ...overrides,
});

const sampleCollaboration = (overrides = {}) => ({
  place: 'Casa Lio',
  category: 'Restaurant',
  city: 'Menorca',
  country: 'Spain',
  time: 'Summer 2026',
  story: 'A long lunch that turned into the whole afternoon.',
  url: 'https://example.com/casa-lio',
  images: ['assets/stories/summer-5.webp'],
  ...overrides,
});

/* ------------------------------------------------------------ readContent */

test('readContent returns site, postcards and collaborations when the schema is present', async () => {
  const db = new FakeD1();
  await writeContent(db, {
    site: { email: 'yarenkecici022@gmail.com' },
    postcards: [samplePostcard()],
    collaborations: [sampleCollaboration()],
  });

  const content = await readContent(db);
  assert.equal(content.collaborationsAvailable, true);
  assert.equal(content.postcards.length, 1);
  assert.deepEqual(content.postcards[0].images, ['assets/stories/summer-5.webp']);
  assert.equal(content.collaborations.length, 1);
  assert.equal(content.collaborations[0].place, 'Casa Lio');
  assert.equal(content.collaborations[0].category, 'Restaurant');
  assert.deepEqual(content.collaborations[0].images, ['assets/stories/summer-5.webp']);
});

test('readContent still reads existing postcards when collaborations tables are missing', async () => {
  const db = new FakeD1({ missingTables: ['collaborations', 'collaboration_images'] });
  await writeContent(db, { site: {}, postcards: [samplePostcard()] });

  const content = await readContent(db);
  assert.equal(content.collaborationsAvailable, false);
  assert.deepEqual(content.collaborations, []);
  assert.equal(content.postcards.length, 1);
  assert.equal(content.postcards[0].city, 'Menorca');
});

test('readContent treats a partially-installed collaboration schema as unavailable, while postcards still read', async () => {
  const db = new FakeD1({ missingTables: ['collaboration_images'] });
  await writeContent(db, { site: {}, postcards: [samplePostcard()] });

  const content = await readContent(db);
  assert.equal(content.collaborationsAvailable, false);
  assert.deepEqual(content.collaborations, []);
  assert.equal(content.postcards.length, 1);
});

/* --------------------------------------------------------- validateContent */

test('validateContent accepts a well-formed payload with collaborations', () => {
  const errors = validateContent({
    site: { email: 'yaren@example.com' },
    postcards: [samplePostcard()],
    collaborations: [sampleCollaboration()],
  });
  assert.deepEqual(errors, []);
});

test('validateContent accepts a payload that omits collaborations entirely', () => {
  const errors = validateContent({ site: {}, postcards: [samplePostcard()] });
  assert.deepEqual(errors, []);
});

test('validateContent rejects a missing place name', () => {
  const errors = validateContent({
    site: {}, postcards: [samplePostcard()],
    collaborations: [sampleCollaboration({ place: '' })],
  });
  assert.ok(errors.some(message => /needs a place name/.test(message)));
});

test('validateContent rejects an invalid category', () => {
  const errors = validateContent({
    site: {}, postcards: [samplePostcard()],
    collaborations: [sampleCollaboration({ category: 'Nightclub' })],
  });
  assert.ok(errors.some(message => /invalid category/.test(message)));
});

test('validateContent rejects a non-HTTPS place link', () => {
  const errors = validateContent({
    site: {}, postcards: [samplePostcard()],
    collaborations: [sampleCollaboration({ url: 'http://example.com' })],
  });
  assert.ok(errors.some(message => /must start with https/.test(message)));
});

test('validateContent rejects an https place link with no real hostname', () => {
  const errors = validateContent({
    site: {}, postcards: [samplePostcard()],
    collaborations: [sampleCollaboration({ url: 'https:///no-host' })],
  });
  assert.ok(errors.some(message => /must start with https/.test(message)));
});

test('validateContent rejects a non-string place link even when it is falsey', () => {
  const errors = validateContent({
    site: {}, postcards: [samplePostcard()],
    collaborations: [sampleCollaboration({ url: 0 })],
  });
  assert.ok(errors.some(message => /invalid place link/.test(message)));
});

test('validateContent accepts a blank place link', () => {
  const errors = validateContent({
    site: {}, postcards: [samplePostcard()],
    collaborations: [sampleCollaboration({ url: '' })],
  });
  assert.deepEqual(errors, []);
});

test('validateContent rejects a protocol-relative photograph address', () => {
  const errors = validateContent({
    site: {}, postcards: [samplePostcard()],
    collaborations: [sampleCollaboration({ images: ['//evil.example/photo.jpg'] })],
  });
  assert.ok(errors.some(message => /invalid photograph address/.test(message)));
});

test('validateContent rejects a malformed collaboration id', () => {
  const errors = validateContent({
    site: {}, postcards: [samplePostcard()],
    collaborations: [sampleCollaboration({ id: 'has a space' })],
  });
  assert.ok(errors.some(message => /invalid id/.test(message)));
});

test('validateContent rejects duplicate collaboration ids', () => {
  const errors = validateContent({
    site: {}, postcards: [samplePostcard()],
    collaborations: [
      sampleCollaboration({ id: 'dup', place: 'First' }),
      sampleCollaboration({ id: 'dup', place: 'Second' }),
    ],
  });
  assert.ok(errors.some(message => /duplicate/i.test(message)));
});

test('validateContent rejects an unsafe photograph address', () => {
  const errors = validateContent({
    site: {}, postcards: [samplePostcard()],
    collaborations: [sampleCollaboration({ images: ['javascript:alert(1)'] })],
  });
  assert.ok(errors.some(message => /invalid photograph address/.test(message)));
});

test('validateContent rejects a collaboration with no photograph', () => {
  const errors = validateContent({
    site: {}, postcards: [samplePostcard()],
    collaborations: [sampleCollaboration({ images: [] })],
  });
  assert.ok(errors.some(message => /has no photograph/.test(message)));
});

test('validateContent rejects a collaboration missing both city and country', () => {
  const errors = validateContent({
    site: {}, postcards: [samplePostcard()],
    collaborations: [sampleCollaboration({ city: '', country: '' })],
  });
  assert.ok(errors.some(message => /needs at least a city or a country/.test(message)));
});

test('validateContent rejects an oversized story', () => {
  const errors = validateContent({
    site: {}, postcards: [samplePostcard()],
    collaborations: [sampleCollaboration({ story: 'x'.repeat(5001) })],
  });
  assert.ok(errors.some(message => /story that is too long/.test(message)));
});

test('validateContent rejects a non-array collaborations field', () => {
  const errors = validateContent({ site: {}, postcards: [samplePostcard()], collaborations: 'nope' });
  assert.ok(errors.some(message => /Collaborations must be a list/.test(message)));
});

/* ------------------------------------------------------------ writeContent */

test('writeContent round-trips collaborations, order and images', async () => {
  const db = new FakeD1();
  await writeContent(db, {
    site: { credit: 'By Atlasophy' },
    postcards: [samplePostcard()],
    collaborations: [
      sampleCollaboration({ place: 'First', images: ['assets/a.webp', 'assets/b.webp'] }),
      sampleCollaboration({ place: 'Second', images: ['assets/c.webp'] }),
    ],
  });

  const content = await readContent(db);
  assert.deepEqual(content.collaborations.map(entry => entry.place), ['First', 'Second']);
  assert.deepEqual(content.collaborations[0].images, ['assets/a.webp', 'assets/b.webp']);
});

test('writeContent keeps a supplied collaboration id and assigns one when none is supplied', async () => {
  const db = new FakeD1();
  await writeContent(db, {
    site: {}, postcards: [samplePostcard()],
    collaborations: [
      sampleCollaboration({ id: 'fixed-id', place: 'First' }),
      sampleCollaboration({ place: 'Second' }),
    ],
  });

  const content = await readContent(db);
  const first = content.collaborations.find(entry => entry.place === 'First');
  const second = content.collaborations.find(entry => entry.place === 'Second');
  assert.equal(first.id, 'fixed-id');
  assert.ok(typeof second.id === 'string' && second.id.length > 0);
});

test('writeContent preserves a collaboration id across an edit and a republish', async () => {
  const db = new FakeD1();
  await writeContent(db, { site: {}, postcards: [samplePostcard()], collaborations: [sampleCollaboration()] });
  const assignedId = (await readContent(db)).collaborations[0].id;

  await writeContent(db, {
    site: {}, postcards: [samplePostcard()],
    collaborations: [sampleCollaboration({ id: assignedId, place: 'Edited name' })],
  });

  const content = await readContent(db);
  assert.equal(content.collaborations[0].id, assignedId);
  assert.equal(content.collaborations[0].place, 'Edited name');
});

test('writeContent preserves collaboration ids through a reorder', async () => {
  const db = new FakeD1();
  await writeContent(db, {
    site: {}, postcards: [samplePostcard()],
    collaborations: [
      sampleCollaboration({ id: 'a', place: 'First' }),
      sampleCollaboration({ id: 'b', place: 'Second' }),
    ],
  });

  await writeContent(db, {
    site: {}, postcards: [samplePostcard()],
    collaborations: [
      sampleCollaboration({ id: 'b', place: 'Second' }),
      sampleCollaboration({ id: 'a', place: 'First' }),
    ],
  });

  const content = await readContent(db);
  assert.deepEqual(content.collaborations.map(entry => entry.id), ['b', 'a']);
});

test('writeContent preserves existing collaborations when a payload omits the field', async () => {
  const db = new FakeD1();
  await writeContent(db, {
    site: {},
    postcards: [samplePostcard()],
    collaborations: [sampleCollaboration()],
  });

  // Simulates an older admin client that only ever knew about site + postcards.
  await writeContent(db, { site: { credit: 'Updated' }, postcards: [samplePostcard({ city: 'Updated City' })] });

  const content = await readContent(db);
  assert.equal(content.site.credit, 'Updated');
  assert.equal(content.postcards[0].city, 'Updated City');
  assert.equal(content.collaborations.length, 1);
  assert.equal(content.collaborations[0].place, 'Casa Lio');
});

test('writeContent clears collaborations when the payload sends an explicit empty array', async () => {
  const db = new FakeD1();
  await writeContent(db, { site: {}, postcards: [samplePostcard()], collaborations: [sampleCollaboration()] });
  await writeContent(db, { site: {}, postcards: [samplePostcard()], collaborations: [] });

  const content = await readContent(db);
  assert.deepEqual(content.collaborations, []);
});

test('writeContent refuses a collaborations payload on an unmigrated database without touching anything', async () => {
  const db = new FakeD1({ missingTables: ['collaborations', 'collaboration_images'] });
  await writeContent(db, { site: { credit: 'Original' }, postcards: [samplePostcard()] });

  await assert.rejects(
    () => writeContent(db, { site: { credit: 'Attempted change' }, postcards: [samplePostcard()], collaborations: [sampleCollaboration()] }),
    /migrated/,
  );

  // Nothing partial was written — postcards and site are exactly as they were.
  const content = await readContent(db);
  assert.equal(content.site.credit, 'Original');
  assert.equal(content.postcards.length, 1);
});

test('writeContent still publishes postcards and site details on an unmigrated database when the payload omits collaborations', async () => {
  const db = new FakeD1({ missingTables: ['collaborations', 'collaboration_images'] });
  await writeContent(db, { site: { credit: 'Before' }, postcards: [samplePostcard()] });
  await writeContent(db, { site: { credit: 'After' }, postcards: [samplePostcard({ city: 'New City' })] });

  const content = await readContent(db);
  assert.equal(content.site.credit, 'After');
  assert.equal(content.postcards[0].city, 'New City');
  assert.equal(content.collaborationsAvailable, false);
});

test('writeContent propagates a genuine database error instead of reporting success', async () => {
  const db = new FakeD1();
  db.prepare = () => { throw new Error('connection reset'); };
  await assert.rejects(() => writeContent(db, { site: {}, postcards: [samplePostcard()] }), /connection reset/);
});
