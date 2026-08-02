-- Generated from content.js. Seeds D1 with the current site content.
-- Regenerate with: python3 tools/seed-from-content.py

DELETE FROM postcard_images; DELETE FROM postcards; DELETE FROM site;

INSERT INTO site (key, value) VALUES ('email', 'yarenkecici022@gmail.com');
INSERT INTO site (key, value) VALUES ('emailSubject', 'A place worth remembering');
INSERT INTO site (key, value) VALUES ('instagram', 'https://www.instagram.com/saucerfulsecrets/');
INSERT INTO site (key, value) VALUES ('credit', 'By Atlasophy');

INSERT INTO postcards (id, city, country, time_label, note, position) VALUES (1, 'Menorca', '', '', 'The table they set after everyone else had gone home', 0);
INSERT INTO postcard_images (postcard_id, image, position) VALUES (1, 'assets/stories/summer-5.webp', 0);
INSERT INTO postcards (id, city, country, time_label, note, position) VALUES (2, 'Tatras', '', '', 'Waking up at the last station before the mountains', 1);
INSERT INTO postcard_images (postcard_id, image, position) VALUES (2, 'assets/stories/autumn-5.webp', 0);
INSERT INTO postcards (id, city, country, time_label, note, position) VALUES (3, 'Salzburg', '', '', 'Inside the bakery before the first tram passed', 2);
INSERT INTO postcard_images (postcard_id, image, position) VALUES (3, 'assets/stories/autumn-4.webp', 0);
INSERT INTO postcards (id, city, country, time_label, note, position) VALUES (4, 'Iceland', '', '', 'A winter bath where the road quietly disappears', 3);
INSERT INTO postcard_images (postcard_id, image, position) VALUES (4, 'assets/stories/winter-3.webp', 0);
INSERT INTO postcards (id, city, country, time_label, note, position) VALUES (5, 'Provence', '', '', 'Learning why this village never paints its pottery', 4);
INSERT INTO postcard_images (postcard_id, image, position) VALUES (5, 'assets/stories/spring-3.webp', 0);
INSERT INTO postcards (id, city, country, time_label, note, position) VALUES (6, 'Austria', '', '', 'Three days in the orchard cabin reached only on foot', 5);
INSERT INTO postcard_images (postcard_id, image, position) VALUES (6, 'assets/stories/spring-2.webp', 0);
