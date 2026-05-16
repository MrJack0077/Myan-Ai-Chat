"""
Shops: Analytics and token tracking.
"""
import asyncio
from datetime import datetime, timezone
from config import db, r


async def increment_tokens(acc_id: str, tokens: int) -> None:
    """Increment shop token usage counter."""
    if not r or tokens <= 0:
        return
    try:
        key = f"shop_tokens:{acc_id}"
        await r.incrby(key, tokens)
        await r.expire(key, 86400)  # 24h TTL
    except Exception:
        pass


async def log_analytics(shop_doc_id: str, event_type: str, metadata: dict = None) -> None:
    """Log an analytics event to Firestore (background-safe)."""
    if not db:
        return

    try:
        event = {
            "type": event_type,
            "shop_doc_id": shop_doc_id,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await asyncio.to_thread(
            db.collection("shops").document(shop_doc_id)
            .collection("analytics").add, document_data=event,
        )
    except Exception:
        pass  # Analytics should never block the pipeline
