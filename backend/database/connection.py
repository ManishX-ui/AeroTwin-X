"""Database Connection, Engine Configuration, and Session Management.

Optimized for Neon Serverless PostgreSQL, SQLAlchemy 2.0, and Psycopg 3.
Provides safe connection handling on Vercel and graceful degraded state
when DATABASE_URL is not configured.
"""
import os
import logging
from typing import Generator, Optional
from urllib.parse import urlparse

from sqlalchemy import create_engine, Engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.pool import NullPool, StaticPool
from fastapi import HTTPException, status

logger = logging.getLogger("aerotwin.database")

Base = declarative_base()


def get_normalized_database_url() -> Optional[str]:
    """Retrieve and normalize DATABASE_URL for SQLAlchemy + Psycopg 3.

    Handles:
    - postgres:// -> postgresql+psycopg://
    - postgresql:// -> postgresql+psycopg:// (if no driver specified)
    - sslmode=require for Neon PostgreSQL
    """
    url = os.getenv("DATABASE_URL")
    if not url or not url.strip():
        # Check for TEST_DATABASE_URL or SQLite fallback in explicit local dev
        test_url = os.getenv("TEST_DATABASE_URL")
        if test_url and test_url.strip():
            url = test_url.strip()
        else:
            return None

    url = url.strip()

    # Convert Heroku/legacy style postgres://
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)

    return url


def create_db_engine() -> Optional[Engine]:
    """Instantiate SQLAlchemy Engine configured for serverless and Neon pooling."""
    raw_url = get_normalized_database_url()
    if not raw_url:
        logger.info("DATABASE_URL is not configured. Database-dependent operations will return 503.")
        return None

    try:
        connect_args = {}
        # PostgreSQL / Neon optimizations
        if "postgresql" in raw_url:
            # NullPool avoids connection exhaustion in serverless function lifecycles
            # Neon connection pooler (port 5432 or 6543) pairs with NullPool
            if "neon.tech" in raw_url and "sslmode" not in raw_url:
                connect_args["sslmode"] = "require"

            engine = create_engine(
                raw_url,
                poolclass=NullPool,
                connect_args=connect_args,
                echo=False,
                future=True
            )
            logger.info("Configured PostgreSQL database engine with NullPool.")
            return engine

        elif "sqlite" in raw_url:
            connect_args["check_same_thread"] = False
            engine = create_engine(
                raw_url,
                connect_args=connect_args,
                poolclass=StaticPool if ":memory:" in raw_url else None,
                echo=False,
                future=True
            )
            logger.info(f"Configured SQLite database engine: {raw_url}")
            return engine

        else:
            engine = create_engine(raw_url, poolclass=NullPool, future=True)
            return engine

    except Exception as e:
        logger.error(f"Failed to create database engine: {e}", exc_info=True)
        return None


# Global engine and sessionmaker
engine: Optional[Engine] = create_db_engine()
if engine is not None:
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
else:
    SessionLocal = None


def is_db_configured() -> bool:
    """Check if a database engine and connection string are present."""
    return engine is not None and SessionLocal is not None


def get_db() -> Generator[Session, None, None]:
    """FastAPI Dependency for database session management.

    Returns a managed database session or raises HTTP 503 if DATABASE_URL
    is missing or unconfigured.
    """
    if not is_db_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "DATABASE_NOT_CONFIGURED",
                "message": (
                    "Persistent database is not configured. Please set the DATABASE_URL "
                    "environment variable (e.g. Neon PostgreSQL connection string)."
                ),
                "solution": "Configure DATABASE_URL in Vercel Project Settings or local .env."
            }
        )

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all registered tables if engine is configured."""
    if is_db_configured() and engine is not None:
        try:
            Base.metadata.create_all(bind=engine)
            logger.info("Database tables verified / created successfully.")
        except Exception as e:
            logger.warning(f"Could not automatically create tables at startup: {e}")
