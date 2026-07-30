/* Public read of the content tree. Cached at the edge and purged on publish,
   so visitors are served from cache rather than waking the database. */

import { readContent } from '../lib/content.js';

export async function onRequestGet(context) {
  const content = await readContent(context.env.DB);
  return Response.json(content, {
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
