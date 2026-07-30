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
    'DELETE FROM postcards; DELETE FROM projects; DELETE FROM seasons; DELETE FROM site;',
    '',
]

for key, value in data['site'].items():
    lines.append(f'INSERT INTO site (key, value) VALUES ({q(key)}, {q(value)});')
lines.append('')

for index, season in enumerate(data['seasons']):
    lines.append(
        'INSERT INTO seasons (id, label, film, note, position) VALUES ('
        f"{q(season['id'])}, {q(season['label'])}, {q(season['film'])}, {q(season['note'])}, {index});"
    )
lines.append('')

for season in data['seasons']:
    for index, project in enumerate(season['projects']):
        columns = [season['id'], project['slug'], project['title'], project['type'],
                   project['place'], project['location'], project['image'],
                   project['deck'], project['story']]
        lines.append(
            'INSERT INTO projects (season_id, slug, title, type, place, location, image, deck, story, position) '
            'VALUES (' + ', '.join(q(c) for c in columns) + f', {index});'
        )
lines.append('')

for index, card in enumerate(data['postcards']):
    columns = [card['image'], card['meta'], card['title'], card['season'], card['story']]
    lines.append(
        'INSERT INTO postcards (image, meta, title, season_id, story_slug, position) '
        'VALUES (' + ', '.join(q(c) for c in columns) + f', {index});'
    )

target.write_text('\n'.join(lines) + '\n')

projects = sum(len(season['projects']) for season in data['seasons'])
print(f'seed.sql written — {len(data["seasons"])} seasons, {projects} stories, '
      f'{len(data["postcards"])} postcards', file=sys.stderr)
