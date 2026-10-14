-- Generated from content.js. Seeds D1 with the current site content.
-- Regenerate with: python3 tools/seed-from-content.py

DELETE FROM postcard_images; DELETE FROM postcards; DELETE FROM site;

INSERT INTO site (key, value) VALUES ('email', 'yarenkecici022@gmail.com');
INSERT INTO site (key, value) VALUES ('emailSubject', 'A place worth remembering');
INSERT INTO site (key, value) VALUES ('instagram', 'https://www.instagram.com/saucerfulsecrets/');
INSERT INTO site (key, value) VALUES ('credit', 'By Atlasophy');
INSERT INTO site (key, value) VALUES ('aboutTitle', 'Hi, I’m Yaren.
The eye behind it all.');
INSERT INTO site (key, value) VALUES ('aboutParagraph1', 'I’m a photographer, visual storyteller, and incurable wanderer. I created elseaway to document the places that make us slow down — quiet corners, sunlit rooms, unfamiliar streets, and the little moments that stay with us.');
INSERT INTO site (key, value) VALUES ('aboutParagraph2', 'What began as a love for travelling and photography has grown into a journey of discovering places, staying in them, and telling their stories through my own eyes.');
INSERT INTO site (key, value) VALUES ('aboutParagraph3', 'My work is unhurried, observant, and rooted in real life. I’m less interested in simply showing where I’ve been, and more interested in capturing how it felt to be there.');
INSERT INTO site (key, value) VALUES ('aboutMotto', 'Less posing. More presence.');
INSERT INTO site (key, value) VALUES ('aboutSignature', 'Yaren');
INSERT INTO site (key, value) VALUES ('aboutCaption', 'the eye behind it all °');
INSERT INTO site (key, value) VALUES ('heroEyebrow', 'elseaway · A visual journal by Yaren');
INSERT INTO site (key, value) VALUES ('heroTitle', 'Stories from
elsewhere.');
INSERT INTO site (key, value) VALUES ('heroCopy', 'Photographs and visual stories that make a place
 feel like somewhere you’ve already missed.');
INSERT INTO site (key, value) VALUES ('heroPlace', 'Based in Istanbul
Available worldwide');
INSERT INTO site (key, value) VALUES ('introTitle', 'I follow the feeling of a place—
the light, the people, the little rituals.');
INSERT INTO site (key, value) VALUES ('introDescription', 'elseaway is a visual diary of places worth discovering, staying in, and remembering.');
INSERT INTO site (key, value) VALUES ('introLocation', 'Currently based in Istanbul, available worldwide.');
INSERT INTO site (key, value) VALUES ('workTitle', 'Visual content for places
worth staying in.');
INSERT INTO site (key, value) VALUES ('workDescription', 'I create photography and visual content for villas, apartments, boutique stays, and distinctive properties—capturing not just how a place looks, but how it feels. Every collaboration is tailored to reflect the unique atmosphere and story of each space.');
INSERT INTO site (key, value) VALUES ('serviceTitle1', 'Photography');
INSERT INTO site (key, value) VALUES ('serviceTitle2', 'Reels & Short-form Video');
INSERT INTO site (key, value) VALUES ('serviceTitle3', 'Social Media Content');
INSERT INTO site (key, value) VALUES ('serviceTitle4', 'Website & Booking Platform Visuals');
INSERT INTO site (key, value) VALUES ('serviceDescription1', 'Interior, exterior, architectural, detail, and lifestyle imagery.');
INSERT INTO site (key, value) VALUES ('serviceDescription2', 'Vertical videos designed for Instagram, TikTok, websites, and digital platforms.');
INSERT INTO site (key, value) VALUES ('serviceDescription3', 'A curated collection of ready-to-use photos and videos for your social channels.');
INSERT INTO site (key, value) VALUES ('serviceDescription4', 'Professional imagery for Airbnb, Booking.com, your website, and marketing materials.');
INSERT INTO site (key, value) VALUES ('journalTitle', 'Postcards from elsewhere.');
INSERT INTO site (key, value) VALUES ('journalDescription', 'A growing collection of places I’ve wandered through,
stayed in, and wanted to remember.');
INSERT INTO site (key, value) VALUES ('contactIntro', 'Have a place worth remembering?');
INSERT INTO site (key, value) VALUES ('contactTitle', 'Let’s tell its
story.');
INSERT INTO site (key, value) VALUES ('contactDescription', 'Available for stays, local businesses, tourism projects,
 and beautifully unplanned adventures worldwide.');
INSERT INTO site (key, value) VALUES ('contactClosing', 'I don’t just photograph places. I photograph the feeling
 that makes you want to stay a little longer.');
INSERT INTO site (key, value) VALUES ('collaborationsTitle', 'Stories made together.');
INSERT INTO site (key, value) VALUES ('collaborationsDescription', 'Photography and visual stories created in collaboration with places, people, and independent businesses.');
INSERT INTO site (key, value) VALUES ('__collaborations', '[]');

INSERT INTO postcards (id, city, country, time_label, note, position) VALUES (1, 'Menorca', 'Spain', 'After midnight', 'The table they set after everyone else had gone home', 0);
INSERT INTO postcard_images (postcard_id, image, position) VALUES (1, 'assets/stories/summer-5.webp', 0);
INSERT INTO postcards (id, city, country, time_label, note, position) VALUES (2, 'Tatras', '', 'Night train', 'Waking up at the last station before the mountains', 1);
INSERT INTO postcard_images (postcard_id, image, position) VALUES (2, 'assets/stories/autumn-5.webp', 0);
INSERT INTO postcards (id, city, country, time_label, note, position) VALUES (3, 'Salzburg', 'Austria', '05:12', 'Inside the bakery before the first tram passed', 2);
INSERT INTO postcard_images (postcard_id, image, position) VALUES (3, 'assets/stories/autumn-4.webp', 0);
INSERT INTO postcards (id, city, country, time_label, note, position) VALUES (4, '', 'Iceland', 'Below zero', 'A winter bath where the road quietly disappears', 3);
INSERT INTO postcard_images (postcard_id, image, position) VALUES (4, 'assets/stories/winter-3.webp', 0);
INSERT INTO postcards (id, city, country, time_label, note, position) VALUES (5, 'Provence', 'France', 'Wild clay', 'Learning why this village never paints its pottery', 4);
INSERT INTO postcard_images (postcard_id, image, position) VALUES (5, 'assets/stories/spring-3.webp', 0);
INSERT INTO postcards (id, city, country, time_label, note, position) VALUES (6, '', 'Austria', 'No road in', 'Three days in the orchard cabin reached only on foot', 5);
INSERT INTO postcard_images (postcard_id, image, position) VALUES (6, 'assets/stories/spring-2.webp', 0);
