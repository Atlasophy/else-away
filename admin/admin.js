/* The studio.
   One page, three views, one Publish button. Everything is held in memory and
   written in a single save, so a half-finished edit never reaches the site. */

const workspace = document.querySelector('[data-workspace]');
const statusLine = document.querySelector('[data-status]');
const publishButton = document.querySelector('[data-publish]');
const picker = document.querySelector('[data-picker]');
const pickerGrid = document.querySelector('[data-picker-grid]');

const state = { content: null, view: 'postcards', dirty: false, readOnly: false, images: [], problems: [] };

const escape = value => String(value ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const imageSrc = url => (url && (url.startsWith('http') || url.startsWith('/')) ? url : `../${url}`);

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
    state.content = module ? window.ELSE_AWAY : { site: {}, postcards: [] };
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
  const views = { postcards: viewPostcards, photos: viewPhotos, details: viewDetails };
  workspace.innerHTML = (state.problems.length ? problemsBlock() : '') + views[state.view]();
}

const problemsBlock = () => `
  <div class="problems">
    <h2>Nothing was published</h2>
    <ul>${state.problems.map(problem => `<li>${escape(problem)}</li>`).join('')}</ul>
  </div>`;

/* A postcard is a place: where, roughly when, a note about it, and however
   many photographs it takes to remember it by. The first photograph is the
   one the rail shows before anyone opens the card. */
function postcardCard(index, card) {
  const images = card.images ?? [];
  return `
    <div class="card postcard-card" data-postcard="${index}">
      <div class="fields">
        <div class="field"><label for="pc-${index}">City</label>
          <input id="pc-${index}" value="${escape(card.city)}" data-field="city" placeholder="Venice"></div>
        <div class="field"><label for="pn-${index}">Country</label>
          <input id="pn-${index}" value="${escape(card.country)}" data-field="country" placeholder="Italy"></div>
        <div class="field"><label for="pd-${index}">Time</label>
          <input id="pd-${index}" value="${escape(card.time)}" data-field="time" placeholder="2026"></div>
        <div class="field wide"><label for="pt-${index}">Note</label>
          <textarea id="pt-${index}" data-field="note" rows="3" placeholder="What this place was like.">${escape(card.note)}</textarea></div>
      </div>
      <div class="photo-field">
        <label>Photographs</label>
        <div class="photo-grid">
          ${images.map((url, photoIndex) => `
            <div class="photo-thumb">
              <img src="${escape(imageSrc(url))}" alt="">
              <button type="button" data-remove-photo="${index}.${photoIndex}" aria-label="Remove this photograph">✕</button>
            </div>`).join('')}
          <button type="button" class="ghost add photo-add" data-pick="postcards.${index}">+ Add photograph</button>
        </div>
      </div>
      <div class="row-actions">
        <button type="button" class="ghost" data-move="up">Move up</button>
        <button type="button" class="ghost" data-move="down">Move down</button>
        <button type="button" class="ghost danger" data-remove-postcard>Remove postcard</button>
      </div>
    </div>`;
}

function viewPostcards() {
  return `
    <div class="view-head">
      <h1>Postcards</h1>
      <p>The drifting row near the bottom of the site. Give each one a city
         and/or country, roughly when it was, a few photographs, and a note —
         for example <em>Venice, Italy, 2026</em> with the story of why it
         mattered. Publishing sends it straight to the site.</p>
    </div>
    <div class="season"><div class="season-body">
      ${state.content.postcards.map((card, index) => postcardCard(index, card)).join('')}
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
  const card = event.target.closest('[data-postcard]');

  if (event.target.dataset.siteField) {
    state.content.site[event.target.dataset.siteField] = event.target.value;
    return markDirty();
  }
  if (!field || !card) return;

  state.content.postcards[Number(card.dataset.postcard)][field] = event.target.value;
  markDirty();
});

workspace.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;

  if (button.dataset.addPostcard !== undefined) {
    state.content.postcards.push({ city: '', country: '', time: '', note: '', images: [] });
    markDirty(); return render();
  }
  if (button.hasAttribute('data-remove-postcard')) {
    state.content.postcards.splice(Number(button.closest('[data-postcard]').dataset.postcard), 1);
    markDirty(); return render();
  }
  if (button.dataset.removePhoto) {
    const [cardIndex, photoIndex] = button.dataset.removePhoto.split('.').map(Number);
    state.content.postcards[cardIndex].images.splice(photoIndex, 1);
    markDirty(); return render();
  }
  if (button.dataset.move) {
    const card = button.closest('[data-postcard]');
    const step = button.dataset.move === 'up' ? -1 : 1;
    const list = state.content.postcards;
    const from = Number(card.dataset.postcard);
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

/* Picking a photograph for a postcard adds it to that card's gallery rather
   than replacing anything, since a postcard can hold as many as Yaren likes. */
pickerGrid.addEventListener('click', event => {
  const chosen = event.target.closest('[data-choose]');
  if (!chosen || !pickerTarget) return;
  const [kind, a] = pickerTarget.split('.');
  const url = chosen.dataset.choose;
  if (kind === 'postcards') state.content.postcards[Number(a)].images.push(url);
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
