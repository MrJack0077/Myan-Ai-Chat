"""
Orders: State machine & confirmation flow.
Manages the lifecycle: COLLECTING → CONFIRMING → CONFIRMED.
"""
import asyncio
from datetime import datetime, timezone
from config import db
from shared.http_client import bg_post
from sendpulse.actions import open_chat
from customers.history import add_to_history


async def handle_order_confirmation(
    shop_doc_id: str, acc_id: str, conv_id: str, user_id: str,
    token: str, agent_id: str, prof: dict, currency: str,
    final_data: dict,
) -> None:
    """
    Save confirmed order to Firestore and notify admin.
    Updates inventory (stock reduction).
    """
    ident = prof.get("identification", {})
    order_items = prof.get("current_order", {}).get("items", [])
    total_price = prof.get("current_order", {}).get("total_price", 0)

    order_data = {
        "shop_doc_id": shop_doc_id,
        "acc_id": acc_id,
        "user_id": user_id,
        "customer_name": ident.get("name", "Unknown"),
        "phone": ident.get("phone", ""),
        "address": ident.get("address", ""),
        "items": order_items,
        "total_price": total_price,
        "currency": currency,
        "status": "confirmed",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "payment_method": final_data.get("extracted", {}).get("payment_method", ""),
    }

    try:
        await asyncio.to_thread(
            db.collection("shops").document(shop_doc_id)
            .collection("orders").add, document_data=order_data,
        )
        print(f"✅ Order saved: {ident.get('name')} | {order_items} | {total_price} {currency}", flush=True)

        # Reduce stock
        await _reduce_stock(shop_doc_id, order_items)

    except Exception as e:
        print(f"🔥 Order save failed: {e}", flush=True)


async def _reduce_stock(shop_doc_id: str, items: list[str]) -> None:
    """Reduce product stock after order confirmation."""
    if not db or not items:
        return

    try:
        products_ref = db.collection("shops").document(shop_doc_id).collection("products")
        docs = await asyncio.to_thread(products_ref.stream)
        for doc in docs:
            data = doc.to_dict() if callable(doc.to_dict) else {}
            name = data.get("name", "")
            if any(item.lower() in name.lower() for item in items):
                current_stock = data.get("stock", 0)
                if current_stock > 0:
                    await asyncio.to_thread(
                        products_ref.document(doc.id).update,
                        {"stock": current_stock - 1},
                    )
                    print(f"📦 Stock reduced: {name} ({current_stock} → {current_stock - 1})", flush=True)
    except Exception as e:
        print(f"⚠️ Stock reduction error: {e}", flush=True)


async def handle_escalation(
    shop_doc_id: str, acc_id: str, conv_id: str, user_id: str,
    token: str, agent_id: str, intent_type: str, lang: str,
    ai_reply: str = "",
) -> str:
    """
    Handle escalation to human admin.
    Opens chat in SendPulse and sends empathy message.
    """
    if lang.lower() in ("myanmar", "burmese", "mm"):
        escalation_msg = "ဒီအကြောင်းအရာကို admin နဲ့ ချိတ်ဆက်ပေးလိုက်ပါမယ်ရှင့်။ ခဏစောင့်ပေးပါနော်။"
    else:
        escalation_msg = "Let me connect you with our team. Please wait a moment."

    # Try to open chat in SendPulse
    await open_chat(acc_id, user_id, token)

    return ai_reply or escalation_msg
