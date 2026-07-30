/* Reads and writes the content tree.
   The shape returned here is exactly what content.js declares, so the public
   site consumes either source without knowing which it got. */

export async function readContent(db) {
  const [site, seasons, projects, postcards] = await Promise.all([
    db.prepare('SELECT key, value FROM site').all(),
    db.prepare('SELECT id, label, film, note FROM seasons ORDER BY position').all(),
    db.prepare('SELECT season_id, slug, title, type, place, location, image, deck, story FROM projects ORDER BY season_id, position').all(),
    db.prepare('SELECT image, meta, title, season_id, story_slug FROM postcards ORDER BY position').all(),
  ]);

  const bySeason = new Map(seasons.results.map(season => [season.id, { ...season, projects: [] }]));
  for (const row of projects.results) {
    bySeason.get(row.season_id)?.projects.push({
      slug: row.slug,
      title: row.title,
      type: row.type,
      place: row.place,
      location: row.location,
      image: row.image,
      deck: row.deck,
      story: row.story,
    });
  }

  return {
    site: Object.fromEntries(site.results.map(row => [row.key, row.value])),
    seasons: [...bySeason.values()],
    postcards: postcards.results.map(row => ({
      image: row.image,
      meta: row.meta,
      title: row.title,
      season: row.season_id,
      story: row.story_slug,
    })),
  };
}

/* Rejects rather than half-saves. A story whose slug collides with another in
   the same season would silently steal its URL, so that is caught here as well
   as by the UNIQUE constraint. */
export function validateContent(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') return ['Payload must be an object.'];
  if (!Array.isArray(payload.seasons) || payload.seasons.length === 0) errors.push('At least one season is required.');

  for (const season of payload.seasons ?? []) {
    if (!season.id) errors.push('A season is missing its id.');
    const slugs = new Set();
    for (const project of season.projects ?? []) {
      if (!project.slug) errors.push(`A story in ${season.id || 'a season'} is missing its slug.`);
      if (!project.title) errors.push(`A story in ${season.id || 'a season'} is missing its title.`);
      if (!project.image) errors.push(`"${project.title || project.slug}" has no photograph.`);
      if (slugs.has(project.slug)) errors.push(`Two stories in ${season.id} share the slug "${project.slug}".`);
      slugs.add(project.slug);
    }
  }

  const seasonIds = new Set((payload.seasons ?? []).map(season => season.id));
  for (const card of payload.postcards ?? []) {
    if (!seasonIds.has(card.season)) errors.push(`A postcard points at the unknown season "${card.season}".`);
    const season = (payload.seasons ?? []).find(entry => entry.id === card.season);
    if (season && !season.projects?.some(project => project.slug === card.story)) {
      errors.push(`The postcard "${card.title}" points at a story that no longer exists.`);
    }
  }
  return errors;
}

/* D1 has no interactive transactions, so the whole save goes through batch(),
   which is atomic. A failed save leaves the previous content untouched. */
export async function writeContent(db, payload) {
  const statements = [
    db.prepare('DELETE FROM postcards'),
    db.prepare('DELETE FROM projects'),
    db.prepare('DELETE FROM seasons'),
    db.prepare('DELETE FROM site'),
  ];

  for (const [key, value] of Object.entries(payload.site ?? {})) {
    statements.push(db.prepare('INSERT INTO site (key, value) VALUES (?, ?)').bind(key, String(value)));
  }

  payload.seasons.forEach((season, index) => {
    statements.push(db.prepare('INSERT INTO seasons (id, label, film, note, position) VALUES (?, ?, ?, ?, ?)')
      .bind(season.id, season.label ?? season.id, season.film ?? '', season.note ?? '', index));
    (season.projects ?? []).forEach((project, order) => {
      statements.push(db.prepare(
        'INSERT INTO projects (season_id, slug, title, type, place, location, image, deck, story, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(season.id, project.slug, project.title, project.type ?? '', project.place ?? '',
        project.location ?? '', project.image, project.deck ?? '', project.story ?? '', order));
    });
  });

  (payload.postcards ?? []).forEach((card, index) => {
    statements.push(db.prepare('INSERT INTO postcards (image, meta, title, season_id, story_slug, position) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(card.image, card.meta ?? '', card.title ?? '', card.season, card.story, index));
  });

  await db.batch(statements);
}
