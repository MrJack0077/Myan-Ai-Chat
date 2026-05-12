"""
Redis-backed system prompt cache — avoids rebuilding identical prompts.

Cache key:  sys_prompt:{shop_doc_id}:{md5_hash_of_config}
TTL:        2 minutes (TTL_WARM = 120s)
Invalidate: via cache_manager.invalidate_shop_caches() or /refresh command

No tracking SET needed — cleanup uses SCAN pattern: sys_prompt:{shop_doc_id}:*
"""
import json
import hashlib

from .prompt_builder import assemble_system_prompt
from .cache_manager import cache_get, cache_set, TTL_WARM


def _hash_config(ai_config, intent, extra_context, shop_context):
    """Create an MD5 hash from config parts for cache key."""
    hasher = hashlib.md5()
    hasher.update(json.dumps(ai_config, sort_keys=True, default=str).encode())
    hasher.update(str(intent).encode())
    if extra_context:
        hasher.update(json.dumps(extra_context, sort_keys=True, default=str).encode())
    if shop_context:
        hasher.update(json.dumps(shop_context, sort_keys=True, default=str).encode())
    return hasher.hexdigest()


async def get_cached_system_prompt(ai_config, intent, extra_context, shop_context, shop_doc_id):
    """
    Get system prompt from Redis cache, or build and cache it.
    Uses shop_doc_id as namespace prefix with SCAN-based cleanup.
    """
    config_hash = _hash_config(ai_config, intent, extra_context, shop_context)
    cache_key = f"sys_prompt:{shop_doc_id}:{config_hash}"

    # Try cache
    cached = await cache_get(cache_key)
    if cached:
        return cached

    # Build fresh
    sys_prompt = await assemble_system_prompt(
        ai_config, intent=intent, extra_context=extra_context, shop_context=shop_context
    )

    # Cache it (no tracking SET — cleanup uses SCAN)
    if sys_prompt:
        await cache_set(cache_key, sys_prompt, TTL_WARM)

    return sys_prompt


async def invalidate_system_prompt_cache(shop_doc_id):
    """
    Clear all cached system prompts for a shop.
    Uses SCAN pattern — no tracking SET needed, no race condition.
    """
    from utils.config import r
    if not r:
        return
    try:
        pattern = f"sys_prompt:{shop_doc_id}:*"
        cursor = 0
        deleted = 0
        while True:
            cursor, keys = await r.scan(cursor, match=pattern, count=100)
            if keys:
                await r.delete(*keys)
                deleted += len(keys)
            if cursor == 0:
                break
        if deleted:
            print(f"🧹 System prompt cache cleared for {shop_doc_id} ({deleted} keys)", flush=True)
    except Exception as e:
        print(f"⚠️ System prompt cache clear error: {e}", flush=True)
