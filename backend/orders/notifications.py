"""
Orders: Admin notifications for new orders and handover requests.
"""
import asyncio
from datetime import datetime, timezone
from config import db


async def notify_admin_order(shop_doc_id: str, order_data: dict) -> None:
    """Send a notification to shop admins about a new order."""
    if not db:
        return

    try:
        notification = {
            "type": "new_order",
            "shop_doc_id": shop_doc_id,
            "order_summary": order_data.get("items", []),
            "total_price": order_data.get("total_price", 0),
            "customer_name": order_data.get("customer_name", "Unknown"),
            "customer_phone": order_data.get("phone", ""),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "read": False,
        }
        await asyncio.to_thread(
            db.collection("shops").document(shop_doc_id)
            .collection("notifications").add, document_data=notification,
        )
    except Exception as e:
        print(f"⚠️ Notification error: {e}", flush=True)


async def notify_handover(shop_doc_id: str, user_id: str, reason: str = "") -> None:
    """Notify admin that a customer needs human handover."""
    if not db:
        return

    try:
        await asyncio.to_thread(
            db.collection("shops").document(shop_doc_id)
            .collection("notifications").add, document_data={
                "type": "handover_request",
                "shop_doc_id": shop_doc_id,
                "user_id": user_id,
                "reason": reason,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "read": False,
            },
        )
    except Exception:
        pass
