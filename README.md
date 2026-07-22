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

- Main copy and links: `index.html`
- Colors and layout: `styles.css`
- Portfolio project names, locations, and writing: `story-data.js`
- Homepage interactions: `script.js`
- Story detail page: `story.html`, `story.css`, and `story.js`
- Images and favicon: `assets/`

## Publishing

The included `CNAME` file configures GitHub Pages for `elseaway.com`. After publishing, point the domain's DNS records to GitHub Pages and enable HTTPS in the repository's Pages settings.

Contact links currently use `yarenkecici022@gmail.com`, and Instagram links to `@saucerfulsecrets`.
