#!/usr/bin/env python3
"""Regenerate seed.sql from content.js.

Useful for reloading a fresh database, or for restoring the site to a known
state. Run from the repository root:

    python3 tools/seed-from-content.py
"""

import json
import pathlib
import sys
import uuid

root = pathlib.Path(__file__).resolve().parent.parent
source = root / 'content.js'
target = root / 'seed.sql'

raw = source.read_text()
data = json.loads(raw[raw.index('{'):raw.rindex('}') + 1])


def q(value):
    return "'" + str(value).replace("'", "''") + "'"


def collaboration_id(entry):
    # Stable per entry, not positional like a postcard's: a supplied id is
    # kept as-is so re-running this generator never reassigns one that is
    # already in use, and anything without one gets a fresh UUID.
    value = entry.get('id')
    return value if isinstance(value, str) and value else str(uuid.uuid4())


lines = [
    '-- Generated from content.js. Seeds D1 with the current site content.',
    '-- Regenerate with: python3 tools/seed-from-content.py',
    '',
    'DELETE FROM postcard_images; DELETE FROM postcards; DELETE FROM site;',
    '',
]

for key, value in data['site'].items():
    lines.append(f'INSERT INTO site (key, value) VALUES ({q(key)}, {q(value)});')
lines.append('')

for index, card in enumerate(data['postcards']):
    lines.append(
        'INSERT INTO postcards (id, city, country, time_label, note, position) VALUES ('
        f"{index + 1}, {q(card['city'])}, {q(card['country'])}, {q(card['time'])}, {q(card['note'])}, {index});"
    )
    for photo_index, image in enumerate(card['images']):
        lines.append(
            'INSERT INTO postcard_images (postcard_id, image, position) VALUES '
            f"({index + 1}, {q(image)}, {photo_index});"
        )
lines.append('')

collaborations = data.get('collaborations', [])
if collaborations:
    lines.append('DELETE FROM collaboration_images; DELETE FROM collaborations;')
    lines.append('')
    for index, entry in enumerate(collaborations):
        cid = collaboration_id(entry)
        lines.append(
            'INSERT INTO collaborations (id, place, category, city, country, time_label, story, url, position) VALUES ('
            f"{q(cid)}, {q(entry.get('place', ''))}, {q(entry.get('category', 'Other'))}, "
            f"{q(entry.get('city', ''))}, {q(entry.get('country', ''))}, {q(entry.get('time', ''))}, "
            f"{q(entry.get('story', ''))}, {q(entry.get('url', ''))}, {index});"
        )
        for photo_index, image in enumerate(entry.get('images', [])):
            lines.append(
                'INSERT INTO collaboration_images (collaboration_id, image, position) VALUES '
                f"({q(cid)}, {q(image)}, {photo_index});"
            )

target.write_text('\n'.join(lines) + '\n')

photos = sum(len(card['images']) for card in data['postcards'])
collab_photos = sum(len(entry.get('images', [])) for entry in collaborations)
print(
    f'seed.sql written — {len(data["postcards"])} postcards, {photos} photographs, '
    f'{len(collaborations)} collaborations, {collab_photos} collaboration photographs',
    file=sys.stderr,
)
