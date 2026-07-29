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
      <div class="project-info">
        <p>${project.type} · ${project.place}</p>
        <h3>${project.title}</h3>
        <span class="project-open">View story <i>↗</i></span>
      </div>
    </a>
  `).join('');
  if (animate) {
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
let downCard = null;
gallery.addEventListener('pointerdown', event => {
  dragging = true;
  dragMoved = false;
  dragStart = event.clientX;
  scrollStart = gallery.scrollLeft;
  downCard = event.target.closest('.project-card');
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
gallery.addEventListener('click', event => {
  const link = event.target.closest('.project-card') || downCard;
  downCard = null;
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

const journalTrack = document.querySelector('[data-journal-track]');
const journalSet = document.querySelector('[data-journal-set]');
if (journalTrack && journalSet) {
  const journalClone = journalSet.cloneNode(true);
  journalClone.removeAttribute('data-journal-set');
  journalClone.setAttribute('aria-hidden', 'true');
  journalClone.querySelectorAll('a').forEach(link => link.setAttribute('tabindex', '-1'));
  journalTrack.appendChild(journalClone);
}

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
}, { threshold: .13 });
document.querySelectorAll('.reveal').forEach(element => observer.observe(element));

const header = document.querySelector('[data-header]');
const heroImage = document.querySelector('.hero-image');
function updateScrollEffects() {
  const y = window.scrollY;
  header.classList.toggle('scrolled', y > 40);
  document.documentElement.style.setProperty('--scroll-progress', `${Math.min(1, y / (document.documentElement.scrollHeight - innerHeight)) * 100}%`);
  if (heroImage && y < innerHeight * 1.2) heroImage.style.setProperty('--hero-shift', `${y * .12}px`);
}
window.addEventListener('scroll', updateScrollEffects, { passive: true });
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

const THEME_KEY = 'elseaway-theme';
const themeToggle = document.querySelector('[data-theme-toggle]');
const themeColorMeta = document.querySelector('meta[name="theme-color"]');

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  if (themeColorMeta) themeColorMeta.content = theme === 'light' ? '#e9f2ef' : '#120c1c';
  if (themeToggle) {
    themeToggle.setAttribute('aria-label', theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
    themeToggle.setAttribute('aria-pressed', String(theme === 'light'));
  }
}

applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (error) { /* private mode: theme just won't persist */ }
  });
}

const stillPreferred = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const sparkField = document.querySelector('[data-hero-sparks]');
if (sparkField && !stillPreferred) {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 26; index += 1) {
    const spark = document.createElement('span');
    // cluster the embers around the crystal, thinning out toward the edges
    const spread = (Math.random() + Math.random() - 1) * 26;
    const size = 1.5 + Math.random() * 2;
    spark.style.left = `${50 + spread}%`;
    spark.style.width = `${size}px`;
    spark.style.height = `${size}px`;
    spark.style.setProperty('--spark-rise', `${-110 - Math.random() * 190}px`);
    spark.style.setProperty('--spark-opacity', `${0.35 + Math.random() * 0.5}`);
    spark.style.animationDuration = `${5 + Math.random() * 6}s`;
    spark.style.animationDelay = `${-Math.random() * 9}s`;
    fragment.appendChild(spark);
  }
  sparkField.appendChild(fragment);
}

const heroParallax = document.querySelector('[data-hero-parallax]');
const heroStage = document.querySelector('[data-hero-stage]');
if (heroParallax && heroStage && !stillPreferred && matchMedia('(hover: hover)').matches) {
  heroStage.addEventListener('pointermove', event => {
    const bounds = heroStage.getBoundingClientRect();
    const offsetX = (event.clientX - bounds.left) / bounds.width - .5;
    const offsetY = (event.clientY - bounds.top) / bounds.height - .5;
    heroParallax.style.setProperty('--par-x', `${offsetX * -18}px`);
    heroParallax.style.setProperty('--par-y', `${offsetY * -12}px`);
  });
  heroStage.addEventListener('pointerleave', () => {
    heroParallax.style.setProperty('--par-x', '0px');
    heroParallax.style.setProperty('--par-y', '0px');
  });
}

document.querySelectorAll('.journal-card').forEach(card => card.addEventListener('click', event => {
  if (event.target.closest('a')) return;
  const link = card.querySelector('a');
  if (!link) return;
  document.body.classList.add('page-leaving');
  setTimeout(() => { window.location.href = link.href; }, 420);
}));

document.querySelector('[data-year]').textContent = new Date().getFullYear();
renderSeason('spring', false);
requestAnimationFrame(() => document.body.classList.add('page-ready'));
