const allStories = window.ATLAS_STORIES;
const query = new URLSearchParams(window.location.search);
const requestedSeason = query.get('season');
const seasonName = allStories[requestedSeason] ? requestedSeason : 'spring';
const season = allStories[seasonName];
const requestedIndex = Number.parseInt(query.get('story'), 10);
const storyIndex = Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < season.projects.length ? requestedIndex : 0;
const story = season.projects[storyIndex];

document.body.dataset.season = seasonName;

document.title = `${story.title} — Else Away by Yaren`;
const canonicalUrl = `https://elseaway.com/story.html?season=${seasonName}&story=${storyIndex}`;
const shareImageUrl = `https://elseaway.com/assets/stories/${seasonName}-${storyIndex + 1}.webp`;
document.querySelector('[data-story-canonical]').href = canonicalUrl;
document.querySelector('[data-story-og-title]').content = document.title;
document.querySelector('[data-story-og-description]').content = story.deck;
document.querySelector('[data-story-og-url]').content = canonicalUrl;
document.querySelector('[data-story-og-image]').content = shareImageUrl;
document.querySelector('[data-story-twitter-title]').content = document.title;
document.querySelector('[data-story-twitter-description]').content = story.deck;
document.querySelector('[data-story-twitter-image]').content = shareImageUrl;
document.querySelector('[data-story-season]').textContent = season.label;
document.querySelector('[data-story-season-ghost]').textContent = season.label;
document.querySelector('[data-story-number]').textContent = String(storyIndex + 1).padStart(2, '0');
document.querySelector('[data-story-title]').textContent = story.title;
document.querySelector('[data-story-deck]').textContent = story.deck;
document.querySelector('[data-story-place]').textContent = story.place;
document.querySelector('[data-story-type]').textContent = story.type;
document.querySelector('[data-story-body]').textContent = story.story;

const storyImage = document.querySelector('[data-story-image]');
storyImage.src = `assets/stories/${seasonName}-${storyIndex + 1}.webp`;
storyImage.alt = `${story.title}, ${story.place}`;

const mapLink = document.querySelector('[data-story-map]');
mapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(story.map)}`;

const seasonNames = Object.keys(allStories);
let nextSeasonIndex = seasonNames.indexOf(seasonName);
let nextStoryIndex = storyIndex + 1;
if (nextStoryIndex >= season.projects.length) {
  nextStoryIndex = 0;
  nextSeasonIndex = (nextSeasonIndex + 1) % seasonNames.length;
}
const nextSeasonName = seasonNames[nextSeasonIndex];
const nextStory = allStories[nextSeasonName].projects[nextStoryIndex];
const nextLink = document.querySelector('[data-next-story]');
nextLink.href = `story.html?season=${nextSeasonName}&story=${nextStoryIndex}`;
document.querySelector('[data-next-title]').textContent = nextStory.title;

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

const header = document.querySelector('.story-header');
function updateStoryScroll() {
  const y = window.scrollY;
  header.classList.toggle('scrolled', y > 40);
  const max = document.documentElement.scrollHeight - innerHeight;
  document.documentElement.style.setProperty('--scroll-progress', `${max > 0 ? Math.min(1, y / max) * 100 : 0}%`);
}
window.addEventListener('scroll', updateStoryScroll, { passive: true });
updateStoryScroll();

document.querySelectorAll('.transition-link').forEach(link => link.addEventListener('click', event => {
  if (link.target === '_blank') return;
  event.preventDefault();
  document.body.classList.add('page-leaving');
  setTimeout(() => { window.location.href = link.href; }, 420);
}));

document.querySelector('[data-year]').textContent = new Date().getFullYear();
requestAnimationFrame(() => document.body.classList.add('page-ready'));
