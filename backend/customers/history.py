"""
Customers: Chat history management (Redis-based).
"""
import json
from config import r


async def add_to_history(shop_doc_id: str, conv_id: str, role: str,
                         text: str, max_len: int = 30) -> None:
    """Append a message to the conversation history in Redis."""
    if not r or not text:
        return

    key = f"history:{shop_doc_id}:{conv_id}"
    entry = f"{role}: {text}"

    try:
        # Push and trim
        await r.rpush(key, entry)
        await r.ltrim(key, -max_len, -1)
        await r.expire(key, 86400 * 7)  # 7-day TTL
    except Exception:
        pass


async def get_history(shop_doc_id: str, conv_id: str) -> str:
    """Get conversation history as a formatted string."""
    if not r:
        return ""

    key = f"history:{shop_doc_id}:{conv_id}"
    try:
        entries = await r.lrange(key, 0, -1)
        return "\n".join(entries) if entries else ""
    except Exception:
        return ""


async def clear_history(shop_doc_id: str, conv_id: str = "*") -> int:
    """Clear chat history for a shop or specific conversation. Returns deleted key count."""
    if not r:
        return 0

    try:
        pattern = f"history:{shop_doc_id}:{conv_id}"
        keys = await r.keys(pattern)
        if keys:
            await r.delete(*keys)
        return len(keys) if keys else 0
    except Exception:
        return 0
