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

- Stories, postcards, and site details: `content.js` — the single source of truth
- Main page copy and links: `index.html`
- Colors and layout: `styles.css`
- Homepage interactions: `script.js`
- Story detail page: `story.html`, `story.css`, and `story.js`
- Images and favicon: `assets/`

Once the studio is live (below), `content.js` is generated from the database and
Yaren edits everything through `/admin` instead.

## The studio

`/admin` is where Yaren adds stories, uploads photographs, writes, and sets the
map location for each place. Opening it locally shows the real content but
refuses to save, since there is no database to save to.

Photographs are resized and converted to webp **in the browser** before upload,
so originals straight from a camera are fine and nothing large crosses the
network.

## Deploying

The site currently runs on GitHub Pages, which serves static files only and so
cannot host the studio. Moving to Cloudflare Pages adds the database, the photo
storage, and the sign-in — and stays free at this scale.

R2 is the reason for choosing Cloudflare: it charges nothing for bandwidth, and
a photography portfolio is almost entirely bandwidth.

These steps need an account, so they are yours to run rather than Claude's.

1. **Create a Cloudflare account** and add `elseaway.com` to it. Cloudflare will
   give you two nameservers to set at your domain registrar. Until that
   propagates the site stays on GitHub Pages, so there is no rush between steps.

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

7. **Point the domain at Pages** in Workers & Pages → Custom domains, and remove
   the GitHub Pages custom domain so the two do not compete.

Regenerate `seed.sql` from `content.js` at any time with:

```bash
python3 tools/seed-from-content.py
```

Contact links currently use `yarenkecici022@gmail.com`, and Instagram links to
`@saucerfulsecrets`.
