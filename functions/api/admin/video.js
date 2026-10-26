/* Receives videos and stores them in R2.
   A 4K clip with sound easily runs to several gigabytes, far more than one
   request to a Pages Function may carry. So the browser slices the file and
   sends it in parts through R2's multipart upload: create, then each part,
   then complete. Nothing is re-encoded — the original is what visitors watch —
   so the browser-playable containers (mp4/mov/m4v with H.264 or HEVC, webm,
   ogv) are accepted and everything else is turned away with a clear message.

   A small poster frame, grabbed in the browser at upload time, is stored next
   to the video as `<name>.poster.webp`. It is found by that naming rule alone,
   so videos need no database table: R2 itself is the list. */

const MAX_BYTES = 5 * 1024 * 1024 * 1024;
const MAX_PARTS = 10000;
const MAX_POSTER_BYTES = 2 * 1024 * 1024;

// Containers browsers can play. .mov and .m4v are the same family as .mp4 and
// are stored under that name so every browser treats them alike.
const FORMATS = {
  mp4: { extension: 'mp4', type: 'video/mp4' },
  m4v: { extension: 'mp4', type: 'video/mp4' },
  mov: { extension: 'mp4', type: 'video/mp4' },
  webm: { extension: 'webm', type: 'video/webm' },
  ogv: { extension: 'ogv', type: 'video/ogg' },
};

const KEY_PATTERN = /^videos\/\d{4}-\d{2}-\d{2}\/[a-z0-9-]+\.(?:mp4|webm|ogv)$/;
const CACHE = 'public, max-age=31536000, immutable';

const posterKey = key => key.replace(/\.[^.]+$/, '.poster.webp');
const fail = (error, status) => Response.json({ error }, { status });

export async function onRequestGet(context) {
  const videos = [];
  let cursor;
  do {
    const page = await context.env.MEDIA.list({ prefix: 'videos/', cursor, limit: 1000 });
    for (const object of page.objects) {
      if (object.key.endsWith('.poster.webp')) continue;
      videos.push({
        key: object.key,
        url: `/${object.key}`,
        poster: `/${posterKey(object.key)}`,
        bytes: object.size,
        created_at: object.uploaded.toISOString(),
      });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  videos.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return Response.json({ videos: videos.slice(0, 200) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const action = new URL(request.url).searchParams.get('action');
  let body;
  try { body = await request.json(); } catch { return fail('That did not arrive as valid data.', 400); }

  if (action === 'create') {
    const name = String(body.name ?? '');
    const format = FORMATS[(name.match(/\.([^.]+)$/)?.[1] ?? '').toLowerCase()];
    if (!format) return fail('That video format cannot be played in a browser. Use mp4, mov, m4v or webm.', 415);
    const size = Number(body.size);
    if (!Number.isFinite(size) || size <= 0) return fail('That video looks empty.', 400);
    if (size > MAX_BYTES) return fail('That video is larger than 5 GB.', 413);

    const stem = name.toLowerCase().replace(/\.[^.]+$/, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'video';
    const key = `videos/${new Date().toISOString().slice(0, 10)}/${stem}-${crypto.randomUUID().slice(0, 8)}.${format.extension}`;
    const upload = await env.MEDIA.createMultipartUpload(key, {
      httpMetadata: { contentType: format.type, cacheControl: CACHE },
    });
    return Response.json({ ok: true, key, uploadId: upload.uploadId });
  }

  const key = String(body.key ?? '');
  if (!KEY_PATTERN.test(key)) return fail('That is not a video address.', 400);
  const upload = env.MEDIA.resumeMultipartUpload(key, String(body.uploadId ?? ''));

  if (action === 'complete') {
    const parts = Array.isArray(body.parts) ? body.parts : [];
    if (!parts.length || parts.length > MAX_PARTS) return fail('The video arrived in an unexpected shape.', 400);
    try {
      await upload.complete(parts.map(part => ({ partNumber: Number(part.partNumber), etag: String(part.etag) })));
    } catch (error) {
      return fail(`The video could not be assembled: ${error.message ?? error}`, 500);
    }
    return Response.json({ ok: true, key, url: `/${key}`, poster: `/${posterKey(key)}` });
  }

  if (action === 'abort') {
    try { await upload.abort(); } catch { /* already gone */ }
    return Response.json({ ok: true });
  }

  return fail('Unknown action.', 400);
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const params = new URL(request.url).searchParams;
  const action = params.get('action');
  const key = params.get('key') ?? '';
  if (!KEY_PATTERN.test(key)) return fail('That is not a video address.', 400);

  if (action === 'part') {
    const partNumber = Number(params.get('part'));
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > MAX_PARTS) return fail('Invalid part number.', 400);
    const upload = env.MEDIA.resumeMultipartUpload(key, params.get('uploadId') ?? '');
    try {
      const part = await upload.uploadPart(partNumber, request.body);
      return Response.json({ ok: true, partNumber: part.partNumber, etag: part.etag });
    } catch (error) {
      return fail(`Part ${partNumber} could not be stored: ${error.message ?? error}`, 500);
    }
  }

  if (action === 'poster') {
    const bytes = await request.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > MAX_POSTER_BYTES) return fail('The preview frame is the wrong size.', 413);
    await env.MEDIA.put(posterKey(key), bytes, {
      httpMetadata: { contentType: 'image/webp', cacheControl: CACHE },
    });
    return Response.json({ ok: true });
  }

  return fail('Unknown action.', 400);
}
