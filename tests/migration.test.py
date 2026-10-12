#!/usr/bin/env python3
"""Focused tests for the collaborations migration.

Uses only the Python standard library (sqlite3, unittest) against a real,
file-backed SQLite database created fresh for each test — no installs, no
network, no shared state with any real database.

Run with:
    python -m unittest tests/migration.test.py -v
or:
    python tests/migration.test.py
"""

import pathlib
import sqlite3
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCHEMA_SQL = (ROOT / 'schema.sql').read_text()
MIGRATION_SQL = (ROOT / 'tools' / 'migrations' / '2026-10-12-collaborations.sql').read_text()

REPRESENTATIVE_POSTCARDS = [
    (1, 'Menorca', 'Spain', 'After midnight', 'The table they set after everyone else had gone home', 0),
    (2, 'Tatras', '', 'Night train', 'Waking up at the last station before the mountains', 1),
]


def _without_comments(sql_text):
    lines = [line for line in sql_text.splitlines() if not line.strip().startswith('--')]
    return '\n'.join(lines).strip()


def fresh_pre_migration_db():
    """A database as it looked before this migration existed: schema.sql with
    the collaborations tables stripped out, plus representative existing
    postcard data — the scenario the migration must run safely against."""
    connection = sqlite3.connect(':memory:')
    connection.execute('PRAGMA foreign_keys = ON')
    for chunk in SCHEMA_SQL.split(';'):
        statement = _without_comments(chunk)
        if not statement or 'collaboration' in statement.lower():
            continue
        connection.execute(statement)
    for row in REPRESENTATIVE_POSTCARDS:
        connection.execute(
            'INSERT INTO postcards (id, city, country, time_label, note, position) VALUES (?, ?, ?, ?, ?, ?)',
            row,
        )
    connection.execute(
        "INSERT INTO postcard_images (postcard_id, image, position) VALUES (1, 'assets/stories/summer-5.webp', 0)"
    )
    connection.execute("INSERT INTO site (key, value) VALUES ('email', 'yarenkecici022@gmail.com')")
    connection.commit()
    return connection


def table_names(connection):
    rows = connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
    return {row[0] for row in rows}


def run_script(connection, sql):
    connection.executescript(sql)
    connection.commit()


class MigrationIsAdditive(unittest.TestCase):
    def test_migration_adds_collaboration_tables_without_touching_existing_data(self):
        connection = fresh_pre_migration_db()
        self.assertNotIn('collaborations', table_names(connection))

        run_script(connection, MIGRATION_SQL)

        tables = table_names(connection)
        self.assertIn('collaborations', tables)
        self.assertIn('collaboration_images', tables)

        postcards = connection.execute('SELECT city, country FROM postcards ORDER BY position').fetchall()
        self.assertEqual(postcards, [('Menorca', 'Spain'), ('Tatras', '')])
        images = connection.execute('SELECT image FROM postcard_images').fetchall()
        self.assertEqual(images, [('assets/stories/summer-5.webp',)])
        site = connection.execute("SELECT value FROM site WHERE key = 'email'").fetchone()
        self.assertEqual(site[0], 'yarenkecici022@gmail.com')

    def test_migration_is_rerunnable(self):
        connection = fresh_pre_migration_db()
        run_script(connection, MIGRATION_SQL)
        # Running it again must not raise, and must not duplicate or disturb
        # anything already written.
        run_script(connection, MIGRATION_SQL)

        postcards = connection.execute('SELECT COUNT(*) FROM postcards').fetchone()[0]
        self.assertEqual(postcards, 2)
        collaborations = connection.execute('SELECT COUNT(*) FROM collaborations').fetchone()[0]
        self.assertEqual(collaborations, 0)

    def test_migration_leaves_collaboration_tables_usable(self):
        connection = fresh_pre_migration_db()
        run_script(connection, MIGRATION_SQL)

        connection.execute(
            "INSERT INTO collaborations (id, place, category, city, country, time_label, story, url, position) "
            "VALUES ('collab-1', 'Casa Lio', 'Restaurant', 'Menorca', 'Spain', 'Summer 2026', 'A long lunch.', 'https://example.com', 0)"
        )
        connection.execute(
            "INSERT INTO collaboration_images (collaboration_id, image, position) VALUES ('collab-1', 'assets/stories/summer-5.webp', 0)"
        )
        connection.commit()

        row = connection.execute("SELECT place, category FROM collaborations WHERE id = 'collab-1'").fetchone()
        self.assertEqual(row, ('Casa Lio', 'Restaurant'))

        # Foreign key cascade matches the postcards/postcard_images pattern.
        connection.execute("DELETE FROM collaborations WHERE id = 'collab-1'")
        connection.commit()
        remaining = connection.execute('SELECT COUNT(*) FROM collaboration_images').fetchone()[0]
        self.assertEqual(remaining, 0)


class FreshInstallMatchesMigration(unittest.TestCase):
    def test_schema_sql_and_migration_produce_the_same_collaboration_tables(self):
        fresh = sqlite3.connect(':memory:')
        fresh.execute('PRAGMA foreign_keys = ON')
        run_script(fresh, SCHEMA_SQL)

        migrated = fresh_pre_migration_db()
        run_script(migrated, MIGRATION_SQL)

        def columns(connection, table):
            rows = connection.execute(f'PRAGMA table_info({table})').fetchall()
            # (cid, name, type, notnull, dflt_value, pk)
            return [(row[1], row[2], row[3], row[5]) for row in rows]

        self.assertEqual(columns(fresh, 'collaborations'), columns(migrated, 'collaborations'))
        self.assertEqual(columns(fresh, 'collaboration_images'), columns(migrated, 'collaboration_images'))


if __name__ == '__main__':
    unittest.main()
