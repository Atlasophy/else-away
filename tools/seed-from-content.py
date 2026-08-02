#!/usr/bin/env python3
"""Regenerate seed.sql from content.js.

Useful for reloading a fresh database, or for restoring the site to a known
state. Run from the repository root:

    python3 tools/seed-from-content.py
"""

import json
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parent.parent
source = root / 'content.js'
target = root / 'seed.sql'

raw = source.read_text()
data = json.loads(raw[raw.index('{'):raw.rindex('}') + 1])


def q(value):
    return "'" + str(value).replace("'", "''") + "'"


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

target.write_text('\n'.join(lines) + '\n')

photos = sum(len(card['images']) for card in data['postcards'])
print(f'seed.sql written — {len(data["postcards"])} postcards, {photos} photographs', file=sys.stderr)
