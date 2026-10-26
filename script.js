const content = window.ELSE_AWAY ?? { site: {}, postcards: [] };
const site = content.site ?? {};

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ----------------------------------------------------------- site details */
/* These values are editable in the studio. Keep safe committed defaults in
   the HTML, then replace them only when the published value is usable. */
const defaultEmail = 'yarenkecici022@gmail.com';
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(site.email ?? '').trim())
  ? String(site.email).trim()
  : defaultEmail;
const emailSubject = String(site.emailSubject ?? 'A place worth remembering').trim();
const mailto = `mailto:${email}${emailSubject ? `?subject=${encodeURIComponent(emailSubject)}` : ''}`;

document.querySelectorAll('[data-email-link]').forEach(link => { link.href = mailto; });
document.querySelectorAll('[data-email-label]').forEach(link => {
  const text = link.firstChild;
  if (text?.nodeType === Node.TEXT_NODE) text.textContent = `${email} `;
});

const instagram = String(site.instagram ?? '').trim();
if (/^https:\/\//i.test(instagram)) {
  document.querySelectorAll('[data-instagram-link]').forEach(link => { link.href = instagram; });
}
document.querySelectorAll('[data-credit]').forEach(element => {
  element.textContent = String(site.credit ?? '').trim() || 'By Atlasophy';
});

/* Published writing is always rendered as text, never HTML. Existing markup
   stays intact until its text is edited; line breaks remain editable. */
for (const group of window.ELSE_AWAY_COPY ?? []) {
  for (const field of group.fields) {
    const value = site[field.key];
    if (typeof value !== 'string' || value === field.default) continue;
    document.querySelectorAll(`[data-copy="${field.key}"]`).forEach(element => {
      const lines = value.split('\n');
      element.replaceChildren();
      lines.forEach((line, index) => {
        if (index) element.append(document.createElement('br'));
        element.append(document.createTextNode(line));
      });
      if (field.key === 'aboutSignature') element.setAttribute('aria-label', value);
    });
  }
}

/* ------------------------------------------------------------- postcards */
/* Each postcard is a small place: a city, a country, roughly when it was,
   a handful of photographs, and a note. The rail shows a cover card that
   flips to a written side on hover; opening it goes to the lightbox, which
   is the only place all of its photographs live at once. */
const placeLabel = card => card.title || [card.city, card.country].filter(Boolean).join(', ') || 'Somewhere else';
const videoPattern = /\.(?:mp4|m4v|mov|webm|ogv)(?:[?#].*)?$/i;
const isVideo = url => videoPattern.test(String(url ?? ''));
/* Videos uploaded through the studio have a poster frame stored beside them,
   found by name alone. Videos from elsewhere simply have none. */
const posterFor = url => /^\/videos\//.test(String(url ?? '')) ? String(url).replace(/\.[^./]+$/, '.poster.webp') : '';
const countLabel = (count, noun) => count ? `${count} ${noun}${count === 1 ? '' : 's'}` : null;
const metaLabel = card => {
  const media = card.images ?? [];
  const videos = media.filter(isVideo).length;
  const bits = [card.partner, card.location, card.year ?? card.time,
    countLabel(media.length - videos, 'photograph'), countLabel(videos, 'video')].filter(Boolean);
  return bits.join(' · ');
};
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
const safeImageUrl = value => {
  const candidate = String(value ?? '').trim();
  if (!candidate) return '';
  try {
    const url = new URL(candidate.startsWith('assets/') ? `/${candidate}` : candidate, document.baseURI);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
};

const postcards = content.postcards ?? [];

const collaborations = content.collaborations ?? [];
const entries = [...postcards, ...collaborations];
const collectionHost = document.querySelector('[data-collection]:not([data-preview])');
let requestedEntry = null;

function renderCollection(host, query = '') {
  const kind = host.dataset.collection;
  const list = kind === 'collaborations' ? collaborations : postcards;
  const preview = host.hasAttribute('data-preview');
  const matches = list.map((card, index) => ({card, index})).filter(({card}) =>
    Object.values(card).filter(value => typeof value === 'string').join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()));
  const shown = preview ? matches.slice(0, 3) : matches;
  host.innerHTML = shown.length ? shown.map(({card, index}) => {
    const entryIndex = kind === 'collaborations' ? postcards.length + index : index;
    const title = placeLabel(card);
    const subtitle = kind === 'collaborations' ? [card.partner, card.location, card.year].filter(Boolean).join(' · ') : [card.country, card.time].filter(Boolean).join(' · ');
    const src = safeImageUrl(card.images?.[0]);
    const poster = isVideo(src) ? safeImageUrl(posterFor(card.images[0])) : '';
    const cover = !src ? ''
      : !isVideo(src) ? `<img src="${escapeHTML(src)}" alt="${escapeHTML(title)}" width="960" height="1200" loading="lazy">`
      : poster ? `<img src="${escapeHTML(poster)}" alt="${escapeHTML(title)}" width="960" height="1200" loading="lazy" data-video-cover="${escapeHTML(src)}">`
      : `<video src="${escapeHTML(src)}#t=0.1" muted playsinline preload="metadata" aria-label="${escapeHTML(title)}"></video>`;
    const inner = `<div class="collection-media">${cover}${isVideo(src) ? '<span class="collection-play" aria-hidden="true">▶</span>' : ''}<span class="collection-open" aria-hidden="true">↗</span></div>
      <div class="collection-card-copy"><p class="collection-meta">${escapeHTML(subtitle)}</p><h3>${escapeHTML(title)}</h3><p class="collection-note">${escapeHTML(card.description ?? card.note)}</p></div>`;
    return `<article class="collection-card">${preview
      ? `<a href="/${kind}/?entry=${index}" class="collection-card-link">${inner}</a>`
      : `<button type="button" class="collection-card-link" data-postcard-open="${entryIndex}" aria-haspopup="dialog" aria-label="${escapeHTML('Open '+title)}">${inner}</button>`}</article>`;
  }).join('') : `<div class="collection-empty"><h3>${query.trim() ? 'No matching stories' : kind === 'collaborations' ? 'The next story starts here.' : 'New postcards are on the way.'}</h3><p>${query.trim() ? 'Try another place, partner, or keyword.' : kind === 'collaborations' ? 'New collaborations will appear here as their stories are published.' : 'Come back soon for more places and moments.'}</p>${kind === 'collaborations' && !query.trim() ? `<a class="text-link" href="${mailto}">Let’s work together <span aria-hidden="true">↗</span></a>` : ''}</div>`;
  if (!preview) {
    const status = document.querySelector('[data-collection-status]');
    if (status) status.textContent = `${matches.length} ${kind === 'collaborations' ? 'collaboration' : 'postcard'}${matches.length === 1 ? '' : 's'}`;
  }
}
document.querySelectorAll('[data-collection]').forEach(host => {
  renderCollection(host);
  // A video whose poster frame is missing falls back to the clip's own first frame.
  host.addEventListener('error', event => {
    const cover = event.target;
    if (!(cover instanceof HTMLImageElement) || !cover.dataset.videoCover) return;
    const video = document.createElement('video');
    Object.assign(video, { src: `${cover.dataset.videoCover}#t=0.1`, muted: true, playsInline: true, preload: 'metadata' });
    video.setAttribute('aria-label', cover.alt);
    cover.replaceWith(video);
  }, true);
});
document.querySelector('[data-collection-search]')?.addEventListener('input', event => renderCollection(collectionHost, event.target.value));
if (collectionHost) {
  const query = new URLSearchParams(location.search).get('entry');
  const index = query !== null && /^\d+$/.test(query) ? Number(query) : -1;
  const list = collectionHost.dataset.collection === 'collaborations' ? collaborations : postcards;
  if (list[index]) requestedEntry = collectionHost.dataset.collection === 'collaborations' ? postcards.length + index : index;
}


/* ------------------------------------------------------- postcard lightbox */
const lightbox = document.querySelector('[data-postcard-lightbox]');
if (lightbox && entries.length) {
  const image = lightbox.querySelector('[data-postcard-lightbox-image]');
  const video = lightbox.querySelector('[data-postcard-lightbox-video]');
  const meta = lightbox.querySelector('[data-postcard-lightbox-meta]');
  const place = lightbox.querySelector('[data-postcard-lightbox-place]');
  const note = lightbox.querySelector('[data-postcard-lightbox-note]');
  const countLabel = lightbox.querySelector('[data-postcard-lightbox-count]');
  const prevButton = lightbox.querySelector('[data-postcard-lightbox-prev]');
  const nextButton = lightbox.querySelector('[data-postcard-lightbox-next]');
  let openCard = null;
  let openPhoto = 0;
  let lastFocused = null;
  const headerRegion = document.querySelector('[data-header]');
  const backgroundRegions = [...document.querySelectorAll('main > :not([data-postcard-lightbox]), .archive-footer, [data-mobile-menu]')];

  function stopVideo() {
    video.pause();
    video.removeAttribute('src');
    video.removeAttribute('poster');
    video.load();
  }

  function renderPhoto() {
    const photos = openCard.images ?? [];
    const photoUrl = safeImageUrl(photos[openPhoto]);
    const playing = isVideo(photoUrl);
    stopVideo();
    video.hidden = !playing;
    image.hidden = playing;
    if (playing) {
      // Sound is on by default: this is a deliberate click, not autoplay.
      video.setAttribute('aria-label', `${placeLabel(openCard)} — video ${openPhoto + 1} of ${photos.length}`);
      const poster = safeImageUrl(posterFor(photos[openPhoto]));
      if (poster) video.poster = poster;
      video.src = photoUrl;
      image.removeAttribute('src');
    } else if (photoUrl) image.src = photoUrl;
    else image.removeAttribute('src');
    image.alt = `${placeLabel(openCard)} — photograph ${openPhoto + 1} of ${photos.length}`;
    countLabel.textContent = photos.length > 1 ? `${openPhoto + 1} / ${photos.length}` : '';
    const multiple = photos.length > 1;
    prevButton.hidden = !multiple;
    nextButton.hidden = !multiple;
  }

  function openLightbox(index, trigger) {
    openCard = entries[index];
    if (!openCard) return;
    openPhoto = 0;
    lastFocused = trigger ?? document.activeElement;
    meta.textContent = metaLabel(openCard);
    place.textContent = placeLabel(openCard);
    note.textContent = openCard.description ?? openCard.note ?? '';
    renderPhoto();
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    backgroundRegions.forEach(region => { region.inert = true; });
    headerRegion.inert = true;
    lightbox.querySelector('.postcard-lightbox-close').focus();
  }

  function closeLightbox() {
    stopVideo();
    lightbox.hidden = true;
    document.body.style.overflow = '';
    backgroundRegions.forEach(region => { region.inert = false; });
    headerRegion.inert = false;
    openCard = null;
    lastFocused?.focus();
  }

  function step(direction) {
    if (!openCard) return;
    const total = (openCard.images ?? []).length;
    if (!total) return;
    openPhoto = (openPhoto + direction + total) % total;
    renderPhoto();
  }

  document.addEventListener('click', event => {
    const clickedPostcard = event.target.closest('[data-postcard-open]');
    if (clickedPostcard) {
      openLightbox(Number(clickedPostcard.dataset.postcardOpen), clickedPostcard);
    }
  });
  lightbox.querySelectorAll('[data-postcard-lightbox-close]').forEach(el => el.addEventListener('click', closeLightbox));
  prevButton.addEventListener('click', () => step(-1));
  nextButton.addEventListener('click', () => step(1));
  document.addEventListener('keydown', event => {
    if (lightbox.hidden) return;
    if (event.key === 'Escape') closeLightbox();
    // Arrow keys seek inside a focused video rather than changing slide.
    if (event.target !== video && event.key === 'ArrowLeft') step(-1);
    if (event.target !== video && event.key === 'ArrowRight') step(1);
    if (event.key === 'Tab') {
      const controls = [...lightbox.querySelectorAll('button:not([hidden])')];
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
  if (requestedEntry !== null) {
    const trigger = document.querySelector(`[data-postcard-open="${requestedEntry}"]`);
    openLightbox(requestedEntry, trigger);
  }

}

/* Dust in the beam. Only in the dark sections, and never when motion is
   reduced. */
function seedMotes(section, quantity) {
  if (!section || reduceMotion.matches) return;
  const field = document.createElement('div');
  field.className = 'motes';
  field.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < quantity; i += 1) {
    const mote = document.createElement('span');
    mote.className = 'mote';
    mote.style.cssText = `left:${Math.random() * 100}%;--mote-size:${(Math.random() * 2.6 + 1.4).toFixed(1)}px;--mote-duration:${(Math.random() * 18 + 20).toFixed(1)}s;--mote-delay:${(-Math.random() * 30).toFixed(1)}s;--mote-drift:${(Math.random() * 90 - 45).toFixed(0)}px;--mote-opacity:${(Math.random() * .3 + .18).toFixed(2)}`;
    field.appendChild(mote);
  }
  section.prepend(field);
}
seedMotes(document.querySelector('.about'), 16);
seedMotes(document.querySelector('.journal'), 20);

/* Siblings inside a revealed group arrive one after another. */
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
}, { threshold: .13 });
document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
document.querySelectorAll('.wwm-grid, .services, .intro-details').forEach(group => {
  [...group.children].forEach((child, index) => child.style.setProperty('--reveal-delay', `${index * 90}ms`));
});

/* Depth. Elements marked with data-parallax move against the scroll at their
   own rate, which separates foreground from background without any of them
   leaving their layout box. Transform only, one rAF loop for the whole page,
   and nothing at all when motion is reduced. */
const parallaxItems = reduceMotion.matches ? [] : [...document.querySelectorAll('[data-parallax]')].map(el => ({
  el,
  rate: Number(el.dataset.parallax) || .1
}));

const header = document.querySelector('[data-header]');
const heroImage = document.querySelector('.hero-image');
let ticking = false;

function updateScrollEffects() {
  const y = window.scrollY;
  header.classList.toggle('scrolled', y > 40);
  document.documentElement.style.setProperty('--scroll-progress', `${Math.min(1, y / (document.documentElement.scrollHeight - innerHeight)) * 100}%`);
  if (heroImage && y < innerHeight * 1.2) heroImage.style.setProperty('--hero-shift', `${y * .12}px`);

  const viewportMiddle = y + innerHeight / 2;
  parallaxItems.forEach(item => {
    const box = item.el.getBoundingClientRect();
    if (box.bottom < -200 || box.top > innerHeight + 200) return;
    const centre = y + box.top + box.height / 2;
    item.el.style.setProperty('--parallax-shift', `${(viewportMiddle - centre) * item.rate}px`);
  });
  ticking = false;
}

function requestScrollUpdate() {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(updateScrollEffects);
  }
}
window.addEventListener('scroll', requestScrollUpdate, { passive: true });
window.addEventListener('resize', requestScrollUpdate, { passive: true });
updateScrollEffects();

const menuToggle = document.querySelector('[data-menu-toggle]');
const mobileMenu = document.querySelector('[data-mobile-menu]');
const main = document.querySelector('main');

function setMenuOpen(open, returnFocus = false) {
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  mobileMenu.classList.toggle('open', open);
  header.classList.toggle('menu-open', open);
  document.body.style.overflow = open ? 'hidden' : '';
  main.inert = open;
  if (open) mobileMenu.querySelector('a')?.focus();
  else if (returnFocus) menuToggle.focus();
}

menuToggle.addEventListener('click', () => {
  setMenuOpen(menuToggle.getAttribute('aria-expanded') !== 'true');
});
mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', event => {
  const href = link.getAttribute('href');
  const target = href.startsWith('#') ? document.querySelector(href) : null;
  if (target) event.preventDefault();
  setMenuOpen(false);
  if (target) {
    target.tabIndex = -1;
    target.focus({ preventScroll: true });
    target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
    setTimeout(() => target.scrollIntoView({ behavior: 'smooth' }), 40);
  }
}));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
    setMenuOpen(false, true);
  }
});

document.querySelector('[data-year]').textContent = new Date().getFullYear();

/* The wipe transitions off-screen via transform, but a stale paint layer can
   occasionally leave it visually stuck even once the transform is correct.
   Once it has finished sliding away, drop it out of the render tree
   entirely so there is nothing left for a bad paint to hold onto. */
const pageWipe = document.querySelector('.page-wipe');
const hideWipe = () => { if (pageWipe) pageWipe.style.display = 'none'; };
if (pageWipe) pageWipe.addEventListener('transitionend', hideWipe, { once: true });
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    document.body.classList.add('page-ready');
    setTimeout(hideWipe, 1200);
  });
});
