"""
API: FastAPI dependency injection helpers.
Provides shared dependencies (DB, Redis, config) to route handlers.
"""
from fastapi import HTTPException
from config import db, r


async def get_db():
    """Dependency: get Firestore client. Raises 503 if unavailable."""
    if db is None:
        raise HTTPException(status_code=503, detail="Firestore unavailable")
    return db


async def get_redis():
    """Dependency: get Redis client. Returns None gracefully if unavailable."""
    return r  # None is valid — callers handle degraded mode
