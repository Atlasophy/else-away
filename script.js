const seasons = window.ATLAS_STORIES;

const portfolio = document.querySelector('.portfolio');
const gallery = document.querySelector('[data-gallery]');
const track = document.querySelector('[data-gallery-track]');
const count = document.querySelector('[data-current-count]');
const note = document.querySelector('[data-season-note]');
const seasonButtons = [...document.querySelectorAll('[data-season-button]')];
let activeSeason = 'spring';
let activeIndex = 0;
let autoTimer;

function renderSeason(name, animate = true) {
  activeSeason = name;
  activeIndex = 0;
  const data = seasons[name];
  portfolio.dataset.season = name;
  note.textContent = data.note;
  count.textContent = '01';
  seasonButtons.forEach(button => button.setAttribute('aria-selected', String(button.dataset.seasonButton === name)));

  track.innerHTML = data.projects.map((project, index) => `
    <a class="project-card" data-project-index="${index}" href="story.html?season=${name}&story=${index}" aria-label="Open story: ${project.title}, ${project.place}">
      <img class="project-image" src="assets/stories/${name}-${index + 1}.webp" alt="" loading="lazy">
      <span class="frame-mark" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
      <div class="project-info">
        <p>${project.type} · ${project.place}</p>
        <h3>${project.title}</h3>
        <span class="project-open">View story <i>↗</i></span>
      </div>
    </a>
  `).join('');
  if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    track.querySelectorAll('.project-card').forEach((card, index) => card.animate(
      [{ opacity: 0, transform: 'translateY(28px)' }, { opacity: 1, transform: 'none' }],
      { duration: 650, delay: index * 65, easing: 'cubic-bezier(.2,.65,.25,1)', fill: 'both' }
    ));
  }
  gallery.scrollLeft = 0;
  resetAutoPlay();
}

function cardStep() {
  const card = track.querySelector('.project-card');
  return card ? card.getBoundingClientRect().width + 18 : 300;
}

function goTo(index) {
  activeIndex = Math.max(0, Math.min(4, index));
  gallery.scrollTo({ left: activeIndex * cardStep(), behavior: 'smooth' });
  count.textContent = String(activeIndex + 1).padStart(2, '0');
  resetAutoPlay();
}

function resetAutoPlay() {
  clearInterval(autoTimer);
}

seasonButtons.forEach(button => button.addEventListener('click', () => renderSeason(button.dataset.seasonButton)));
document.querySelector('[data-gallery-prev]').addEventListener('click', () => goTo(activeIndex - 1));
document.querySelector('[data-gallery-next]').addEventListener('click', () => goTo(activeIndex === 4 ? 0 : activeIndex + 1));
gallery.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') goTo(activeIndex - 1);
  if (event.key === 'ArrowRight') goTo(activeIndex === 4 ? 0 : activeIndex + 1);
});

let dragging = false;
let dragMoved = false;
let dragStart = 0;
let scrollStart = 0;
gallery.addEventListener('pointerdown', event => {
  dragging = true;
  dragMoved = false;
  dragStart = event.clientX;
  scrollStart = gallery.scrollLeft;
  gallery.classList.add('dragging');
  gallery.setPointerCapture(event.pointerId);
  clearInterval(autoTimer);
});
gallery.addEventListener('pointermove', event => {
  if (dragging) {
    if (Math.abs(event.clientX - dragStart) > 6) dragMoved = true;
    gallery.scrollLeft = scrollStart - (event.clientX - dragStart);
  }
});

gallery.addEventListener('mouseenter', () => clearInterval(autoTimer));
gallery.addEventListener('mouseleave', resetAutoPlay);
track.addEventListener('click', event => {
  const link = event.target.closest('.project-card');
  if (!link || dragMoved) {
    if (dragMoved) event.preventDefault();
    return;
  }
  event.preventDefault();
  document.body.classList.add('page-leaving');
  setTimeout(() => { window.location.href = link.href; }, 420);
});
gallery.addEventListener('pointerup', () => {
  dragging = false;
  gallery.classList.remove('dragging');
  activeIndex = Math.max(0, Math.min(4, Math.round(gallery.scrollLeft / cardStep())));
  goTo(activeIndex);
});

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/* Give every postcard a written back. The words come from the story it links
   to, so the card and the story it opens never drift out of sync. */
const journalSet = document.querySelector('[data-journal-set]');
if (journalSet) {
  journalSet.querySelectorAll('.journal-card').forEach(card => {
    const link = card.querySelector('a');
    if (!link) return;
    const params = new URLSearchParams(link.getAttribute('href').split('?')[1] || '');
    const story = seasons[params.get('season')]?.projects[Number(params.get('story'))];
    if (!story) return;

    const inner = document.createElement('div');
    inner.className = 'journal-card-inner';
    const front = document.createElement('div');
    front.className = 'journal-front';
    while (card.firstChild) front.appendChild(card.firstChild);

    const back = document.createElement('div');
    back.className = 'journal-back';
    back.innerHTML = `
      <div class="journal-postmark" aria-hidden="true">${story.place}<br>${story.type}</div>
      <p class="journal-note">${story.deck}</p>
      <a href="${link.getAttribute('href')}">Enter field note <span aria-hidden="true">→</span></a>
    `;
    inner.append(front, back);
    card.appendChild(inner);
  });
}

const journalTrack = document.querySelector('[data-journal-track]');
if (journalTrack && journalSet) {
  const journalClone = journalSet.cloneNode(true);
  journalClone.removeAttribute('data-journal-set');
  journalClone.setAttribute('aria-hidden', 'true');
  journalClone.querySelectorAll('a').forEach(link => link.setAttribute('tabindex', '-1'));
  journalTrack.appendChild(journalClone);
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
renderSeason('spring', false);
requestAnimationFrame(() => document.body.classList.add('page-ready'));
