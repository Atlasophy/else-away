/* The live content, as a script the page can load directly.
   Loaded just before content.js, which only fills in if this did not answer.
   That way production serves what the studio published, while a plain static
   server still shows the committed snapshot and the site works offline.

   The path avoids a dot in its name deliberately: a Function at /content.js
   would be shadowed by the static file of the same name, which is exactly the
   trap this is climbing out of.

   Cached for a minute at the edge, which is why a publish takes about that
   long to appear. */

import { readContent } from '../lib/content.js';

export async function onRequestGet(context) {
  const content = await readContent(context.env.DB);
  return new Response(`window.ELSE_AWAY = ${JSON.stringify(content)};\n`, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=86400',
    },
  });
}
