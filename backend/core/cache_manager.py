"""
Central cache manager — unified TTL policies, invalidation, and cleanup.

All cache keys MUST be registered here. No scattered EXPIRE calls elsewhere.

TTL Policy:
  L0 (Hot):   60s    — rate_limit, debounce
  L1 (Warm):  120s   — shop_data, sendpulse_token, system_prompt
  L2 (Cool):  3600s  — user profile, chat history
  L3 (Cold):  7 days — semantic_cache (Firestore)
"""
import asyncio

# ── TTL Constants ──
TTL_HOT   = 60       # rate limit, debounce
TTL_WARM  = 120      # shop data, token, system prompt
TTL_COOL  = 3600     # profile, chat history (1 hour)
TTL_COLD  = 604800   # semantic cache (7 days)


# ── Central Invalidation ──

async def invalidate_shop_caches(shop_doc_id: str, acc_id: str = ""):
    """
    Invalidate ALL caches for a shop. Called by /refresh and shop update API.
    Uses SCAN for pattern-based cleanup instead of tracking SETs.
    """
    from utils.config import r
    if not r:
        return

    patterns = [
        f"shop_data_v2:{acc_id}",                     # exact key
        f"sys_prompt:{shop_doc_id}:*",                # pattern
    ]

    deleted = 0
    for pattern in patterns:
        try:
            if "*" in pattern:
                # SCAN-based pattern delete (safe for production)
                cursor = 0
                while True:
                    cursor, keys = await r.scan(cursor, match=pattern, count=100)
                    if keys:
                        await r.delete(*keys)
                        deleted += len(keys)
                    if cursor == 0:
                        break
            else:
                # Exact key delete
                if pattern:
                    result = await r.delete(pattern)
                    deleted += result
        except Exception as e:
            print(f"⚠️ Cache invalidate error for {pattern}: {e}", flush=True)

    # Also clear Firestore semantic cache (old entries)
    await _cleanup_old_semantic_cache(shop_doc_id)

    if deleted:
        print(f"🧹 Invalidated {deleted} cache keys for shop {shop_doc_id}", flush=True)


async def _cleanup_old_semantic_cache(shop_doc_id: str, max_age_seconds: int = TTL_COLD):
    """Delete semantic cache entries older than max_age_seconds."""
    from utils.config import db
    from datetime import datetime, timezone, timedelta

    if not db:
        return

    cutoff = datetime.now(timezone.utc) - timedelta(seconds=max_age_seconds)
    cutoff_iso = cutoff.isoformat()

    def _delete_old():
        try:
            cache_ref = db.collection("shops").document(shop_doc_id).collection("semantic_cache")
            # Delete entries older than cutoff (up to 200 at a time)
            docs = cache_ref.limit(200).get()
            batch = db.batch()
            count = 0
            for doc in docs:
                data = doc.to_dict()
                created = data.get("created_at", "")
                if created and created < cutoff_iso:
                    batch.delete(doc.reference)
                    count += 1
                    if count >= 500:  # Firestore batch limit
                        break
            if count > 0:
                batch.commit()
                print(f"🧹 Cleaned {count} old semantic cache entries for {shop_doc_id}", flush=True)
        except Exception as e:
            print(f"⚠️ Semantic cache cleanup error: {e}", flush=True)

    await asyncio.to_thread(_delete_old)


# ── Safe SETEX Helpers ──

async def cache_set(key: str, value: str, ttl: int):
    """Set a cache key with TTL. Silently handles Redis errors."""
    from utils.config import r
    if not r:
        return
    try:
        await r.setex(key, ttl, value)
    except Exception as e:
        print(f"⚠️ cache_set error for {key}: {e}", flush=True)


async def cache_get(key: str) -> str | None:
    """Get a cache key. Returns None on miss or error."""
    from utils.config import r
    if not r:
        return None
    try:
        return await r.get(key)
    except Exception:
        return None


async def cache_delete(key: str):
    """Delete a cache key."""
    from utils.config import r
    if not r:
        return
    try:
        await r.delete(key)
    except Exception:
        pass


async def cache_touch(key: str, ttl: int = TTL_COOL):
    """Renew TTL on an existing key (keeps it alive for active users)."""
    from utils.config import r
    if not r:
        return
    try:
        await r.expire(key, ttl)
    except Exception:
        pass
