"""
Shared: Redis client helpers.
Thin wrapper around the global aioredis connection for common key patterns.
"""
import json
from typing import Any, Optional
from config import r


# ── Generic KV helpers ──

async def cache_set(key: str, value: Any, ttl: Optional[int] = None) -> bool:
    """Set a cache key with optional TTL (seconds). Returns True if Redis is available."""
    if not r:
        return False
    try:
        raw = json.dumps(value) if not isinstance(value, (str, int, float)) else value
        if ttl:
            return bool(await r.setex(key, ttl, raw))
        return bool(await r.set(key, raw))
    except Exception:
        return False


async def cache_get(key: str) -> Optional[str]:
    """Get a cached value as raw string. Returns None on miss or error."""
    if not r:
        return None
    try:
        return await r.get(key)
    except Exception:
        return None


async def cache_delete(*keys: str) -> bool:
    """Delete one or more keys. Returns True if Redis is available."""
    if not r:
        return False
    try:
        await r.delete(*keys)
        return True
    except Exception:
        return False


async def cache_exists(key: str) -> bool:
    """Check if key exists."""
    if not r:
        return False
    try:
        return bool(await r.exists(key))
    except Exception:
        return False


# ── Rate Limiting ──

RATE_LIMIT_REQUESTS = 15
RATE_LIMIT_WINDOW = 10  # seconds


async def check_rate_limit(shop_doc_id: str, limit: int = RATE_LIMIT_REQUESTS,
                           window: int = RATE_LIMIT_WINDOW) -> bool:
    """Sliding-window rate limiter per shop. Returns True if allowed."""
    if not r:
        return True  # no Redis → allow all
    key = f"rate:{shop_doc_id}"
    try:
        current = await r.get(key)
        count = int(current) + 1 if current else 1
        if count == 1:
            await r.setex(key, window, 1)
        else:
            await r.set(key, count, keepttl=True)
        return count <= limit
    except Exception:
        return True
