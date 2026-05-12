from .config import r
from core.cache_manager import cache_touch, TTL_COOL


async def add_to_history(shop_id, conv_id, role, message, max_len=10):
    """Add a message to the chat history list in Redis.
    Sets TTL on first message, renews on every subsequent message.
    """
    if not r or not message:
        return None
    key = f"chat_hist:{shop_id}:{conv_id}"
    try:
        await r.rpush(key, f"{role}: {message}")
        length = await r.llen(key)
        
        # Renew TTL on every message — active conversations stay cached
        await cache_touch(key, TTL_COOL)
        
        if length > max_len:
            return await r.lpop(key)
        return None
    except Exception as e:
        print(f"Redis add_to_history error: {e}")
        return None


async def get_history(shop_id, conv_id):
    """Get full chat history from Redis."""
    if not r:
        return ""
    key = f"chat_hist:{shop_id}:{conv_id}"
    try:
        history_list = await r.lrange(key, 0, -1)
        if not history_list:
            return ""
        return "\n".join(history_list)
    except Exception:
        return ""


async def check_rate_limit(shop_id, limit=30, window=60):
    """Check if shop is within rate limit. Returns True if allowed.
    
    Uses atomic SET NX EX to guarantee expiry is always set at creation time.
    On every subsequent access, refreshes expiry via EXPIRE NX to prevent
    permanent keys (safety net for edge cases).
    """
    if not r:
        return True
    key = f"rate_limit:{shop_id}"
    try:
        # Atomic: SET with NX + EX only succeeds if key doesn't exist,
        # ensuring expiry is always set at creation time.
        was_created = await r.set(key, "1", nx=True, ex=window)
        if was_created:
            return True  # First request in window
        
        # Key already exists — increment and check
        current = await r.incr(key)
        # Safety: ensure TTL is set (no-op if already has TTL)
        await r.expire(key, window, nx=True)
        return current <= limit
    except Exception:
        return True
