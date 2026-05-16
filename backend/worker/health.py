"""
Worker: Health check utilities for worker processes.
"""
from config import r


async def health_check_redis() -> bool:
    """Check if Redis is responsive."""
    if not r:
        return False
    try:
        return await r.ping()
    except Exception:
        return False


async def get_queue_stats() -> dict:
    """Get queue statistics for monitoring."""
    stats = {"redis_available": r is not None, "queue_length": 0, "total_keys": 0}
    if r:
        try:
            from webhook.queue import QUEUE_KEY
            stats["queue_length"] = await r.llen(QUEUE_KEY) or 0
            stats["total_keys"] = await r.dbsize() or 0
        except Exception:
            pass
    return stats
