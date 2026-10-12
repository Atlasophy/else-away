/* The studio.
   One page, three views, one Publish button. Everything is held in memory and
   written in a single save, so a half-finished edit never reaches the site. */

const workspace = document.querySelector('[data-workspace]');
const statusLine = document.querySelector('[data-status]');
const publishButton = document.querySelector('[data-publish]');
const picker = document.querySelector('[data-picker]');
const pickerGrid = document.querySelector('[data-picker-grid]');
const pickerDialog = picker.querySelector('[role="dialog"]');
const uploadInput = document.querySelector('[data-upload-input]');
const reconnectButton = document.querySelector('[data-reconnect]');

const state = {
  content: null, view: 'postcards', dirty: false, readOnly: false, images: [], problems: [],
  // Tracked separately from `dirty`: whether the collaborations draft itself
  // has changed since it was last loaded or published. When the database
  // has not been migrated yet, this is what tells a postcard-only edit
  // apart from an edit that would actually need collaboration publishing.
  collabDirty: false,
  // In-flight guards so a duplicate click — real or programmatic — during
  // an upload or a publish already running cannot start a second one.
  publishing: false, uploading: false,
};
const CATEGORIES = ['Restaurant', 'Airbnb', 'Hotel', 'Other'];

const escape = value => String(value ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const imageSrc = url => (url && (url.startsWith('http') || url.startsWith('/')) ? url : `../${url}`);
const newCollabId = () => (typeof crypto !== 'undefined' && crypto.randomUUID)
  ? crypto.randomUUID()
  : `collab-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function setStatus(message, tone = '') {
  statusLine.textContent = message;
  statusLine.dataset.tone = tone;
}

function updatePublishAvailability() {
  publishButton.disabled = state.readOnly || state.publishing || state.uploading || !state.dirty;
}

function markDirty() {
  state.dirty = true;
  updatePublishAvailability();
  if (!state.readOnly) setStatus('Unpublished changes');
}

function markCollabDirty() {
  state.collabDirty = true;
  markDirty();
}

function setConnected(connected) {
  uploadInput.disabled = !connected;
  uploadInput.closest('.upload').classList.toggle('is-disabled', !connected);
  reconnectButton.hidden = connected;
}

/* ---------------------------------------------------------------- loading */

async function load() {
  try {
    const response = await fetch('/api/admin/content', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(String(response.status));
    state.content = await response.json();
    setConnected(true);
    setStatus('Up to date', 'saved');
  } catch {
    // No backend reachable — most likely running the site locally. Show the
    // real content so the studio can be tried, but never pretend it can save.
    const module = await import('../content.js').catch(() => null);
    state.content = module ? window.ELSE_AWAY : { site: {}, postcards: [], collaborations: [] };
    state.readOnly = true;
    setConnected(false);
    setStatus('Session expired — reload the Studio to reconnect', 'error');
  }
  state.content.collaborations ??= [];
  updatePublishAvailability();
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
  const views = { postcards: viewPostcards, collaborations: viewCollaborations, photos: viewPhotos, details: viewDetails };
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
              <button type="button" data-remove-photo="postcards.${index}.${photoIndex}" aria-label="Remove this photograph">✕</button>
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
      <p>The row just below the hero. Give each one a city
         and/or country, roughly when it was, a few photographs, and a note —
         for example <em>Venice, Italy, 2026</em> with the story of why it
         mattered. Publishing sends it straight to the site.</p>
    </div>
    <div class="season"><div class="season-body">
      ${state.content.postcards.map((card, index) => postcardCard(index, card)).join('')}
      <button type="button" class="ghost add" data-add-postcard>Add a postcard</button>
    </div></div>`;
}

/* A collaboration is a travel partnership: a place, a category, where and
   roughly when, a short story, an optional link, and however many
   photographs it takes to remember it by. The first photograph is the
   cover — the move-left/move-right buttons on each thumbnail are how that
   order, including which photograph leads, gets changed. */
function collaborationCard(index, entry) {
  const images = entry.images ?? [];
  return `
    <div class="card postcard-card" data-collab="${index}">
      <div class="fields">
        <div class="field wide"><label for="cp-${index}">Place name</label>
          <input id="cp-${index}" value="${escape(entry.place)}" data-field="place" placeholder="Casa Lio" maxlength="160"></div>
        <div class="field"><label for="cc-${index}">Category</label>
          <select id="cc-${index}" data-field="category">
            ${CATEGORIES.map(category => `<option value="${category}" ${entry.category === category ? 'selected' : ''}>${category}</option>`).join('')}
          </select></div>
        <div class="field"><label for="ccity-${index}">City</label>
          <input id="ccity-${index}" value="${escape(entry.city)}" data-field="city" placeholder="Menorca" maxlength="120"></div>
        <div class="field"><label for="ccountry-${index}">Country</label>
          <input id="ccountry-${index}" value="${escape(entry.country)}" data-field="country" placeholder="Spain" maxlength="120"></div>
        <div class="field"><label for="ctime-${index}">Date or period</label>
          <input id="ctime-${index}" value="${escape(entry.time)}" data-field="time" placeholder="Summer 2026" maxlength="120"></div>
        <div class="field wide"><label for="cstory-${index}">Short story</label>
          <textarea id="cstory-${index}" data-field="story" rows="3" placeholder="What this collaboration was like." maxlength="5000">${escape(entry.story)}</textarea></div>
        <div class="field wide"><label for="curl-${index}">Place link (optional)</label>
          <input id="curl-${index}" value="${escape(entry.url)}" data-field="url" placeholder="https://" maxlength="2048">
          <small>Must start with https:// — shown as "Visit place" from the story.</small></div>
      </div>
      <div class="photo-field">
        <label>Photographs</label>
        <div class="photo-grid">
          ${images.map((url, photoIndex) => `
            <div class="photo-thumb">
              <img src="${escape(imageSrc(url))}" alt="">
              <div class="photo-thumb-actions">
                <button type="button" data-photo-move="collaborations.${index}.${photoIndex}.left" aria-label="Move photograph earlier"${photoIndex === 0 ? ' disabled' : ''}>←</button>
                <button type="button" data-photo-move="collaborations.${index}.${photoIndex}.right" aria-label="Move photograph later"${photoIndex === images.length - 1 ? ' disabled' : ''}>→</button>
                <button type="button" data-remove-photo="collaborations.${index}.${photoIndex}" aria-label="Remove this photograph">✕</button>
              </div>
            </div>`).join('')}
          <button type="button" class="ghost add photo-add" data-pick="collaborations.${index}">+ Add photograph</button>
        </div>
      </div>
      <div class="row-actions">
        <button type="button" class="ghost" data-move="up">Move up</button>
        <button type="button" class="ghost" data-move="down">Move down</button>
        <button type="button" class="ghost danger" data-remove-collab>Remove collaboration</button>
      </div>
    </div>`;
}

function viewCollaborations() {
  const entries = state.content.collaborations ?? [];
  const unavailable = state.content.collaborationsAvailable === false;
  return `
    <div class="view-head">
      <h1>Collaborations</h1>
      <p>Travel partnerships — stays, restaurants, and places with a story.
         Each one shows a cover, a place, a category, and a short story when
         it opens. Publishing sends it straight to the site.</p>
    </div>
    ${unavailable ? `
      <div class="problems">
        <h2>Collaboration publishing is unavailable</h2>
        <ul><li>The site's database has not been migrated for this feature yet. You can still write a draft here — ask whoever looks after the site to run the migration before publishing.</li></ul>
      </div>` : ''}
    <div class="season"><div class="season-body">
      ${entries.length ? entries.map((entry, index) => collaborationCard(index, entry)).join('') : '<p class="picker-empty">No collaborations yet.</p>'}
      <button type="button" class="ghost add" data-add-collab>Add a collaboration</button>
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

function syncField(event) {
  const field = event.target.dataset.field;

  if (event.target.dataset.siteField) {
    state.content.site[event.target.dataset.siteField] = event.target.value;
    return markDirty();
  }
  if (!field) return;

  const postcard = event.target.closest('[data-postcard]');
  const collab = event.target.closest('[data-collab]');
  if (postcard) {
    state.content.postcards[Number(postcard.dataset.postcard)][field] = event.target.value;
    markDirty();
  } else if (collab) {
    state.content.collaborations[Number(collab.dataset.collab)][field] = event.target.value;
    markCollabDirty();
  }
}
// 'change' covers <select>, since the category field needs its value synced
// the moment it is chosen, not just when some other input event fires later.
workspace.addEventListener('input', syncField);
workspace.addEventListener('change', syncField);

workspace.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;

  if (button.dataset.addPostcard !== undefined) {
    state.content.postcards.push({ city: '', country: '', time: '', note: '', images: [] });
    markDirty(); return render();
  }
  if (button.dataset.addCollab !== undefined) {
    state.content.collaborations.push({ id: newCollabId(), place: '', category: 'Other', city: '', country: '', time: '', story: '', url: '', images: [] });
    markCollabDirty(); return render();
  }
  if (button.hasAttribute('data-remove-postcard')) {
    state.content.postcards.splice(Number(button.closest('[data-postcard]').dataset.postcard), 1);
    markDirty(); return render();
  }
  if (button.hasAttribute('data-remove-collab')) {
    state.content.collaborations.splice(Number(button.closest('[data-collab]').dataset.collab), 1);
    markCollabDirty(); return render();
  }
  if (button.dataset.removePhoto) {
    const [kind, cardIndex, photoIndex] = button.dataset.removePhoto.split('.');
    state.content[kind][Number(cardIndex)].images.splice(Number(photoIndex), 1);
    if (kind === 'collaborations') markCollabDirty(); else markDirty();
    return render();
  }
  if (button.dataset.photoMove) {
    const [kind, cardIndex, photoIndex, direction] = button.dataset.photoMove.split('.');
    const images = state.content[kind][Number(cardIndex)].images;
    const from = Number(photoIndex);
    const to = direction === 'left' ? from - 1 : from + 1;
    if (to < 0 || to >= images.length) return;
    [images[from], images[to]] = [images[to], images[from]];
    if (kind === 'collaborations') markCollabDirty(); else markDirty();
    return render();
  }
  if (button.dataset.move) {
    const postcard = button.closest('[data-postcard]');
    const collab = button.closest('[data-collab]');
    const step = button.dataset.move === 'up' ? -1 : 1;
    const list = postcard ? state.content.postcards : state.content.collaborations;
    const from = Number((postcard ?? collab).dataset[postcard ? 'postcard' : 'collab']);
    const to = from + step;
    if (to < 0 || to >= list.length) return;
    [list[from], list[to]] = [list[to], list[from]];
    if (collab) markCollabDirty(); else markDirty();
    return render();
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
let pickerLastFocused = null;

function closePicker(restoreFocus = true) {
  picker.hidden = true;
  document.querySelector('.bar').inert = false;
  workspace.inert = false;
  if (restoreFocus) pickerLastFocused?.focus();
  pickerLastFocused = null;
}

reconnectButton.addEventListener('click', () => location.reload());

async function openPicker(target) {
  pickerTarget = target;
  if (picker.hidden) {
    pickerLastFocused = document.activeElement;
    picker.hidden = false;
    document.querySelector('.bar').inert = true;
    workspace.inert = true;
    document.querySelector('[data-picker-close]').focus();
  }
  pickerGrid.innerHTML = '<p class="picker-empty">Looking…</p>';
  await loadImages();
  pickerGrid.innerHTML = state.images.length
    ? state.images.map(image => `<button type="button" data-choose="${escape(image.url)}"><img src="${escape(image.url)}" alt="${escape(image.alt)}" loading="lazy"></button>`).join('')
    : '<p class="picker-empty">Nothing uploaded yet. Add a photograph above.</p>';
}

document.querySelector('[data-picker-close]').addEventListener('click', closePicker);
picker.addEventListener('click', event => { if (event.target === picker) closePicker(); });
document.addEventListener('keydown', event => {
  if (picker.hidden) return;
  if (event.key === 'Escape') closePicker();
  if (event.key === 'Tab') {
    const controls = [...pickerDialog.querySelectorAll('button:not([hidden]), input:not([hidden])')];
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

/* Picking a photograph for a postcard adds it to that card's gallery rather
   than replacing anything, since a postcard can hold as many as Yaren likes. */
pickerGrid.addEventListener('click', event => {
  const chosen = event.target.closest('[data-choose]');
  if (!chosen || !pickerTarget) return;
  const [kind, a] = pickerTarget.split('.');
  const url = chosen.dataset.choose;
  if (kind === 'postcards') state.content.postcards[Number(a)].images.push(url);
  else if (kind === 'collaborations') state.content.collaborations[Number(a)].images.push(url);
  const focusTarget = pickerTarget;
  closePicker(false);
  if (kind === 'collaborations') markCollabDirty(); else markDirty();
  render();
  workspace.querySelector(`[data-pick="${focusTarget}"]`)?.focus();
});

/* Resizing here rather than on the server keeps a 12MB camera original off the
   network entirely, and means no image library has to run at the edge. The
   fallbacks keep this working in Safari versions without OffscreenCanvas. */
async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch { /* Safari can reject formats that its regular image decoder supports. */ }
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('This photograph could not be opened.'));
      image.src = url;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function canvasBlob(canvas) {
  if (typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type: 'image/webp', quality: 0.86 });
  }
  return new Promise((resolve, reject) => canvas.toBlob(
    blob => blob ? resolve(blob) : reject(new Error('This photograph could not be prepared.')),
    'image/webp',
    0.86,
  ));
}

async function prepare(file, maxEdge = 2000) {
  const image = await decodeImage(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
    const width = Math.round(image.width * scale);
    const height = Math.round(image.height * scale);
    const canvas = typeof OffscreenCanvas === 'function'
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement('canvas'), { width, height });
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not prepare the photograph.');
    context.drawImage(image.source, 0, 0, width, height);
    const blob = await canvasBlob(canvas);
    return { blob, width, height };
  } finally {
    image.close();
  }
}

uploadInput.addEventListener('change', async event => {
  const files = [...event.target.files];
  if (!files.length) return;
  if (state.readOnly) return setStatus('Session expired — reload the Studio to upload', 'error');
  if (state.publishing) {
    event.target.value = '';
    return setStatus('Publishing — try uploading again in a moment.', 'error');
  }

  state.uploading = true;
  uploadInput.disabled = true;
  updatePublishAvailability();
  try {
    for (const [position, file] of files.entries()) {
      setStatus(`Sending ${position + 1} of ${files.length}…`);
      try {
        const { blob, width, height } = await prepare(file);
        const form = new FormData();
        const type = blob.type || 'image/webp';
        const extension = type === 'image/png' ? 'png' : type === 'image/jpeg' ? 'jpg' : 'webp';
        form.append('file', new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.${extension}`, { type }));
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
  } finally {
    uploadInput.disabled = state.readOnly;
    state.uploading = false;
    updatePublishAvailability();
  }
});

/* -------------------------------------------------------------- publishing */

publishButton.addEventListener('click', async () => {
  if (state.readOnly || state.publishing || state.uploading) return;
  state.publishing = true;
  updatePublishAvailability();
  setStatus('Publishing…');
  state.problems = [];

  // An unmigrated database cannot accept collaborations at all. A payload
  // that never touches that field still lets postcard and detail changes
  // through — the field is only ever omitted here, never sent empty, so
  // writeContent's own distinction between "omitted" and "explicitly []"
  // stays meaningful. If the collaborations draft has actually changed,
  // silently dropping it would read as a successful save while losing
  // real edits, so that case is refused locally, before any request, with
  // the same message the server would give — and the draft is kept.
  const collaborationsUnavailable = state.content.collaborationsAvailable === false;
  if (collaborationsUnavailable && state.collabDirty) {
    state.problems = ['Collaboration publishing is unavailable until the database is migrated. Your collaboration changes have not been published — ask whoever looks after the site to run the migration first.'];
    setStatus('Nothing was published', 'error');
    state.publishing = false;
    updatePublishAvailability();
    return render();
  }

  const payload = { site: state.content.site, postcards: state.content.postcards };
  if (!collaborationsUnavailable) payload.collaborations = state.content.collaborations;

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
      return;
    }
    state.dirty = false;
    if (!collaborationsUnavailable) state.collabDirty = false;
    setStatus('Published', 'saved');
  } catch {
    setStatus('Could not reach the site. Nothing was published.', 'error');
  } finally {
    state.publishing = false;
    updatePublishAvailability();
    render();
  }
});

window.addEventListener('beforeunload', event => {
  if (state.dirty && !state.readOnly) event.preventDefault();
});

load();
