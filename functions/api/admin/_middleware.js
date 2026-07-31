/* Cloudflare Access gates /admin at the edge, but the deployment also answers
   on its *.pages.dev hostname, which an Access policy on the custom domain does
   not cover. So every admin call verifies the Access JWT itself rather than
   trusting that the request could only have arrived through the front door. */

const jwks = { keys: null, fetchedAt: 0 };
const JWKS_TTL_MS = 60 * 60 * 1000;

async function getKeys(teamDomain) {
  if (jwks.keys && Date.now() - jwks.fetchedAt < JWKS_TTL_MS) return jwks.keys;
  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error('Could not fetch Access signing keys.');
  const body = await response.json();
  jwks.keys = body.keys ?? [];
  jwks.fetchedAt = Date.now();
  return jwks.keys;
}

const decode = segment => {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded + '='.repeat((4 - padded.length % 4) % 4)), c => c.charCodeAt(0));
};

async function verify(token, teamDomain, audience) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(decode(parts[1])));

  const key = (await getKeys(teamDomain)).find(candidate => candidate.kid === header.kid);
  if (!key) return null;

  const publicKey = await crypto.subtle.importKey(
    'jwk', key, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
  );
  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, decode(parts[2]), signed)) return null;

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) return null;
  if (payload.nbf && payload.nbf > now) return null;
  // aud is the Access application id; without this check a token minted for any
  // other application in the same account would be accepted here.
  const audiences = [payload.aud].flat();
  if (audience && !audiences.includes(audience)) return null;

  return payload;
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const teamDomain = env.ACCESS_TEAM_DOMAIN;
  const audience = env.ACCESS_AUD;

  if (!teamDomain || !audience) {
    return Response.json({ error: 'Access is not configured on this deployment.' }, { status: 500 });
  }

  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return Response.json({ error: 'Not signed in.' }, { status: 401 });

  let identity;
  try {
    identity = await verify(token, teamDomain, audience);
  } catch {
    return Response.json({ error: 'Could not verify sign-in.' }, { status: 503 });
  }
  if (!identity) return Response.json({ error: 'Sign-in is not valid.' }, { status: 403 });

  context.data.email = identity.email ?? '';
  return next();
}
