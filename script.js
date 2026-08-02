const content = window.ELSE_AWAY;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

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

const journalSet = document.querySelector('[data-journal-set]');
const postcards = content.postcards ?? [];

if (journalSet) {
  journalSet.innerHTML = postcards.map((card, index) => `
    <article class="journal-card">
      <button type="button" class="journal-card-link" data-postcard-open="${index}" aria-haspopup="dialog">
        <div class="journal-card-inner">
          <div class="journal-front">
            <div class="journal-image" style="--journal-image:url('${(card.images ?? [])[0] ?? ''}')" aria-hidden="true"></div>
            <p class="post-meta">${metaLabel(card)}</p>
            <h3>${placeLabel(card)}</h3>
            <span class="journal-cta">View photographs <span aria-hidden="true">→</span></span>
          </div>
          <div class="journal-back">
            <span class="journal-postmark" aria-hidden="true">${card.country || card.city || ''}${card.time ? `<br>${card.time}` : ''}</span>
            <p class="journal-note">${card.note ?? ''}</p>
            <span class="journal-cta">View photographs <span aria-hidden="true">→</span></span>
          </div>
        </div>
      </button>
    </article>`).join('');
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

  function renderPhoto() {
    const photos = openCard.images ?? [];
    image.src = photos[openPhoto] ?? '';
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
    lightbox.querySelector('.postcard-lightbox-close').focus();
  }

  function closeLightbox() {
    lightbox.hidden = true;
    document.body.style.overflow = '';
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
menuToggle.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!open));
  menuToggle.setAttribute('aria-label', open ? 'Open menu' : 'Close menu');
  mobileMenu.classList.toggle('open', !open);
  header.classList.toggle('menu-open', !open);
  document.body.style.overflow = open ? '' : 'hidden';
});
mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', event => {
  const href = link.getAttribute('href');
  const target = href.startsWith('#') ? document.querySelector(href) : null;
  if (target) event.preventDefault();
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Open menu');
  mobileMenu.classList.remove('open');
  header.classList.remove('menu-open');
  document.body.style.overflow = '';
  if (target) setTimeout(() => target.scrollIntoView({ behavior: 'smooth' }), 40);
}));

document.querySelector('[data-year]').textContent = new Date().getFullYear();
requestAnimationFrame(() => document.body.classList.add('page-ready'));
