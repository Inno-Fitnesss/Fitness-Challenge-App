from contextlib import contextmanager

from app.util import init_db


class _FakeConnection:
    def __init__(self, statements):
        self.statements = statements

    def execute(self, statement):
        self.statements.append(str(statement))


class _FakePostgresEngine:
    class _Dialect:
        name = "postgresql"

    dialect = _Dialect()

    def __init__(self):
        self.statements = []

    @contextmanager
    def begin(self):
        yield _FakeConnection(self.statements)


def test_legal_column_migrations_are_idempotent_and_non_destructive(monkeypatch):
    fake_engine = _FakePostgresEngine()
    monkeypatch.setattr(init_db, "engine", fake_engine)

    init_db.sync_schema()
    init_db.sync_schema()

    legal_statements = [
        statement
        for statement in fake_engine.statements
        if "terms_" in statement or "privacy_" in statement
    ]
    assert len(legal_statements) == 12
    assert all("ADD COLUMN IF NOT EXISTS" in statement for statement in legal_statements)
    all_sql = "\n".join(fake_engine.statements).upper()
    assert "DROP TABLE" not in all_sql
    assert "TRUNCATE" not in all_sql
    assert "DELETE FROM USERS" not in all_sql
