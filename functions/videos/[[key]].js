/* Serves videos from R2.
   Unlike photographs, video cannot be sent as one body: browsers ask for byte
   ranges so they can start playing at once and let the viewer skip around a
   long 4K clip without downloading it all. Keys carry a random suffix, so a
   given URL never changes and may be cached for good. */

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  const key = `videos/${params.key.join('/')}`;
  const head = await env.MEDIA.head(key);
  if (!head) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  head.writeHttpMetadata(headers);
  headers.set('etag', head.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  if (request.headers.get('If-None-Match') === head.httpEtag) {
    return new Response(null, { status: 304, headers });
  }

  const size = head.size;
  const requested = request.headers.get('Range')?.match(/^bytes=(\d*)-(\d*)$/);
  let start = 0;
  let end = size - 1;
  let partial = false;

  if (requested && (requested[1] || requested[2])) {
    if (requested[1]) {
      start = Number(requested[1]);
      if (requested[2]) end = Math.min(end, Number(requested[2]));
    } else {
      // "bytes=-500" means the last 500 bytes.
      start = Math.max(0, size - Number(requested[2]));
    }
    if (start >= size || start > end) {
      headers.set('Content-Range', `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    partial = true;
  }

  headers.set('Content-Length', String(end - start + 1));
  if (partial) headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  if (request.method === 'HEAD') return new Response(null, { status: partial ? 206 : 200, headers });

  const object = await env.MEDIA.get(key, partial ? { range: { offset: start, length: end - start + 1 } } : undefined);
  if (!object) return new Response('Not found', { status: 404 });
  return new Response(object.body, { status: partial ? 206 : 200, headers });
}
