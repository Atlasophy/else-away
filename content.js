/* Single source of truth for everything Yaren can edit.
   Fallback snapshot. In production /api/content-script has already set this
   from the database, and this file leaves it alone. Also the source that
   tools/seed-from-content.py loads the database from. */
window.ELSE_AWAY = window.ELSE_AWAY || {
  "site": {
    "email": "yarenkecici022@gmail.com",
    "emailSubject": "A place worth remembering",
    "instagram": "https://www.instagram.com/saucerfulsecrets/",
    "credit": "By Atlasophy"
  },
  "postcards": [
    {
      "city": "Menorca",
      "country": "",
      "time": "",
      "note": "The table they set after everyone else had gone home",
      "images": ["assets/stories/summer-5.webp"]
    },
    {
      "city": "Tatras",
      "country": "",
      "time": "",
      "note": "Waking up at the last station before the mountains",
      "images": ["assets/stories/autumn-5.webp"]
    },
    {
      "city": "Salzburg",
      "country": "",
      "time": "",
      "note": "Inside the bakery before the first tram passed",
      "images": ["assets/stories/autumn-4.webp"]
    },
    {
      "city": "Iceland",
      "country": "",
      "time": "",
      "note": "A winter bath where the road quietly disappears",
      "images": ["assets/stories/winter-3.webp"]
    },
    {
      "city": "Provence",
      "country": "",
      "time": "",
      "note": "Learning why this village never paints its pottery",
      "images": ["assets/stories/spring-3.webp"]
    },
    {
      "city": "Austria",
      "country": "",
      "time": "",
      "note": "Three days in the orchard cabin reached only on foot",
      "images": ["assets/stories/spring-2.webp"]
    }
  ]
};
