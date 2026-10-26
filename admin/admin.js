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
const videoInput = document.querySelector('[data-upload-video]');
const pickerVideoGrid = document.querySelector('[data-picker-video-grid]');
const reconnectButton = document.querySelector('[data-reconnect]');

const state = { content: null, view: 'about', dirty: false, readOnly: false, images: [], videos: [], problems: [] };

const escape = value => String(value ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const isVideo = url => /\.(?:mp4|m4v|mov|webm|ogv)(?:[?#].*)?$/i.test(String(url ?? ''));
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

function setConnected(connected) {
  for (const input of [uploadInput, videoInput]) {
    input.disabled = !connected;
    input.closest('.upload').classList.toggle('is-disabled', !connected);
  }
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
    state.content = module ? window.ELSE_AWAY : { site: {}, postcards: [] };
    state.readOnly = true;
    setConnected(false);
    setStatus(location.hostname === 'localhost' || location.hostname === '127.0.0.1'
      ? 'Local preview — publishing is unavailable'
      : 'Studio disconnected — reload to reconnect', 'error');
  }
  state.content.site ??= {};
  state.content.collaborations ??= [];
  for (const group of window.ELSE_AWAY_COPY ?? []) {
    for (const field of group.fields) state.content.site[field.key] ??= field.default;
  }
  publishButton.disabled = true;
  render();
}

async function loadImages() {
  if (state.readOnly) { state.images = []; state.videos = []; return; }
  const [images, videos] = await Promise.all([
    fetch('/api/admin/upload').then(response => response.json()).catch(() => ({})),
    fetch('/api/admin/video').then(response => response.json()).catch(() => ({})),
  ]);
  state.images = images.images ?? [];
  state.videos = videos.videos ?? [];
}

/* One tile for either kind of media. Videos show their own first frame, so the
   studio needs no extra files to preview them. */
const mediaTile = (url, alt = '') => isVideo(url)
  ? `<video src="${escape(url)}#t=0.1" muted playsinline preload="metadata"></video><span class="media-badge">Video</span>`
  : `<img src="${escape(url)}" alt="${escape(alt)}" loading="lazy">`;

/* ----------------------------------------------------------------- views */

function render() {
  document.querySelectorAll('.tab').forEach(tab =>
    tab.setAttribute('aria-current', String(tab.dataset.view === state.view)));
  const views = { collaborations: viewCollaborations, about: () => viewWriting(true), writing: () => viewWriting(false), postcards: viewPostcards, photos: viewPhotos, details: viewDetails };
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
function postcardCard(index, card, kind = 'postcards') {
  const images = card.images ?? [];
  return `
    <div class="card postcard-card" data-postcard="${index}" data-kind="${kind}">
      <div class="fields">
        ${kind === 'collaborations' ? `
          ${[['title', 'Project title'], ['partner', 'Partner / brand'], ['location', 'Location'], ['year', 'Year']].map(([key, label]) => `<div class="field"><label for="collab-${index}-${key}">${label}</label><input id="collab-${index}-${key}" data-field="${key}" maxlength="${key === 'year' ? 120 : 160}" value="${escape(card[key])}"></div>`).join('')}
          <div class="field wide"><label for="collab-${index}-description">Project story</label><textarea id="collab-${index}-description" data-field="description" rows="4" maxlength="5000">${escape(card.description)}</textarea></div>
        ` : `
        <div class="field"><label for="pc-${index}">City</label>
          <input id="pc-${index}" value="${escape(card.city)}" data-field="city" placeholder="Venice"></div>
        <div class="field"><label for="pn-${index}">Country</label>
          <input id="pn-${index}" value="${escape(card.country)}" data-field="country" placeholder="Italy"></div>
        <div class="field"><label for="pd-${index}">Time</label>
          <input id="pd-${index}" value="${escape(card.time)}" data-field="time" placeholder="2026"></div>
        <div class="field wide"><label for="pt-${index}">Note</label>
          <textarea id="pt-${index}" data-field="note" rows="3" placeholder="What this place was like.">${escape(card.note)}</textarea></div>`}
      </div>
      <div class="photo-field">
        <label>Photographs &amp; videos</label>
        <div class="photo-grid">
          ${images.map((url, photoIndex) => `
            <div class="photo-thumb${isVideo(url) ? ' is-video' : ''}">
              ${isVideo(url)
                ? `<video src="${escape(imageSrc(url))}#t=0.1" muted playsinline preload="metadata"></video><span class="media-badge">Video</span>`
                : `<img src="${escape(imageSrc(url))}" alt="">`}
              <button type="button" data-remove-photo="${index}.${photoIndex}" data-remove-kind="${kind}" aria-label="Remove this photograph">✕</button>
            </div>`).join('')}
          <button type="button" class="ghost add photo-add" data-pick="${kind}.${index}">+ Add photo or video</button>
        </div>
      </div>
      <div class="row-actions">
        <button type="button" class="ghost" data-move="up">Move up</button>
        <button type="button" class="ghost" data-move="down">Move down</button>
        <button type="button" class="ghost danger" data-remove-postcard>Remove ${kind === 'collaborations' ? 'collaboration' : 'postcard'}</button>
      </div>
    </div>`;
}

function viewPostcards() {
  return `
    <div class="view-head">
      <h1>Postcards</h1>
      <p>Places and stories for your postcard collection. The first three appear on the homepage; every postcard is available on the Postcards page.</p>
    </div>
    <div class="season"><div class="season-body">
      ${state.content.postcards.map((card, index) => postcardCard(index, card)).join('')}
      <button type="button" class="ghost add" data-add-postcard>Add a postcard</button>
    </div></div>`;
}

function viewCollaborations() {
  return `<div class="view-head"><h1>Collaborations</h1><p>Give each project a title, partner, story, and photographs. The first photograph becomes its cover. The first three projects appear on the homepage.</p></div>
    <div class="season"><div class="season-body">
      ${state.content.collaborations.length ? state.content.collaborations.map((card, index) => postcardCard(index, card, 'collaborations')).join('') : '<p class="collection-editor-empty">No collaborations yet. Add your first project when it’s ready.</p>'}
      <button type="button" class="ghost add" data-add-collaboration>Add a collaboration</button>
    </div></div>`;
}

function viewPhotos() {
  return `
    <div class="view-head">
      <h1>Photos &amp; videos</h1>
      <p>Everything you have uploaded. Photographs are resized and converted
         before they are sent, so originals straight from the camera are fine.
         Videos go up exactly as they are, 4K and sound included.</p>
    </div>
    <div class="season"><div class="season-body">
      <button type="button" class="ghost add" data-open-picker="browse">Upload photos or videos</button>
      <div class="picker-grid" style="margin-top:18px">
        ${state.images.length
          ? state.images.map(image => `<button type="button" data-copy="${escape(image.url)}"><img src="${escape(image.url)}" alt="${escape(image.alt)}" loading="lazy"></button>`).join('')
          : '<p class="picker-empty">No photographs uploaded yet.</p>'}
      </div>
      <h3 class="picker-subhead">Videos</h3>
      <div class="picker-grid">
        ${state.videos.length
          ? state.videos.map(video => `<button type="button" class="is-video" data-copy="${escape(video.url)}">${mediaTile(video.url)}</button>`).join('')
          : '<p class="picker-empty">No videos uploaded yet.</p>'}
      </div>
    </div></div>`;
}

function viewWriting(aboutOnly) {
  const groups = (window.ELSE_AWAY_COPY ?? []).filter(group =>
    (group.title === 'About me') === aboutOnly);
  return `
    <div class="view-head"><h1>${aboutOnly ? 'About me' : 'Site writing'}</h1>
      <p>Edit the text shown on your website. Publish when you’re ready.</p></div>
    <div class="writing-editor">
      ${groups.map(group => `<section class="writing-section" aria-labelledby="group-${group.fields[0].key}">
        ${aboutOnly ? '' : `<h2 id="group-${group.fields[0].key}">${escape(group.title)}</h2>`}
        ${aboutOnly ? `<h2 class="sr-only" id="group-${group.fields[0].key}">About me text</h2>` : ''}
        <div class="fields">
          ${group.fields.map(field => `<div class="field wide">
            <label for="site-${field.key}">${escape(field.label)}</label>
            <textarea id="site-${field.key}" data-site-field="${field.key}" maxlength="5000" rows="${field.default.length > 150 ? 4 : 2}">${escape(state.content.site[field.key])}</textarea>
          </div>`).join('')}
        </div>
      </section>`).join('')}
    </div>`;
}

function viewDetails() {
  const site = state.content.site ?? {};
  const rows = [
    ['email', 'Email address'], ['emailSubject', 'Subject line on enquiries'],
    ['instagram', 'Instagram link'], ['credit', 'Footer credit'],
  ];
  return `
    <div class="view-head"><h1>Details</h1><p>Contact links and the credit at the bottom of your website.</p></div>
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

  state.content[card.dataset.kind ?? 'postcards'][Number(card.dataset.postcard)][field] = event.target.value;
  markDirty();
});

workspace.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;

  if (button.hasAttribute('data-add-collaboration')) {
    state.content.collaborations.push({ title: '', partner: '', location: '', year: '', description: '', images: [] });
    markDirty(); return render();
  }
  if (button.dataset.addPostcard !== undefined) {
    state.content.postcards.push({ city: '', country: '', time: '', note: '', images: [] });
    markDirty(); return render();
  }
  if (button.hasAttribute('data-remove-postcard')) {
    const card = button.closest('[data-postcard]');
    state.content[card.dataset.kind ?? 'postcards'].splice(Number(card.dataset.postcard), 1);
    markDirty(); return render();
  }
  if (button.dataset.removePhoto) {
    const [cardIndex, photoIndex] = button.dataset.removePhoto.split('.').map(Number);
    state.content[button.dataset.removeKind ?? 'postcards'][cardIndex].images.splice(photoIndex, 1);
    markDirty(); return render();
  }
  if (button.dataset.move) {
    const card = button.closest('[data-postcard]');
    const step = button.dataset.move === 'up' ? -1 : 1;
    const list = state.content[card.dataset.kind ?? 'postcards'];
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
  pickerVideoGrid.innerHTML = '';
  await loadImages();
  pickerGrid.innerHTML = state.images.length
    ? state.images.map(image => `<button type="button" data-choose="${escape(image.url)}"><img src="${escape(image.url)}" alt="${escape(image.alt)}" loading="lazy"></button>`).join('')
    : '<p class="picker-empty">No photographs yet. Add one above.</p>';
  pickerVideoGrid.innerHTML = state.videos.length
    ? state.videos.map(video => `<button type="button" class="is-video" data-choose="${escape(video.url)}" aria-label="Video, ${(video.bytes / 1048576).toFixed(0)} MB">${mediaTile(video.url)}</button>`).join('')
    : '<p class="picker-empty">No videos yet. Add one above.</p>';
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
const choosePicked = event => {
  const chosen = event.target.closest('[data-choose]');
  if (!chosen || !pickerTarget) return;
  const [kind, a] = pickerTarget.split('.');
  const url = chosen.dataset.choose;
  if (['postcards', 'collaborations'].includes(kind)) state.content[kind][Number(a)].images.push(url);
  const focusTarget = pickerTarget;
  closePicker(false);
  markDirty();
  render();
  workspace.querySelector(`[data-pick="${focusTarget}"]`)?.focus();
};
pickerGrid.addEventListener('click', choosePicked);
pickerVideoGrid.addEventListener('click', choosePicked);

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
  // The picker may have been closed while the upload ran; only refresh it if it is still open.
  if (!picker.hidden) await openPicker(pickerTarget);
});

/* -------------------------------------------------------------- the videos */
/* A 4K clip with sound can be several gigabytes, so it is never sent whole.
   The browser cuts it into 32 MB pieces and sends them one at a time to the
   multipart endpoint, retrying a piece that fails rather than the whole file.
   Nothing is re-encoded: what Yaren films is what visitors watch. */
const VIDEO_EXTENSIONS = new Set(['mp4', 'm4v', 'mov', 'webm', 'ogv']);
const VIDEO_PART_BYTES = 32 * 1024 * 1024;

async function videoApi(action, { method = 'POST', query = {}, body } = {}) {
  const url = `/api/admin/video?${new URLSearchParams({ action, ...query })}`;
  const isJson = body !== undefined && !(body instanceof Blob);
  const response = await fetch(url, { method, body: isJson ? JSON.stringify(body) : body });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? 'The video upload failed.');
  return result;
}

/* A still from early in the clip, so the site has a cover before the video
   loads. Best effort only — some codecs cannot be decoded for a still. */
async function videoPoster(file) {
  const url = URL.createObjectURL(file);
  const video = Object.assign(document.createElement('video'), { muted: true, preload: 'auto', playsInline: true, src: url });
  const once = name => new Promise((resolve, reject) => {
    video.addEventListener(name, resolve, { once: true });
    video.addEventListener('error', () => reject(new Error('unreadable')), { once: true });
  });
  try {
    await Promise.race([once('loadeddata'), new Promise((_, reject) => setTimeout(reject, 10000))]);
    const seeked = once('seeked');
    video.currentTime = Math.min(1, (video.duration || 2) * 0.1);
    await Promise.race([seeked, new Promise((_, reject) => setTimeout(reject, 10000))]);
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.84));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function uploadVideo(file, label) {
  const { key, uploadId } = await videoApi('create', { body: { name: file.name, size: file.size } });
  const total = Math.ceil(file.size / VIDEO_PART_BYTES);
  const parts = [];
  try {
    for (let number = 1; number <= total; number += 1) {
      const piece = file.slice((number - 1) * VIDEO_PART_BYTES, number * VIDEO_PART_BYTES);
      setStatus(`${label} — ${Math.round(((number - 1) / total) * 100)}%`);
      for (let attempt = 1; ; attempt += 1) {
        try {
          parts.push(await videoApi('part', { method: 'PUT', query: { key, uploadId, part: number }, body: piece }));
          break;
        } catch (error) {
          if (attempt === 3) throw error;
          await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
        }
      }
    }
    await videoApi('complete', { body: { key, uploadId, parts } });
  } catch (error) {
    await videoApi('abort', { body: { key, uploadId } }).catch(() => {});
    throw error;
  }
  setStatus(`${label} — adding preview…`);
  const poster = await videoPoster(file);
  if (poster) await videoApi('poster', { method: 'PUT', query: { key }, body: poster }).catch(() => {});
  return `/${key}`;
}

videoInput.addEventListener('change', async event => {
  const files = [...event.target.files];
  if (!files.length) return;
  if (state.readOnly) return setStatus('Session expired — reload the Studio to upload', 'error');

  const unsupported = files.find(file => !VIDEO_EXTENSIONS.has((file.name.split('.').pop() ?? '').toLowerCase()));
  if (unsupported) {
    event.target.value = '';
    return setStatus(`${unsupported.name} can’t be played in a browser. Use mp4, mov, m4v or webm.`, 'error');
  }

  videoInput.disabled = true;
  try {
    for (const [position, file] of files.entries()) {
      await uploadVideo(file, `Video ${position + 1} of ${files.length}`);
    }
    setStatus(`${files.length} video${files.length === 1 ? '' : 's'} uploaded`, 'saved');
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    videoInput.disabled = false;
    event.target.value = '';
  }
  // The picker may have been closed while the upload ran; only refresh it if it is still open.
  if (!picker.hidden) await openPicker(pickerTarget);
});

window.addEventListener('beforeunload', event => {
  if (videoInput.disabled && !state.readOnly) event.preventDefault();
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
    collaborations: state.content.collaborations,
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
