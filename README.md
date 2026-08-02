# Else Away by Yaren

A responsive travel photography portfolio and journal for Yaren, presented as **Else Away** at [elseaway.com](https://elseaway.com/). The site uses plain HTML, CSS, and JavaScript, so there are no packages to install or build.

## Run locally

On Windows, double-click `start-else-away.cmd`. It starts the local server and opens the website automatically using Codex's bundled Python.

Alternatively, from this folder start a local server manually:

```powershell
python -m http.server 8000
```

Then open <http://localhost:8000>.

If `python` is unavailable but Node.js is installed:

```powershell
npx serve .
```

## Customize

- Postcards and site details: `content.js` — the single source of truth
- Main page copy and links: `index.html`
- Colors and layout: `styles.css`
- Homepage interactions, including the postcard lightbox: `script.js`
- Images and favicon: `assets/`

In production, `/api/content-script` loads the published database content before
`content.js`; the committed file remains an offline fallback. Yaren edits the
live content through `/admin`.

## The studio

`/admin` is where Yaren adds postcards, uploads photographs, and writes. Each
postcard holds a city, a country, roughly when it was, a note, and however many
photographs it takes to remember the place by — for example *Venice, Italy,
2026* with a handful of photographs and a short note about it. Opening `/admin`
locally shows the real content but refuses to save, since there is no database
to save to.

Photographs are resized and converted to webp **in the browser** before upload,
so originals straight from a camera are fine and nothing large crosses the
network.

## Deploying

The site runs on Cloudflare Pages. The Pages project is connected to this
repository, and every push to `main` deploys automatically. Content publishing
inside the studio does not require a code deploy: it writes directly to D1 and
appears publicly after the one-minute content cache expires.

R2 is the reason for choosing Cloudflare: it charges nothing for bandwidth, and
a photography portfolio is almost entirely bandwidth.

The manual setup steps below are only needed when rebuilding the Cloudflare
project from scratch.

1. **Create a Cloudflare account** and add `elseaway.com` to it. Cloudflare will
   give you two nameservers to set at your domain registrar. Keep the existing
   DNS records in place while the nameserver change propagates.

2. **Install the CLI and sign in.**
   ```bash
   npm install -g wrangler && wrangler login
   ```

3. **Create the database and the bucket.**
   ```bash
   wrangler d1 create else-away && wrangler r2 bucket create else-away-media
   ```
   Copy the printed `database_id` into `wrangler.toml`.

4. **Create the tables and load the current content.**
   ```bash
   wrangler d1 execute else-away --remote --file=schema.sql && wrangler d1 execute else-away --remote --file=seed.sql
   ```

5. **Deploy.**
   ```bash
   wrangler pages deploy .
   ```

6. **Protect the studio.** In the Cloudflare dashboard, under Zero Trust →
   Access → Applications, add a self-hosted application covering
   `elseaway.com/admin*` and `elseaway.com/api/admin*`, with a policy allowing
   Yaren's email address. Choose the one-time PIN login method so there is no
   password to store or lose. Copy the Application Audience tag and your team
   domain into `wrangler.toml`, then deploy again.

   The Functions verify this token themselves rather than assuming the request
   arrived through the front door, because the deployment also answers on its
   `*.pages.dev` hostname, which an Access policy on the custom domain does not
   cover.

7. **Point the domain at Pages** in Workers & Pages → Custom domains, then
   connect the GitHub repository and set `main` as the production branch.

Regenerate `seed.sql` from `content.js` at any time with:

```bash
python3 tools/seed-from-content.py
```

Contact links currently use `yarenkecici022@gmail.com`, and Instagram links to
`@saucerfulsecrets`.

## Where things live

- **Registrar**: Namecheap (renewal only — DNS is no longer managed there)
- **DNS**: Cloudflare zone `elseaway.com`, nameservers `uma`/`watson.ns.cloudflare.com`
- **Hosting**: Cloudflare Pages project `else-away`, apex and `www` both CNAME to
  `else-away.pages.dev`
- **Email**: five `eforward*.registrar-servers.com` MX records plus an SPF TXT,
  all left on Namecheap's forwarding service and unaffected by the move

Two things worth knowing before touching DNS again:

An ALIAS record at an external provider does **not** satisfy a Pages custom
domain. Pages verification looks for a literal CNAME, and an ALIAS resolves
server-side into A records, so Cloudflare never sees one. Apex domains
therefore need the zone on Cloudflare, where CNAME flattening handles it.

Cloudflare Access can only gate a hostname inside a Cloudflare zone. The same
underlying reason blocked `elseaway.com/admin` until the nameservers moved.
