/* The studio.
   One page, four views, one Publish button. Everything is held in memory and
   written in a single save, so a half-finished edit never reaches the site. */

const workspace = document.querySelector('[data-workspace]');
const statusLine = document.querySelector('[data-status]');
const publishButton = document.querySelector('[data-publish]');
const picker = document.querySelector('[data-picker]');
const pickerGrid = document.querySelector('[data-picker-grid]');

const state = { content: null, view: 'stories', dirty: false, readOnly: false, images: [], problems: [] };

const slugify = value => value.toLowerCase().replace(/[''']/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const escape = value => String(value ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function setStatus(message, tone = '') {
  statusLine.textContent = message;
  statusLine.dataset.tone = tone;
}

function markDirty() {
  state.dirty = true;
  publishButton.disabled = state.readOnly;
  if (!state.readOnly) setStatus('Unpublished changes');
}

/* ---------------------------------------------------------------- loading */

async function load() {
  try {
    const response = await fetch('/api/admin/content', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(String(response.status));
    state.content = await response.json();
    setStatus('Up to date', 'saved');
  } catch {
    // No backend reachable — most likely running the site locally. Show the
    // real content so the studio can be tried, but never pretend it can save.
    const module = await import('../content.js').catch(() => null);
    state.content = module ? window.ELSE_AWAY : { site: {}, seasons: [], postcards: [] };
    state.readOnly = true;
    setStatus('Preview only — not connected, nothing can be saved', 'error');
  }
  publishButton.disabled = true;
  render();
}

async function loadImages() {
  if (state.readOnly) { state.images = []; return; }
  try {
    const response = await fetch('/api/admin/upload');
    state.images = (await response.json()).images ?? [];
  } catch { state.images = []; }
}

/* ----------------------------------------------------------------- views */

function render() {
  document.querySelectorAll('.tab').forEach(tab =>
    tab.setAttribute('aria-current', String(tab.dataset.view === state.view)));
  const views = { stories: viewStories, postcards: viewPostcards, photos: viewPhotos, details: viewDetails };
  workspace.innerHTML = (state.problems.length ? problemsBlock() : '') + views[state.view]();
}

const problemsBlock = () => `
  <div class="problems">
    <h2>Nothing was published</h2>
    <ul>${state.problems.map(problem => `<li>${escape(problem)}</li>`).join('')}</ul>
  </div>`;

function viewStories() {
  return `
    <div class="view-head">
      <h1>Stories</h1>
      <p>Each season holds its own stories. Add as many as you like — the site
         counts them for you. The location is what the “Explore this place”
         button searches for on Google Maps.</p>
    </div>
    ${state.content.seasons.map((season, seasonIndex) => `
      <details class="season" ${seasonIndex === 0 ? 'open' : ''}>
        <summary>
          <h2>${escape(season.label)}</h2>
          <span class="season-film">${escape(season.film)}</span>
          <span class="season-tally">${season.projects.length} ${season.projects.length === 1 ? 'story' : 'stories'}</span>
        </summary>
        <div class="season-body">
          ${season.projects.map((project, index) => storyCard(seasonIndex, index, project)).join('')}
          <button type="button" class="ghost add" data-add-story="${seasonIndex}">Add a story to ${escape(season.label)}</button>
        </div>
      </details>`).join('')}`;
}

const storyCard = (seasonIndex, index, project) => `
  <div class="card" data-season="${seasonIndex}" data-index="${index}">
    <div class="thumb ${project.image ? '' : 'is-empty'}">
      ${project.image ? `<img src="${escape(project.image.startsWith('http') || project.image.startsWith('/') ? project.image : '../' + project.image)}" alt="">` : '<span>No photograph</span>'}
      <button type="button" data-pick="stories.${seasonIndex}.${index}">Choose</button>
    </div>
    <div class="fields">
      <div class="field"><label for="t-${seasonIndex}-${index}">Title</label>
        <input id="t-${seasonIndex}-${index}" value="${escape(project.title)}" data-field="title">
        <small class="slug-note">${escape(project.slug)}</small></div>
      <div class="field"><label for="p-${seasonIndex}-${index}">Place</label>
        <input id="p-${seasonIndex}-${index}" value="${escape(project.place)}" data-field="place"></div>
      <div class="field"><label for="k-${seasonIndex}-${index}">Kind</label>
        <input id="k-${seasonIndex}-${index}" value="${escape(project.type)}" data-field="type" placeholder="Stay, Café, Maker…"></div>
      <div class="field"><label for="l-${seasonIndex}-${index}">Location for the map</label>
        <input id="l-${seasonIndex}-${index}" value="${escape(project.location)}" data-field="location" placeholder="Provence France pottery studio"></div>
      <div class="field wide"><label for="d-${seasonIndex}-${index}">Short line</label>
        <textarea id="d-${seasonIndex}-${index}" data-field="deck" rows="2">${escape(project.deck)}</textarea></div>
      <div class="field wide"><label for="s-${seasonIndex}-${index}">The story</label>
        <textarea id="s-${seasonIndex}-${index}" data-field="story" rows="4">${escape(project.story)}</textarea></div>
      <div class="row-actions">
        <button type="button" class="ghost" data-move="up">Move up</button>
        <button type="button" class="ghost" data-move="down">Move down</button>
        <button type="button" class="ghost danger" data-remove-story>Remove</button>
      </div>
    </div>
  </div>`;

function viewPostcards() {
  const options = state.content.seasons.flatMap(season =>
    season.projects.map(project => ({ value: `${season.id}|${project.slug}`, label: `${season.label} — ${project.title}` })));
  return `
    <div class="view-head">
      <h1>Postcards</h1>
      <p>The drifting row near the bottom of the site. Each postcard opens a
         story, and its written side borrows that story's short line.</p>
    </div>
    <div class="season"><div class="season-body">
      ${state.content.postcards.map((card, index) => `
        <div class="card" data-postcard="${index}">
          <div class="thumb ${card.image ? '' : 'is-empty'}">
            ${card.image ? `<img src="${escape(card.image.startsWith('http') || card.image.startsWith('/') ? card.image : '../' + card.image)}" alt="">` : '<span>No photograph</span>'}
            <button type="button" data-pick="postcards.${index}">Choose</button>
          </div>
          <div class="fields">
            <div class="field wide"><label for="pt-${index}">Title</label>
              <input id="pt-${index}" value="${escape(card.title)}" data-field="title"></div>
            <div class="field"><label for="pm-${index}">Caption</label>
              <input id="pm-${index}" value="${escape(card.meta)}" data-field="meta" placeholder="Menorca · After midnight"></div>
            <div class="field"><label for="ps-${index}">Opens</label>
              <select id="ps-${index}" data-field="target">
                ${options.map(option => `<option value="${escape(option.value)}" ${option.value === `${card.season}|${card.story}` ? 'selected' : ''}>${escape(option.label)}</option>`).join('')}
              </select></div>
            <div class="row-actions">
              <button type="button" class="ghost" data-move="up">Move up</button>
              <button type="button" class="ghost" data-move="down">Move down</button>
              <button type="button" class="ghost danger" data-remove-postcard>Remove</button>
            </div>
          </div>
        </div>`).join('')}
      <button type="button" class="ghost add" data-add-postcard>Add a postcard</button>
    </div></div>`;
}

function viewPhotos() {
  return `
    <div class="view-head">
      <h1>Photographs</h1>
      <p>Everything you have uploaded. Photographs are resized and converted
         before they are sent, so originals straight from the camera are fine.</p>
    </div>
    <div class="season"><div class="season-body">
      <button type="button" class="ghost add" data-open-picker="browse">Upload photographs</button>
      <div class="picker-grid" style="margin-top:18px">
        ${state.images.length
          ? state.images.map(image => `<button type="button" data-copy="${escape(image.url)}"><img src="${escape(image.url)}" alt="${escape(image.alt)}" loading="lazy"></button>`).join('')
          : '<p class="picker-empty">Nothing uploaded yet.</p>'}
      </div>
    </div></div>`;
}

function viewDetails() {
  const site = state.content.site ?? {};
  const rows = [
    ['email', 'Email address'], ['emailSubject', 'Subject line on enquiries'],
    ['instagram', 'Instagram link'], ['credit', 'Footer credit'],
  ];
  return `
    <div class="view-head"><h1>Details</h1><p>The things that rarely change.</p></div>
    <div class="season"><div class="season-body"><div class="card" data-site style="grid-template-columns:1fr">
      <div class="fields">
        ${rows.map(([key, label]) => `
          <div class="field wide"><label for="site-${key}">${label}</label>
            <input id="site-${key}" value="${escape(site[key])}" data-site-field="${key}"></div>`).join('')}
      </div>
    </div></div></div>`;
}

/* ------------------------------------------------------------ interaction */

document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', async () => {
  state.view = tab.dataset.view;
  if (state.view === 'photos') await loadImages();
  render();
}));

workspace.addEventListener('input', event => {
  const field = event.target.dataset.field;
  const card = event.target.closest('[data-season], [data-postcard]');

  if (event.target.dataset.siteField) {
    state.content.site[event.target.dataset.siteField] = event.target.value;
    return markDirty();
  }
  if (!field || !card) return;

  if (card.dataset.postcard !== undefined) {
    const postcard = state.content.postcards[Number(card.dataset.postcard)];
    if (field === 'target') {
      const [season, story] = event.target.value.split('|');
      Object.assign(postcard, { season, story });
    } else postcard[field] = event.target.value;
    return markDirty();
  }

  const project = state.content.seasons[Number(card.dataset.season)].projects[Number(card.dataset.index)];
  project[field] = event.target.value;
  // The slug is the story's address. It follows the title only while the story
  // is new, so renaming a published story never breaks a link someone holds.
  if (field === 'title' && project.isNew) {
    project.slug = slugify(event.target.value) || 'untitled';
    card.querySelector('.slug-note').textContent = project.slug;
  }
  markDirty();
});

workspace.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;

  if (button.dataset.addStory !== undefined) {
    const season = state.content.seasons[Number(button.dataset.addStory)];
    season.projects.push({ slug: `untitled-${crypto.randomUUID().slice(0, 6)}`, title: '', type: '', place: '', location: '', image: '', deck: '', story: '', isNew: true });
    markDirty(); return render();
  }
  if (button.dataset.addPostcard !== undefined) {
    const first = state.content.seasons[0];
    state.content.postcards.push({ image: '', meta: '', title: '', season: first.id, story: first.projects[0]?.slug ?? '' });
    markDirty(); return render();
  }
  if (button.hasAttribute('data-remove-story')) {
    const card = button.closest('[data-season]');
    const season = state.content.seasons[Number(card.dataset.season)];
    const [removed] = season.projects.splice(Number(card.dataset.index), 1);
    const orphans = state.content.postcards.filter(postcard => postcard.season === season.id && postcard.story === removed.slug);
    if (orphans.length && !confirm(`${orphans.length} postcard(s) point at “${removed.title || 'this story'}”. Removing it will leave them pointing nowhere. Remove anyway?`)) {
      season.projects.splice(Number(card.dataset.index), 0, removed);
      return;
    }
    markDirty(); return render();
  }
  if (button.hasAttribute('data-remove-postcard')) {
    state.content.postcards.splice(Number(button.closest('[data-postcard]').dataset.postcard), 1);
    markDirty(); return render();
  }
  if (button.dataset.move) {
    const card = button.closest('[data-season], [data-postcard]');
    const step = button.dataset.move === 'up' ? -1 : 1;
    const list = card.dataset.postcard !== undefined
      ? state.content.postcards
      : state.content.seasons[Number(card.dataset.season)].projects;
    const from = Number(card.dataset.postcard ?? card.dataset.index);
    const to = from + step;
    if (to < 0 || to >= list.length) return;
    [list[from], list[to]] = [list[to], list[from]];
    markDirty(); return render();
  }
  if (button.dataset.pick) return openPicker(button.dataset.pick);
  if (button.dataset.openPicker) return openPicker(null);
  if (button.dataset.copy) {
    navigator.clipboard?.writeText(button.dataset.copy);
    setStatus('Address copied', 'saved');
  }
});

/* --------------------------------------------------------- the photographs */

let pickerTarget = null;

async function openPicker(target) {
  pickerTarget = target;
  picker.hidden = false;
  pickerGrid.innerHTML = '<p class="picker-empty">Looking…</p>';
  await loadImages();
  pickerGrid.innerHTML = state.images.length
    ? state.images.map(image => `<button type="button" data-choose="${escape(image.url)}"><img src="${escape(image.url)}" alt="${escape(image.alt)}" loading="lazy"></button>`).join('')
    : '<p class="picker-empty">Nothing uploaded yet. Add a photograph above.</p>';
}

document.querySelector('[data-picker-close]').addEventListener('click', () => { picker.hidden = true; });
picker.addEventListener('click', event => { if (event.target === picker) picker.hidden = true; });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !picker.hidden) picker.hidden = true; });

pickerGrid.addEventListener('click', event => {
  const chosen = event.target.closest('[data-choose]');
  if (!chosen || !pickerTarget) return;
  const [kind, a, b] = pickerTarget.split('.');
  const url = chosen.dataset.choose;
  if (kind === 'stories') state.content.seasons[Number(a)].projects[Number(b)].image = url;
  else state.content.postcards[Number(a)].image = url;
  picker.hidden = true;
  markDirty();
  render();
});

/* Resizing here rather than on the server keeps a 12MB camera original off the
   network entirely, and means no image library has to run at the edge. */
async function prepare(file, maxEdge = 2000) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.86 });
  return { blob, width, height };
}

document.querySelector('[data-upload-input]').addEventListener('change', async event => {
  const files = [...event.target.files];
  if (!files.length) return;
  if (state.readOnly) return setStatus('Not connected — photographs cannot be uploaded', 'error');

  for (const [position, file] of files.entries()) {
    setStatus(`Sending ${position + 1} of ${files.length}…`);
    try {
      const { blob, width, height } = await prepare(file);
      const form = new FormData();
      form.append('file', new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' }));
      form.append('name', file.name);
      form.append('width', width);
      form.append('height', height);
      const response = await fetch('/api/admin/upload', { method: 'POST', body: form });
      if (!response.ok) throw new Error((await response.json()).error ?? 'Upload failed.');
    } catch (error) {
      setStatus(error.message, 'error');
      return;
    }
  }
  event.target.value = '';
  setStatus(`${files.length} photograph${files.length === 1 ? '' : 's'} uploaded`, 'saved');
  await openPicker(pickerTarget);
});

/* -------------------------------------------------------------- publishing */

publishButton.addEventListener('click', async () => {
  if (state.readOnly) return;
  publishButton.disabled = true;
  setStatus('Publishing…');
  state.problems = [];

  const payload = {
    site: state.content.site,
    seasons: state.content.seasons.map(season => ({
      ...season,
      projects: season.projects.map(({ isNew, ...project }) => project),
    })),
    postcards: state.content.postcards,
  };

  try {
    const response = await fetch('/api/admin/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) {
      state.problems = body.errors ?? [body.error ?? 'Something went wrong.'];
      setStatus('Nothing was published', 'error');
      publishButton.disabled = false;
      return render();
    }
    state.content.seasons.forEach(season => season.projects.forEach(project => delete project.isNew));
    state.dirty = false;
    setStatus('Published', 'saved');
    render();
  } catch {
    setStatus('Could not reach the site. Nothing was published.', 'error');
    publishButton.disabled = false;
  }
});

window.addEventListener('beforeunload', event => {
  if (state.dirty && !state.readOnly) event.preventDefault();
});

load();
