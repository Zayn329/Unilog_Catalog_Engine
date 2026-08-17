"""Database engine and session management."""

from __future__ import annotations

import logging
import os
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

# Import models so SQLModel.metadata is populated
import app.db.models  # noqa: F401

logger = logging.getLogger(__name__)

DEFAULT_DB_URL = "sqlite+aiosqlite:///./catalog_engine.db"


def get_database_url() -> str:
    raw_url = os.getenv("DATABASE_URL")
    if not raw_url:
        logger.warning(
            "DATABASE_URL is unset. Defaulting to DB_ENGINE=SQLITE (LOCAL_FALLBACK) at %s",
            DEFAULT_DB_URL,
        )
        return DEFAULT_DB_URL

    url = raw_url
    if url.startswith("sqlite:///"):
        url = url.replace("sqlite:///", "sqlite+aiosqlite:///")
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://")
    return url


DATABASE_URL = get_database_url()

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    future=True,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)

async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

_db_initialized = False


async def init_db() -> None:
    """Initialize database tables."""
    global _db_initialized
    if _db_initialized:
        return

    db_type = "PostgreSQL" if "postgresql" in DATABASE_URL else "SQLite"
    logger.info("Initializing database schema on %s...", db_type)

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    _db_initialized = True
    logger.info("Database schema initialized successfully (%s).", db_type)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for yielding an async database session."""
    global _db_initialized
    if not _db_initialized:
        await init_db()
    async with async_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()