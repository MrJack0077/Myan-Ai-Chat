"""
AI Prompt: Redis-based prompt cache versioning.
Caches system prompts per shop to avoid redundant AI context caching.
"""
import hashlib
from config import r


async def get_cached_prompt(shop_doc_id: str, config_hash: str) -> str | None:
    """Get cached system prompt for a shop + config version."""
    if not r:
        return None
    try:
        key = f"prompt:{shop_doc_id}:{config_hash}"
        return await r.get(key)
    except Exception:
        return None


async def set_cached_prompt(shop_doc_id: str, config_hash: str, prompt: str, ttl: int = 7200) -> bool:
    """Cache system prompt for a shop (2hr TTL by default)."""
    if not r:
        return False
    try:
        key = f"prompt:{shop_doc_id}:{config_hash}"
        return bool(await r.setex(key, ttl, prompt))
    except Exception:
        return False


async def invalidate_prompt_cache(shop_doc_id: str) -> int:
    """Invalidate all cached prompts for a shop. Returns number of keys deleted."""
    if not r:
        return 0
    try:
        pattern = f"prompt:{shop_doc_id}:*"
        keys = await r.keys(pattern)
        if keys:
            await r.delete(*keys)
        return len(keys) if keys else 0
    except Exception:
        return 0
