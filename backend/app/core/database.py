import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://user:password@localhost:5432/postgres')

# pool_pre_ping: test each pooled connection before use, so a Postgres restart
# or dropped idle connection turns into a transparent reconnect instead of a
# stream of 500s ("server closed the connection unexpectedly").
# pool_recycle: proactively refresh connections older than 30 min — network
# middleboxes / the server may silently kill long-idle TCP connections.
_engine_kwargs = {"pool_pre_ping": True}
if SQLALCHEMY_DATABASE_URL.startswith("postgresql"):
    _engine_kwargs.update(
        pool_size=5,
        max_overflow=10,
        pool_recycle=1800,
        pool_timeout=30,
    )

engine = create_engine(SQLALCHEMY_DATABASE_URL, **_engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()