/* Reads and writes the content tree.
   The shape returned here is exactly what content.js declares, so the public
   site consumes either source without knowing which it got. */

const CATEGORIES = new Set(['Restaurant', 'Airbnb', 'Hotel', 'Other']);

/* Collaborations shipped after the first production database did, so an
   already-running site may not have those tables yet. This checks sqlite_master
   directly rather than catching a "no such table" error string, since the
   error text is not a contract and a real connectivity failure should still
   surface as a real failure. Both tables are checked, not just one, so a
   partially-applied migration (say, the migration failed partway through) is
   treated as unavailable rather than as a working, half-built schema. */
async function hasCollaborationsSchema(db) {
  const { results } = await db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('collaborations', 'collaboration_images')"
  ).all();
  return results.length === 2;
}

/* collaboration ids are a caller-supplied TEXT id (typically a UUID minted in
   the studio) rather than a positional integer, because the brief requires
   the id to stay the same across an edit, a reorder, and a republish — a
   postcard's id can be positional because nothing outside the postcards
   tables ever links to it, but a collaboration's id is meant to be a stable
   handle. Anything already shaped like a safe id is kept as-is; anything
   else (a brand-new entry, or an older client that never sent one) gets a
   fresh one here. */
const isValidCollaborationId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
const collaborationId = value => (isValidCollaborationId(value) ? value : crypto.randomUUID());

export async function readContent(db) {
  const collaborationsReady = await hasCollaborationsSchema(db);

  const [site, postcards, images, collaborations, collaborationImages] = await Promise.all([
    db.prepare('SELECT key, value FROM site').all(),
    db.prepare('SELECT id, city, country, time_label, note, position FROM postcards ORDER BY position').all(),
    db.prepare('SELECT postcard_id, image, position FROM postcard_images ORDER BY postcard_id, position').all(),
    collaborationsReady
      ? db.prepare('SELECT id, place, category, city, country, time_label, story, url, position FROM collaborations ORDER BY position').all()
      : Promise.resolve({ results: [] }),
    collaborationsReady
      ? db.prepare('SELECT collaboration_id, image, position FROM collaboration_images ORDER BY collaboration_id, position').all()
      : Promise.resolve({ results: [] }),
  ]);

  const imagesByCard = new Map();
  for (const row of images.results) {
    if (!imagesByCard.has(row.postcard_id)) imagesByCard.set(row.postcard_id, []);
    imagesByCard.get(row.postcard_id).push(row.image);
  }

  const imagesByCollaboration = new Map();
  for (const row of collaborationImages.results) {
    if (!imagesByCollaboration.has(row.collaboration_id)) imagesByCollaboration.set(row.collaboration_id, []);
    imagesByCollaboration.get(row.collaboration_id).push(row.image);
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
    collaborations: collaborations.results.map(row => ({
      id: row.id,
      place: row.place,
      category: row.category,
      city: row.city,
      country: row.country,
      time: row.time_label,
      story: row.story,
      url: row.url,
      images: imagesByCollaboration.get(row.id) ?? [],
    })),
    // Lets the dashboard tell "no collaborations yet" apart from "this
    // database has not been migrated", without the public site needing to
    // know the difference — an empty list renders the same honest invite
    // either way.
    collaborationsAvailable: collaborationsReady,
  };
}

/* A lone leading slash is a safe local root-relative path ("/images/x.jpg"),
   but two leading slashes is protocol-relative — the browser resolves
   "//evil.example/x.jpg" against the current scheme, so it is exactly as
   capable of pointing anywhere as a plain "http://" URL would be. The
   negative lookahead keeps the former and refuses the latter. */
const isSafeImage = value => typeof value === 'string' && /^(?:https:\/\/|assets\/|\/(?!\/))/i.test(value);

/* Rejects rather than half-saves. A postcard with no photograph would show a
   blank frame on the site, so that is caught here before it ever reaches the
   database. */
export function validateContent(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') return ['Payload must be an object.'];
  if (!payload.site || typeof payload.site !== 'object' || Array.isArray(payload.site)) {
    errors.push('Site details must be an object.');
  }
  if (!Array.isArray(payload.postcards)) return [...errors, 'Postcards must be a list.'];

  for (const [index, card] of payload.postcards.entries()) {
    if (!card || typeof card !== 'object' || Array.isArray(card)) {
      errors.push(`Postcard ${index + 1} must be an object.`);
      continue;
    }
    const city = typeof card.city === 'string' ? card.city.trim() : '';
    const country = typeof card.country === 'string' ? card.country.trim() : '';
    const label = [city, country].filter(Boolean).join(', ') || `Postcard ${index + 1}`;
    if (!city && !country) errors.push(`${label} needs at least a city or a country.`);
    if (!Array.isArray(card.images) || card.images.length === 0) errors.push(`"${label}" has no photograph.`);
    if (Array.isArray(card.images) && card.images.some(image => !isSafeImage(image))) {
      errors.push(`"${label}" has an invalid photograph address.`);
    }
    for (const [field, limit] of [['city', 120], ['country', 120], ['time', 120], ['note', 5000]]) {
      if (card[field] != null && typeof card[field] !== 'string') errors.push(`"${label}" has an invalid ${field} value.`);
      if (typeof card[field] === 'string' && card[field].length > limit) errors.push(`"${label}" has a ${field} value that is too long.`);
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'collaborations')) {
    if (!Array.isArray(payload.collaborations)) {
      errors.push('Collaborations must be a list.');
    } else {
      for (const [index, entry] of payload.collaborations.entries()) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          errors.push(`Collaboration ${index + 1} must be an object.`);
          continue;
        }
        const place = typeof entry.place === 'string' ? entry.place.trim() : '';
        const label = place || `Collaboration ${index + 1}`;
        if (!place) errors.push(`"${label}" needs a place name.`);
        if (place.length > 160) errors.push(`"${label}" has a place name that is too long.`);
        if (!CATEGORIES.has(entry.category)) errors.push(`"${label}" has an invalid category.`);
        if (entry.id != null && !isValidCollaborationId(entry.id)) errors.push(`"${label}" has an invalid id.`);

        const city = typeof entry.city === 'string' ? entry.city.trim() : '';
        const country = typeof entry.country === 'string' ? entry.country.trim() : '';
        if (!city && !country) errors.push(`"${label}" needs at least a city or a country.`);

        for (const [field, limit] of [['city', 120], ['country', 120], ['time', 120]]) {
          if (entry[field] != null && typeof entry[field] !== 'string') errors.push(`"${label}" has an invalid ${field} value.`);
          if (typeof entry[field] === 'string' && entry[field].length > limit) errors.push(`"${label}" has a ${field} value that is too long.`);
        }
        if (entry.story != null && typeof entry.story !== 'string') errors.push(`"${label}" has an invalid story value.`);
        if (typeof entry.story === 'string' && entry.story.length > 5000) errors.push(`"${label}" has a story that is too long.`);

        const urlBlank = entry.url == null || entry.url === '';
        if (!urlBlank) {
          if (typeof entry.url !== 'string') {
            errors.push(`"${label}" has an invalid place link.`);
          } else {
            const url = entry.url.trim();
            if (url.length > 2048) {
              errors.push(`"${label}" has a place link that is too long.`);
            } else if (url) {
              let parsed = null;
              try { parsed = new URL(url); } catch { /* not a real, absolute URL */ }
              if (!/^https:\/\/[^/?#\s\\]+/i.test(url) || !parsed || parsed.protocol !== 'https:' || !parsed.hostname) {
                errors.push(`"${label}" has a place link that must start with https://.`);
              }
            }
          }
        }

        if (!Array.isArray(entry.images) || entry.images.length === 0) {
          errors.push(`"${label}" has no photograph.`);
        } else if (entry.images.some(image => !isSafeImage(image))) {
          errors.push(`"${label}" has an invalid photograph address.`);
        }
      }

      const suppliedIds = payload.collaborations.map(entry => entry?.id).filter(id => typeof id === 'string' && id);
      const duplicateIds = suppliedIds.filter((id, index) => suppliedIds.indexOf(id) !== index);
      if (duplicateIds.length) errors.push('Collaborations have duplicate ids.');
    }
  }

  const details = payload.site ?? {};
  if (details.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(details.email).trim())) {
    errors.push('The contact email address is not valid.');
  }
  if (details.instagram && !/^https:\/\//i.test(String(details.instagram).trim())) {
    errors.push('The Instagram link must start with https://.');
  }
  return errors;
}

/* D1 has no interactive transactions, so the whole save goes through batch(),
   which is atomic. A failed save leaves the previous content untouched.
   Postcard ids are still reassigned on every publish (1, 2, 3…) rather than
   kept stable, since nothing outside the postcards tables links to them.
   Collaboration ids are kept stable instead: a supplied id survives an edit,
   a reorder and a republish unchanged (see collaborationId above), which is
   why they are generated here rather than left to D1 to assign.

   Collaborations are only touched when the payload actually mentions them.
   That keeps an older PUT body — one saved before this field existed — from
   wiping out collaborations it never knew about, and keeps publishing
   postcards and site details working on a database that has not been
   migrated yet. A payload that does mention collaborations on an unmigrated
   database is refused outright, before any statement runs, rather than
   silently publishing everything except the collaborations: that would read
   as a successful save while quietly losing data. */
export async function writeContent(db, payload) {
  const touchesCollaborations = Object.prototype.hasOwnProperty.call(payload, 'collaborations');
  if (touchesCollaborations && !(await hasCollaborationsSchema(db))) {
    throw new Error('Collaboration publishing is unavailable until the database is migrated.');
  }

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

  if (touchesCollaborations) {
    statements.push(db.prepare('DELETE FROM collaboration_images'));
    statements.push(db.prepare('DELETE FROM collaborations'));

    (payload.collaborations ?? []).forEach((entry, index) => {
      const id = collaborationId(entry.id);
      statements.push(db.prepare(
        'INSERT INTO collaborations (id, place, category, city, country, time_label, story, url, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(id, entry.place ?? '', entry.category ?? 'Other', entry.city ?? '', entry.country ?? '', entry.time ?? '', entry.story ?? '', entry.url ?? '', index));
      (entry.images ?? []).forEach((image, imageIndex) => {
        statements.push(db.prepare(
          'INSERT INTO collaboration_images (collaboration_id, image, position) VALUES (?, ?, ?)'
        ).bind(id, image, imageIndex));
      });
    });
  }

  await db.batch(statements);
}
