"""
Vertex AI Context Cache — per-shop token caching for 50-70% cost savings.

Each shop gets a cached system prompt prefix containing:
  - Identity (bot name, personality)
  - Communication rules (condensed 5 rules)
  - Product catalog (static info)
  - Policies (shipping, returns, payment)
  - FAQs (top 5 Q&A)

The cache is invalidated when admin updates AI config.
Cache TTL: 2 hours (active shops stay cached).
"""
import asyncio
import time
from datetime import datetime, timezone
from utils import r

CACHE_KEY_PREFIX = "vertex_cache:"
CACHE_TTL_SECONDS = 7200
MAX_CACHED_SHOPS = 100


def _make_cache_key(shop_doc_id: str) -> str:
    return f"{CACHE_KEY_PREFIX}{shop_doc_id}"


def _make_version_key(shop_doc_id: str) -> str:
    return f"shop_config_version:{shop_doc_id}"


async def get_shop_config_version(shop_doc_id: str) -> str:
    if not r:
        return ""
    try:
        ver = await r.get(_make_version_key(shop_doc_id))
        return ver or ""
    except Exception:
        return ""


async def bump_shop_config_version(shop_doc_id: str):
    if not r:
        return
    try:
        new_ver = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
        await r.set(_make_version_key(shop_doc_id), new_ver, ex=CACHE_TTL_SECONDS)
    except Exception:
        pass


async def get_cached_content_id(shop_doc_id: str, config_version: str):
    if not r:
        return None
    try:
        key = _make_cache_key(shop_doc_id)
        data = await r.get(key)
        if not data:
            return None
        parts = data.split("::", 1)
        if len(parts) == 2 and parts[0] == config_version:
            return parts[1]
        await r.delete(key)
        return None
    except Exception:
        return None


async def set_cached_content_id(shop_doc_id: str, config_version: str, cache_id: str):
    if not r:
        return
    try:
        key = _make_cache_key(shop_doc_id)
        await r.set(key, f"{config_version}::{cache_id}", ex=CACHE_TTL_SECONDS)
        await r.zadd(f"{CACHE_KEY_PREFIX}index", {shop_doc_id: time.time()})
    except Exception:
        pass


def invalidate_system_prompt_cache(shop_doc_id: str = None, keyword: str = None):
    """Fire-and-forget cache invalidation. Called when admin saves AI config."""
    async def _invalidate():
        if shop_doc_id:
            await bump_shop_config_version(shop_doc_id)
            if r:
                await r.delete(_make_cache_key(shop_doc_id))
                try:
                    await r.delete(f"prompt_hash:{shop_doc_id}")
                except Exception:
                    pass

    try:
        asyncio.create_task(_invalidate())
    except RuntimeError:
        pass
