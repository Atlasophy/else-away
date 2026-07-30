/* Read and save content from the dashboard. Reads bypass the public cache so
   Yaren always edits what is actually stored. */

import { readContent, validateContent, writeContent } from '../../lib/content.js';

export async function onRequestGet(context) {
  return Response.json(await readContent(context.env.DB), {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function onRequestPut(context) {
  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return Response.json({ error: 'That did not arrive as valid data.' }, { status: 400 });
  }

  const errors = validateContent(payload);
  if (errors.length) return Response.json({ error: 'Nothing was saved.', errors }, { status: 422 });

  try {
    await writeContent(context.env.DB, payload);
  } catch (error) {
    return Response.json({ error: 'Nothing was saved.', errors: [String(error.message ?? error)] }, { status: 500 });
  }

  return Response.json({ ok: true, savedBy: context.data.email });
}
