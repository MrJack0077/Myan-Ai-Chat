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
    payment_method = final_data.get("extracted", {}).get("payment_method", "")

    # ── Validation ──
    phone = ident.get("phone", "")
    name = ident.get("name", "")
    address = ident.get("address", "")
    
    print(f"📋 Order validation: name='{name}' phone='{phone}' address='{address[:30]}...' items={order_items} total={total_price}", flush=True)

    valid, error_msg = validate_order(name, phone, address, order_items, total_price)
    if not valid:
        print(f"❌ Order validation failed: {error_msg}", flush=True)
        # Reset order state so customer can retry
        prof.setdefault("dynamics", {})["order_state"] = "COLLECTING"
        from customers.profile import save_profile
        await save_profile(shop_doc_id, user_id, prof)
        return  # Don't save invalid order

    # ── Clean item names (remove leading junk characters) ──
    import re as _re
    clean_items = []
    for item in order_items:
        if isinstance(item, str):
            # Remove leading non-alphanumeric except -, space, +, numbers
            clean = _re.sub(r'^[^\w\s\-\+]+', '', str(item)).strip()
            if clean and len(clean) > 2:
                clean_items.append(clean)
    order_items = clean_items

    # ── Save order ──
    order_data = {
        "shop_doc_id": shop_doc_id,
        "acc_id": acc_id,
        "user_id": user_id,
        "customer_name": name,
        "phone": phone,
        "address": address,
        "items": order_items,
        "total_price": total_price,
        "currency": currency,
        "status": "confirmed",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "payment_method": payment_method,
    }

    try:
        order_ref = await asyncio.to_thread(
            db.collection("shops").document(shop_doc_id)
            .collection("orders").add, document_data=order_data,
        )
        order_id = order_ref[1].id if isinstance(order_ref, tuple) else getattr(order_ref, 'id', 'unknown')
        print(f"✅ Order SAVED: {order_id} | {name} | {order_items} | {total_price} {currency}", flush=True)

        # Reduce stock
        await _reduce_stock(shop_doc_id, order_items)

        # Update profile
        prof.setdefault("dynamics", {})["order_state"] = "COMPLETED"
        sales = prof.setdefault("sales_data", {})
        sales.setdefault("past_purchases", []).append({
            "items": order_items,
            "total_price": total_price,
            "date": datetime.now(timezone.utc).isoformat(),
        })
        sales["total_spent"] = sales.get("total_spent", 0) + total_price
        from customers.profile import save_profile
        await save_profile(shop_doc_id, user_id, prof)

    except Exception as e:
        print(f"🔥 Order save failed: {e}", flush=True)


def validate_order(name: str, phone: str, address: str,
                   items: list, total) -> tuple[bool, str]:
    """Validate order data before saving. Returns (is_valid, error_message)."""
    # Convert total to int (AI sometimes returns string)
    try:
        total = int(total) if total else 0
    except (ValueError, TypeError):
        total = 0
    
    # Minimum requirements: at least one item + customer name
    if not name or len(str(name).strip()) < 2:
        return False, f"Customer name required (got: '{name}')"
    if not items or len(items) == 0:
        return False, "No items in order"
    
    # Phone and address are nice-to-have, not required (Myanmar context)
    if phone and len(str(phone).strip()) < 7:
        print(f"⚠️ Order: phone too short ('{phone}'), but accepting", flush=True)
    if not phone:
        print(f"⚠️ Order: no phone provided (accepted)", flush=True)
    if not address:
        print(f"⚠️ Order: no address provided (accepted)", flush=True)
    if not total or total <= 0:
        print(f"⚠️ Order with zero total: items={items}", flush=True)
    
    return True, ""


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
