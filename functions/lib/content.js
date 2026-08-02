/* Reads and writes the content tree.
   The shape returned here is exactly what content.js declares, so the public
   site consumes either source without knowing which it got. */

export async function readContent(db) {
  const [site, postcards, images] = await Promise.all([
    db.prepare('SELECT key, value FROM site').all(),
    db.prepare('SELECT id, city, country, time_label, note, position FROM postcards ORDER BY position').all(),
    db.prepare('SELECT postcard_id, image, position FROM postcard_images ORDER BY postcard_id, position').all(),
  ]);

  const imagesByCard = new Map();
  for (const row of images.results) {
    if (!imagesByCard.has(row.postcard_id)) imagesByCard.set(row.postcard_id, []);
    imagesByCard.get(row.postcard_id).push(row.image);
  }

  return {
    site: Object.fromEntries(site.results.map(row => [row.key, row.value])),
    postcards: postcards.results.map(row => ({
      city: row.city,
      country: row.country,
      time: row.time_label,
      note: row.note,
      images: imagesByCard.get(row.id) ?? [],
    })),
  };
}

/* Rejects rather than half-saves. A postcard with no photograph would show a
   blank frame on the site, so that is caught here before it ever reaches the
   database. */
export function validateContent(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') return ['Payload must be an object.'];
  if (!Array.isArray(payload.postcards)) errors.push('Postcards must be a list.');

  for (const card of payload.postcards ?? []) {
    const label = [card.city, card.country].filter(Boolean).join(', ') || 'A postcard';
    if (!card.city && !card.country) errors.push(`${label} needs at least a city or a country.`);
    if (!Array.isArray(card.images) || card.images.length === 0) errors.push(`"${label}" has no photograph.`);
  }
  return errors;
}

/* D1 has no interactive transactions, so the whole save goes through batch(),
   which is atomic. A failed save leaves the previous content untouched.
   Postcard ids are reassigned on every publish (1, 2, 3…) rather than kept
   stable, since nothing outside this table links to them — that sidesteps
   needing the id D1 would generate mid-batch just to link its photographs. */
export async function writeContent(db, payload) {
  const statements = [
    db.prepare('DELETE FROM postcard_images'),
    db.prepare('DELETE FROM postcards'),
    db.prepare('DELETE FROM site'),
  ];

  for (const [key, value] of Object.entries(payload.site ?? {})) {
    statements.push(db.prepare('INSERT INTO site (key, value) VALUES (?, ?)').bind(key, String(value)));
  }

  (payload.postcards ?? []).forEach((card, index) => {
    const id = index + 1;
    statements.push(db.prepare(
      'INSERT INTO postcards (id, city, country, time_label, note, position) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, card.city ?? '', card.country ?? '', card.time ?? '', card.note ?? '', index));
    (card.images ?? []).forEach((image, imageIndex) => {
      statements.push(db.prepare(
        'INSERT INTO postcard_images (postcard_id, image, position) VALUES (?, ?, ?)'
      ).bind(id, image, imageIndex));
    });
  });

  await db.batch(statements);
}
