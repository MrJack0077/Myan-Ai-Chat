"""
Orders: Firestore persistence — save orders, update inventory.
"""
import asyncio
from datetime import datetime, timezone
from config import db


async def save_order(shop_doc_id: str, order_data: dict) -> str | None:
    """Save an order document to Firestore. Returns doc ID or None."""
    if not db:
        return None
    try:
        order_data.setdefault("created_at", datetime.now(timezone.utc).isoformat())
        order_data.setdefault("status", "pending")
        ref = await asyncio.to_thread(
            db.collection("shops").document(shop_doc_id)
            .collection("orders").add, document_data=order_data,
        )
        return ref[1].id if isinstance(ref, tuple) else ref.id
    except Exception as e:
        print(f"🔥 Order save error: {e}", flush=True)
        return None


async def update_inventory(shop_doc_id: str, items: list[str], delta: int = -1) -> int:
    """Update product inventory (reduce by delta). Returns count of updated products."""
    if not db or not items:
        return 0

    updated = 0
    try:
        products_ref = db.collection("shops").document(shop_doc_id).collection("products")
        docs = await asyncio.to_thread(products_ref.stream)
        for doc in docs:
            data = doc.to_dict() if callable(doc.to_dict) else {}
            name = data.get("name", "")
            if any(item.lower() in name.lower() for item in items):
                current = data.get("stock", 0)
                new_stock = max(0, current + delta)
                await asyncio.to_thread(products_ref.document(doc.id).update, {"stock": new_stock})
                updated += 1
    except Exception as e:
        print(f"⚠️ Inventory update error: {e}", flush=True)

    return updated
