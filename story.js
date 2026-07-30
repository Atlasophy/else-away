const allSeasons = window.ELSE_AWAY.seasons;
const query = new URLSearchParams(window.location.search);
const season = allSeasons.find(entry => entry.id === query.get('season')) || allSeasons[0];
const seasonName = season.id;

/* Stories are addressed by slug so reordering or removing one cannot silently
   point a link at a different story. Numeric links from before the content
   layer still resolve. */
const requested = query.get('story');
const numeric = Number.parseInt(requested, 10);
const bySlug = season.projects.findIndex(project => project.slug === requested);
const storyIndex = bySlug >= 0
  ? bySlug
  : (Number.isInteger(numeric) && numeric >= 0 && numeric < season.projects.length ? numeric : 0);
const story = season.projects[storyIndex];

document.body.dataset.season = seasonName;

document.title = `${story.title} — Else Away by Yaren`;
const canonicalUrl = `https://elseaway.com/story.html?season=${seasonName}&story=${story.slug}`;
const shareImageUrl = `https://elseaway.com/${story.image}`;
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
storyImage.src = story.image;
storyImage.alt = `${story.title}, ${story.place}`;

const mapLink = document.querySelector('[data-story-map]');
mapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(story.location)}`;

let nextSeason = season;
let nextStoryIndex = storyIndex + 1;
if (nextStoryIndex >= season.projects.length) {
  nextStoryIndex = 0;
  nextSeason = allSeasons[(allSeasons.indexOf(season) + 1) % allSeasons.length];
}
const nextStory = nextSeason.projects[nextStoryIndex];
const nextLink = document.querySelector('[data-next-story]');
nextLink.href = `story.html?season=${nextSeason.id}&story=${nextStory.slug}`;
document.querySelector('[data-next-title]').textContent = nextStory.title;

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
