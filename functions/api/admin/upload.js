/* Receives a photograph and stores it in R2.
   Resizing and webp conversion happen in the browser before the bytes are sent,
   so a 12MB camera original never crosses the network and no image library is
   needed on the server. The size ceiling here is a backstop against a client
   that skipped that step. */

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(['image/webp', 'image/jpeg', 'image/png']);

export async function onRequestPost(context) {
  const form = await context.request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'No photograph was attached.' }, { status: 400 });
  if (!ALLOWED.has(file.type)) return Response.json({ error: `${file.type || 'That file'} is not a photograph we can use.` }, { status: 415 });
  if (file.size > MAX_BYTES) return Response.json({ error: 'That photograph is too large even after resizing.' }, { status: 413 });

  const extension = file.type.split('/')[1].replace('jpeg', 'jpg');
  const stem = (form.get('name') || file.name || 'photograph')
    .toString().toLowerCase().replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'photograph';
  // Date-prefixed so uploads stay in order and two photographs sharing a name
  // cannot overwrite one another.
  const key = `photos/${new Date().toISOString().slice(0, 10)}/${stem}-${crypto.randomUUID().slice(0, 8)}.${extension}`;

  await context.env.MEDIA.put(key, file.stream(), {
    httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' },
  });

  await context.env.DB.prepare(
    'INSERT INTO images (key, alt, width, height, bytes) VALUES (?, ?, ?, ?, ?)'
  ).bind(key, form.get('alt') ?? '', Number(form.get('width')) || null, Number(form.get('height')) || null, file.size).run();

  return Response.json({ ok: true, key, url: `/images/${key}` });
}

export async function onRequestGet(context) {
  const { results } = await context.env.DB
    .prepare('SELECT key, alt, width, height, bytes, created_at FROM images ORDER BY created_at DESC LIMIT 200').all();
  return Response.json(
    { images: results.map(row => ({ ...row, url: `/images/${row.key}` })) },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
