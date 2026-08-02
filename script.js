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

/* ------------------------------------------------------------- postcards */
/* Each postcard is a small place: a city, a country, roughly when it was,
   a handful of photographs, and a note. The rail shows a cover card that
   flips to a written side on hover; opening it goes to the lightbox, which
   is the only place all of its photographs live at once. */
const placeLabel = card => [card.city, card.country].filter(Boolean).join(', ') || 'Somewhere else';
const metaLabel = card => {
  const count = (card.images ?? []).length;
  const bits = [card.time, count ? `${count} photograph${count === 1 ? '' : 's'}` : null].filter(Boolean);
  return bits.join(' · ');
};
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
const safeImageUrl = value => {
  const candidate = String(value ?? '').trim();
  if (!candidate) return '';
  try {
    const url = new URL(candidate, document.baseURI);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
};

const journalSet = document.querySelector('[data-journal-set]');
const postcards = content.postcards ?? [];

if (journalSet) {
  journalSet.innerHTML = postcards.length ? postcards.map((card, index) => `
    <article class="journal-card">
      <button type="button" class="journal-card-link" data-postcard-open="${index}" aria-haspopup="dialog" aria-label="${escapeHTML(`Open postcard from ${placeLabel(card)}${metaLabel(card) ? `, ${metaLabel(card)}` : ''}`)}">
        <div class="journal-card-inner">
          <div class="journal-front">
            <div class="journal-image" data-postcard-cover="${index}" aria-hidden="true"></div>
            <p class="post-meta">${escapeHTML(metaLabel(card))}</p>
            <h3>${escapeHTML(placeLabel(card))}</h3>
            <span class="journal-cta">View photographs <span aria-hidden="true">→</span></span>
          </div>
          <div class="journal-back">
            <span class="journal-postmark" aria-hidden="true">${escapeHTML(card.country || card.city || '')}${card.time ? `<br>${escapeHTML(card.time)}` : ''}</span>
            <p class="journal-note">${escapeHTML(card.note)}</p>
            <span class="journal-cta">View photographs <span aria-hidden="true">→</span></span>
          </div>
        </div>
      </button>
    </article>`).join('') : '<p class="journal-empty">New postcards are on the way.</p>';
  journalSet.querySelectorAll('[data-postcard-cover]').forEach(cover => {
    const card = postcards[Number(cover.dataset.postcardCover)];
    const url = safeImageUrl(card?.images?.[0]);
    if (url) cover.style.setProperty('--journal-image', `url("${url}")`);
  });
}

const journalTrack = document.querySelector('[data-journal-track]');
if (journalTrack && journalSet && postcards.length) {
  const journalClone = journalSet.cloneNode(true);
  journalClone.removeAttribute('data-journal-set');
  journalClone.setAttribute('aria-hidden', 'true');
  journalClone.querySelectorAll('button').forEach(button => button.setAttribute('tabindex', '-1'));
  journalTrack.appendChild(journalClone);
}

/* ------------------------------------------------------- postcard lightbox */
const lightbox = document.querySelector('[data-postcard-lightbox]');
if (lightbox && postcards.length) {
  const image = lightbox.querySelector('[data-postcard-lightbox-image]');
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
  const backgroundRegions = [...document.querySelectorAll('main > :not([data-postcard-lightbox])')];

  function renderPhoto() {
    const photos = openCard.images ?? [];
    const photoUrl = safeImageUrl(photos[openPhoto]);
    if (photoUrl) image.src = photoUrl;
    else image.removeAttribute('src');
    image.alt = `${placeLabel(openCard)} — photograph ${openPhoto + 1} of ${photos.length}`;
    countLabel.textContent = photos.length > 1 ? `${openPhoto + 1} / ${photos.length}` : '';
    const multiple = photos.length > 1;
    prevButton.hidden = !multiple;
    nextButton.hidden = !multiple;
  }

  function openLightbox(index, trigger) {
    openCard = postcards[index];
    if (!openCard) return;
    openPhoto = 0;
    lastFocused = trigger ?? document.activeElement;
    meta.textContent = metaLabel(openCard);
    place.textContent = placeLabel(openCard);
    note.textContent = openCard.note ?? '';
    renderPhoto();
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    backgroundRegions.forEach(region => { region.inert = true; });
    headerRegion.inert = true;
    lightbox.querySelector('.postcard-lightbox-close').focus();
  }

  function closeLightbox() {
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
    const trigger = event.target.closest('[data-postcard-open]');
    if (trigger) openLightbox(Number(trigger.dataset.postcardOpen), trigger);
  });
  lightbox.querySelectorAll('[data-postcard-lightbox-close]').forEach(el => el.addEventListener('click', closeLightbox));
  prevButton.addEventListener('click', () => step(-1));
  nextButton.addEventListener('click', () => step(1));
  document.addEventListener('keydown', event => {
    if (lightbox.hidden) return;
    if (event.key === 'Escape') closeLightbox();
    if (event.key === 'ArrowLeft') step(-1);
    if (event.key === 'ArrowRight') step(1);
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
