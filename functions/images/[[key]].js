/* Serves photographs from R2. Public, immutable, and cached hard at the edge —
   the keys carry a random suffix, so a given URL never changes what it points
   at and can be cached forever. */

export async function onRequestGet(context) {
  const key = context.params.key.join('/');
  const object = await context.env.MEDIA.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  if (context.request.headers.get('If-None-Match') === object.httpEtag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(object.body, { headers });
}
