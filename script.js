const content = window.ELSE_AWAY ?? { site: {}, postcards: [], collaborations: [] };
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

/* ----------------------------------------------------------------- shared */
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
const safeExternalUrl = value => {
  const candidate = String(value ?? '').trim();
  if (!/^https:\/\//i.test(candidate)) return '';
  try {
    return new URL(candidate).href;
  } catch {
    return '';
  }
};

/* ------------------------------------------------------------- postcards */
/* Each postcard is a small place: a city, a country, roughly when it was,
   a handful of photographs, and a note. The rail shows a cover, the place
   and an optional date; opening it goes to the lightbox, which is the only
   place the note and the rest of its photographs live. */
const placeLabel = card => [card.city, card.country].filter(Boolean).join(', ') || 'Somewhere else';
const metaLabel = card => {
  const count = (card.images ?? []).length;
  const bits = [card.time, count ? `${count} photograph${count === 1 ? '' : 's'}` : null].filter(Boolean);
  return bits.join(' · ');
};

const journalSet = document.querySelector('[data-journal-set]');
const postcards = content.postcards ?? [];

if (journalSet) {
  journalSet.innerHTML = postcards.length ? postcards.map((card, index) => `
    <article class="journal-card" role="group" aria-roledescription="slide" aria-label="${escapeHTML(`${index + 1} of ${postcards.length}: ${placeLabel(card)}`)}">
      <button type="button" class="journal-card-link" data-postcard-open="${index}" aria-haspopup="dialog" aria-label="${escapeHTML(`Open postcard from ${placeLabel(card)}${metaLabel(card) ? `, ${metaLabel(card)}` : ''}`)}">
        <div class="journal-image" data-postcard-cover="${index}" aria-hidden="true"></div>
        <p class="post-meta">${escapeHTML(card.time ?? '')}</p>
        <h3>${escapeHTML(placeLabel(card))}</h3>
        <span class="journal-cta">View story <span aria-hidden="true">→</span></span>
      </button>
    </article>`).join('') : '<p class="journal-empty">New postcards are on the way.</p>';
  journalSet.querySelectorAll('[data-postcard-cover]').forEach(cover => {
    const card = postcards[Number(cover.dataset.postcardCover)];
    const url = safeImageUrl(card?.images?.[0]);
    if (url) cover.style.setProperty('--journal-image', `url("${url}")`);
  });
}

const journalTrack = document.querySelector('[data-journal-track]');
const journalRail = document.querySelector('.journal-rail');
const journalPrev = document.querySelector('[data-journal-prev]');
const journalNext = document.querySelector('[data-journal-next]');
const journalControls = document.querySelector('.journal-controls');
const journalCurrent = document.querySelector('[data-journal-current]');
const journalTotal = document.querySelector('[data-journal-total]');
const journalAnnouncement = document.querySelector('[data-journal-announcement]');
const journalCards = journalSet ? [...journalSet.querySelectorAll('.journal-card')] : [];

/* One stable horizontal rail replaces the duplicated drifting loop. Native
   scrolling handles touch and trackpads; the controls, keyboard and mouse
   drag all move the same scroll position and settle on the same card lanes. */
if (journalRail && journalTrack) {
  let journalIndex = 0;
  let scrollFrame = 0;
  let announceTimer = 0;
  let dragState = null;
  let suppressPostcardClick = false;
  let programmaticScroll = false;

  journalRail.classList.toggle('is-empty', !journalCards.length);
  journalControls.hidden = !journalCards.length;

  function cardOffset(index) {
    if (!journalCards.length) return 0;
    return journalCards[Math.max(0, Math.min(index, journalCards.length - 1))].offsetLeft - journalCards[0].offsetLeft;
  }

  function nearestCard() {
    if (!journalCards.length) return 0;
    return journalCards.reduce((nearest, card, index) => (
      Math.abs(cardOffset(index) - journalRail.scrollLeft) < Math.abs(cardOffset(nearest) - journalRail.scrollLeft)
        ? index
        : nearest
    ), 0);
  }

  function updateJournalControls(announce = false, index = nearestCard()) {
    journalIndex = index;
    const total = journalCards.length;
    journalCurrent.textContent = total ? String(journalIndex + 1) : '0';
    journalTotal.textContent = String(total);
    journalPrev.disabled = journalIndex === 0 || total < 2;
    journalNext.disabled = journalIndex >= total - 1 || total < 2;
    if (announce) {
      const card = postcards[journalIndex];
      journalAnnouncement.textContent = total
        ? `Postcard ${journalIndex + 1} of ${total}: ${placeLabel(card)}`
        : 'No postcards';
    }
  }

  function showCard(index) {
    if (!journalCards.length) return;
    journalIndex = Math.max(0, Math.min(index, journalCards.length - 1));
    programmaticScroll = true;
    journalRail.scrollTo({
      left: cardOffset(journalIndex),
      behavior: reduceMotion.matches ? 'auto' : 'smooth',
    });
    updateJournalControls(true, journalIndex);
  }

  journalPrev.addEventListener('click', () => showCard(journalIndex - 1));
  journalNext.addEventListener('click', () => showCard(journalIndex + 1));
  journalRail.addEventListener('keydown', event => {
    const directions = { ArrowLeft: -1, ArrowRight: 1 };
    if (event.key in directions) {
      event.preventDefault();
      showCard(nearestCard() + directions[event.key]);
    } else if (event.key === 'Home') {
      event.preventDefault();
      showCard(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      showCard(journalCards.length - 1);
    }
  });

  journalRail.addEventListener('scroll', () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      if (!programmaticScroll) updateJournalControls();
      clearTimeout(announceTimer);
      announceTimer = setTimeout(() => {
        programmaticScroll = false;
        updateJournalControls(true);
      }, 180);
    });
  }, { passive: true });

  journalRail.addEventListener('pointerdown', event => {
    programmaticScroll = false;
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    dragState = { id: event.pointerId, x: event.clientX, left: journalRail.scrollLeft, moved: false, captured: false };
  });
  journalRail.addEventListener('pointermove', event => {
    if (!dragState || dragState.id !== event.pointerId) return;
    const distance = event.clientX - dragState.x;
    if (Math.abs(distance) > 5 && !dragState.moved) {
      dragState.moved = true;
      dragState.captured = true;
      journalRail.setPointerCapture(event.pointerId);
      journalRail.classList.add('is-dragging');
    }
    if (dragState.moved) {
      event.preventDefault();
      journalRail.scrollLeft = dragState.left - distance;
    }
  });
  const finishDrag = event => {
    if (!dragState || dragState.id !== event.pointerId) return;
    suppressPostcardClick = dragState.moved;
    const captured = dragState.captured;
    dragState = null;
    journalRail.classList.remove('is-dragging');
    if (captured && journalRail.hasPointerCapture(event.pointerId)) journalRail.releasePointerCapture(event.pointerId);
    if (suppressPostcardClick) setTimeout(() => { suppressPostcardClick = false; }, 0);
  };
  journalRail.addEventListener('pointerup', finishDrag);
  journalRail.addEventListener('pointercancel', finishDrag);
  journalRail.addEventListener('click', event => {
    if (!suppressPostcardClick) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);
  journalRail.addEventListener('wheel', () => { programmaticScroll = false; }, { passive: true });
  window.addEventListener('resize', () => updateJournalControls(), { passive: true });
  reduceMotion.addEventListener('change', event => {
    // Settles on the current card lane immediately rather than letting an
    // already-started smooth scroll play out.
    if (!event.matches || !journalCards.length) return;
    programmaticScroll = true;
    journalRail.scrollTo({ left: cardOffset(journalIndex), behavior: 'auto' });
    updateJournalControls(true, journalIndex);
  });
  updateJournalControls(true);
}

/* ------------------------------------------------------ stories (collabs) */
/* Travel collaborations: a place, who it was with, a short story and a small
   gallery. Zero entries keeps the heading and an honest invitation. One
   entry gets one full-width composition. More than six starts with the
   first six and reveals the rest behind a plain "Show more" control. */
const collaborations = content.collaborations ?? [];
const storiesBody = document.querySelector('[data-stories-body]');
const SHOWN_INITIALLY = 6;

const storyLocation = entry => [entry.city, entry.country].filter(Boolean).join(', ');
const storyLabel = entry => [entry.place, storyLocation(entry)].filter(Boolean).join(', ') || 'A place with a story';

if (storiesBody) {
  storiesBody.classList.toggle('stories-body--empty', !collaborations.length);
  if (!collaborations.length) {
    storiesBody.innerHTML = `
      <p class="stories-invite">Open to collaborations with stays, restaurants, and places worth remembering.</p>
      <a class="text-link stories-invite-link" href="${mailto}">Start a story <span aria-hidden="true">↗</span></a>`;
  } else {
    const entryMarkup = (entry, index, hidden) => `
      <article class="story-entry reveal"${hidden ? ' hidden' : ''} style="--reveal-delay:${Math.min(index, 5) * 70}ms">
        <button type="button" class="story-media" data-story-open="${index}" aria-haspopup="dialog" aria-label="${escapeHTML(`Open story: ${storyLabel(entry)}`)}">
          <span class="story-image" aria-hidden="true"></span>
        </button>
        <div class="story-text">
          <p class="story-category">${escapeHTML(entry.category || 'Collaboration')}</p>
          <h3>${escapeHTML(entry.place)}</h3>
          <p class="story-location">${escapeHTML([storyLocation(entry), entry.time].filter(Boolean).join(' · '))}</p>
          <button type="button" class="text-link story-open" data-story-open="${index}">View story <span aria-hidden="true">→</span></button>
        </div>
      </article>`;

    const single = collaborations.length === 1;
    const overflow = collaborations.length > SHOWN_INITIALLY;
    storiesBody.innerHTML = `
      <div class="stories-list${single ? ' stories-list--single' : ''}" data-stories-list>
        ${collaborations.map((entry, index) => entryMarkup(entry, index, overflow && index >= SHOWN_INITIALLY)).join('')}
      </div>
      ${overflow ? '<button type="button" class="text-link stories-more" data-stories-more>Show more stories <span aria-hidden="true">↓</span></button>' : ''}`;

    storiesBody.querySelectorAll('.story-image').forEach((image, index) => {
      const url = safeImageUrl(collaborations[index]?.images?.[0]);
      if (url) image.style.setProperty('--story-image', `url("${url}")`);
    });

    const moreButton = storiesBody.querySelector('[data-stories-more]');
    moreButton?.addEventListener('click', () => {
      storiesBody.querySelectorAll('.story-entry[hidden]').forEach(entry => { entry.hidden = false; });
      moreButton.remove();
    });
  }
}

/* -------------------------------------------------------------- lightboxes */
/* Shared chrome for the postcard and story lightboxes: a small image gallery
   plus the writing about that place. Only one of the two can be open at a
   time, and opening either closes the other first. */
const headerRegion = document.querySelector('[data-header]');
const backgroundRegions = [...document.querySelectorAll('main > :not(.postcard-lightbox)')];
const openLightboxes = [];

/* Horizontal swipe on the gallery image only — never on the dialog as a
   whole, so the scrollable story text below keeps its native touch
   scrolling untouched. Mouse drags are left to the existing rail/pointer
   conventions elsewhere; this is for touch and pen. A gesture only commits
   to being a swipe once it has moved enough to tell horizontal from
   vertical apart, so an incidental vertical touch is never hijacked. */
function attachSwipe(container, onSwipe) {
  if (!container) return;
  let gesture = null;
  container.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, axis: null };
  });
  container.addEventListener('pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      gesture.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (gesture.axis === 'x') event.preventDefault();
  });
  const release = event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    if (gesture.axis === 'x' && Math.abs(dx) > 40) onSwipe(dx < 0 ? 1 : -1);
    gesture = null;
  };
  container.addEventListener('pointerup', release);
  container.addEventListener('pointercancel', () => { gesture = null; });
}

function createLightbox({ root, items, getLabel, getMeta, getNote, getUrl }) {
  if (!root || !items.length) return null;

  const image = root.querySelector('img');
  const meta = root.querySelector('[data-postcard-lightbox-meta], [data-story-lightbox-meta]');
  const place = root.querySelector('[data-postcard-lightbox-place], [data-story-lightbox-place]');
  const note = root.querySelector('[data-postcard-lightbox-note], [data-story-lightbox-note]');
  const countLabel = root.querySelector('[data-postcard-lightbox-count], [data-story-lightbox-count]');
  const link = root.querySelector('[data-postcard-lightbox-link], [data-story-lightbox-link]');
  const prevButton = root.querySelector('.postcard-lightbox-nav.prev');
  const nextButton = root.querySelector('.postcard-lightbox-nav.next');
  const closeButton = root.querySelector('.postcard-lightbox-close');

  let openItem = null;
  let openPhoto = 0;
  let lastFocused = null;
  let crossfadeTimer = 0;

  function renderPhoto(crossfade) {
    // Clearing any pending crossfade before scheduling or applying a new one
    // means a rapid next/previous, or a close and reopen onto a different
    // item, can never have a stale timer land after the fact and overwrite
    // what is on screen with the wrong photograph.
    clearTimeout(crossfadeTimer);
    const photos = openItem.images ?? [];
    const photoUrl = safeImageUrl(photos[openPhoto]);
    const apply = () => {
      if (photoUrl) image.src = photoUrl;
      else image.removeAttribute('src');
      image.alt = `${getLabel(openItem)} — photograph ${openPhoto + 1} of ${photos.length}`;
      countLabel.textContent = photos.length > 1 ? `${openPhoto + 1} / ${photos.length}` : '';
      const multiple = photos.length > 1;
      prevButton.hidden = !multiple;
      nextButton.hidden = !multiple;
    };
    if (crossfade && !reduceMotion.matches) {
      image.classList.add('is-switching');
      crossfadeTimer = setTimeout(() => { apply(); image.classList.remove('is-switching'); }, 90);
    } else {
      apply();
    }
  }

  function open(index, trigger) {
    openLightboxes.forEach(other => { if (other !== instance) other.close(); });
    openItem = items[index];
    if (!openItem) return;
    openPhoto = 0;
    lastFocused = trigger ?? document.activeElement;
    meta.textContent = getMeta(openItem);
    place.textContent = getLabel(openItem);
    note.textContent = getNote(openItem) ?? '';
    const url = getUrl ? safeExternalUrl(getUrl(openItem)) : '';
    if (link) {
      link.hidden = !url;
      if (url) link.href = url;
    }
    renderPhoto(false);
    root.hidden = false;
    document.body.style.overflow = 'hidden';
    backgroundRegions.forEach(region => { region.inert = true; });
    if (headerRegion) headerRegion.inert = true;
    closeButton.focus();
  }

  function close() {
    if (root.hidden) return;
    clearTimeout(crossfadeTimer);
    image.classList.remove('is-switching');
    root.hidden = true;
    document.body.style.overflow = '';
    backgroundRegions.forEach(region => { region.inert = false; });
    if (headerRegion) headerRegion.inert = false;
    openItem = null;
    lastFocused?.focus();
  }

  function step(direction) {
    if (!openItem) return;
    const total = (openItem.images ?? []).length;
    if (!total) return;
    openPhoto = (openPhoto + direction + total) % total;
    renderPhoto(true);
  }

  // Lets a motion-preference change mid-transition finish instantly rather
  // than only affecting the next action.
  function finishMotion() {
    clearTimeout(crossfadeTimer);
    image.classList.remove('is-switching');
    if (openItem) renderPhoto(false);
  }

  attachSwipe(root.querySelector('.postcard-lightbox-media'), step);

  root.querySelectorAll('[data-postcard-lightbox-close], [data-story-lightbox-close]').forEach(el => el.addEventListener('click', close));
  prevButton.addEventListener('click', () => step(-1));
  nextButton.addEventListener('click', () => step(1));
  root.addEventListener('keydown', event => {
    if (event.key === 'Tab') {
      // Includes "Visit place" and any other visible, enabled link —
      // not just buttons — so the trap wraps the whole dialog's real tab
      // order rather than skipping past it.
      const controls = [...root.querySelectorAll('button:not([hidden]):not(:disabled), a[href]:not([hidden])')];
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

  const instance = { open, close, step, finishMotion, get isOpen() { return !root.hidden; } };
  openLightboxes.push(instance);
  return instance;
}

const postcardLightboxRoot = document.querySelector('[data-postcard-lightbox]');
const postcardLightbox = createLightbox({
  root: postcardLightboxRoot,
  items: postcards,
  getLabel: placeLabel,
  getMeta: metaLabel,
  getNote: card => card.note,
});

const storyLightboxRoot = document.querySelector('[data-story-lightbox]');
const storyLightbox = createLightbox({
  root: storyLightboxRoot,
  items: collaborations,
  getLabel: storyLabel,
  getMeta: entry => [entry.category, entry.time].filter(Boolean).join(' · '),
  getNote: entry => entry.story,
  getUrl: entry => entry.url,
});

if (postcardLightbox) {
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-postcard-open]');
    if (trigger) postcardLightbox.open(Number(trigger.dataset.postcardOpen), trigger);
  });
  journalSet?.addEventListener('keydown', event => {
    if (event.repeat || !['Enter', ' '].includes(event.key)) return;
    const trigger = event.target.closest('[data-postcard-open]');
    if (!trigger) return;
    event.preventDefault();
    postcardLightbox.open(Number(trigger.dataset.postcardOpen), trigger);
  });
}
if (storyLightbox) {
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-story-open]');
    if (trigger) storyLightbox.open(Number(trigger.dataset.storyOpen), trigger);
  });
}

document.addEventListener('keydown', event => {
  const active = openLightboxes.find(box => box.isOpen);
  if (!active) return;
  if (event.key === 'Escape') active.close();
  if (event.key === 'ArrowLeft') active.step(-1);
  if (event.key === 'ArrowRight') active.step(1);
});

/* Siblings inside a revealed group arrive one after another. .reveal
   elements are visible by default in CSS, so no script at all, or an
   earlier error that stops this file before it reaches here, still leaves
   every heading reachable. Only once an IntersectionObserver is actually
   built and watching does an element become .reveal-armed — the class that
   opts it into the hidden, about-to-animate state — so a failed
   construction here falls back to the same plain, visible default rather
   than a half-armed one. Reduced motion skips arming entirely: everything
   is revealed immediately instead of waiting to scroll into view. */
function revealAllNow() {
  document.querySelectorAll('.reveal').forEach(element => element.classList.add('visible'));
}

if (reduceMotion.matches) {
  revealAllNow();
} else if ('IntersectionObserver' in window) {
  try {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
    }, { threshold: .13 });
    document.querySelectorAll('.reveal').forEach(element => {
      element.classList.add('reveal-armed');
      observer.observe(element);
    });
  } catch {
    revealAllNow();
  }
} else {
  revealAllNow();
}

/* A motion-preference change mid-session finishes or cancels whatever is
   running right now rather than only shaping the next action: every
   reveal appears immediately, and any lightbox mid-crossfade settles on
   its current photograph instead of waiting out the timer. */
reduceMotion.addEventListener('change', event => {
  if (!event.matches) return;
  revealAllNow();
  postcardLightbox?.finishMotion();
  storyLightbox?.finishMotion();
});

/* Header shrinks and the top progress bar fills as the page scrolls. */
const header = document.querySelector('[data-header]');
let ticking = false;

function updateScrollEffects() {
  const y = window.scrollY;
  header.classList.toggle('scrolled', y > 40);
  document.documentElement.style.setProperty('--scroll-progress', String(Math.min(1, y / Math.max(1, document.documentElement.scrollHeight - innerHeight))));
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
    setTimeout(() => target.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth' }), 40);
  }
}));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
    setMenuOpen(false, true);
  }
});

document.querySelector('[data-year]').textContent = new Date().getFullYear();
