"""Order confirmation, escalation, and typing indicator management."""
import asyncio
import json
from datetime import datetime, timezone
from utils import db, r, bg_post, handover_to_admin, log_shop_analytics
from .profile_manager import save_profile


TYPING_URL = "https://api.sendpulse.com/chatbots/v2/contacts/action"
OPEN_CHAT_URL = "https://api.sendpulse.com/chatbots/v2/bot/{bot_id}/contacts/{contact_id}/open-chat"
ADD_TAG_URL = "https://api.sendpulse.com/chatbots/v2/bot/{bot_id}/contacts/{contact_id}/tags"


async def send_typing(acc_id, user_id, token):
    """Send typing indicator via SendPulse (fire-and-forget)."""

    async def _send():
        r_type = await bg_post(TYPING_URL, {"bot_id": acc_id, "contact_id": user_id, "action": "typing"}, token, timeout=3.0)
        if r_type and r_type.status_code == 404:
            alt_url = TYPING_URL.replace("/v2", "")
            r2 = await bg_post(alt_url, {"bot_id": acc_id, "contact_id": user_id, "action": "typing"}, token, timeout=3.0)
            if r2 and r2.status_code == 404:
                await bg_post("https://api.sendpulse.com/messenger/contacts/sendTyping", {"contact_id": user_id}, token, timeout=3.0)

    asyncio.create_task(_send())


async def send_stop_typing(acc_id, user_id, token):
    """Send stop_typing indicator (fire-and-forget)."""

    async def _send():
        r_type = await bg_post(TYPING_URL, {"bot_id": acc_id, "contact_id": user_id, "action": "stop_typing"}, token)
        if r_type and r_type.status_code == 404:
            alt_url = TYPING_URL.replace("/v2", "")
            await bg_post(alt_url, {"bot_id": acc_id, "contact_id": user_id, "action": "stop_typing"}, token)

    asyncio.create_task(_send())


async def _open_chat_in_sendpulse(acc_id, contact_id, token, pause_hours=1, assignee_id=None):
    """
    Open chat in SendPulse Conversations inbox + add tag + pause bot automation.
    
    Assigns the chat to the specified assignee so it shows in "My" filter.
    Admin can then find it in Conversations → Filter: My.
    
    Pause bot for N hours so AI doesn't interfere while admin handles manually.
    """
    if not token or not acc_id or not contact_id:
        return

    tag_url = ADD_TAG_URL.format(bot_id=acc_id, contact_id=contact_id)
    open_url = OPEN_CHAT_URL.format(bot_id=acc_id, contact_id=contact_id)

    async def _send():
        # Step 1: Tag contact so admin can filter
        try:
            await bg_post(tag_url, {"tags": ["Needs Human"]}, token, timeout=5.0)
            print(f"🏷️ Tagged 'Needs Human' on {contact_id}", flush=True)
        except Exception as e:
            print(f"⚠️ Tag error (non-critical): {e}", flush=True)

        # Step 2: Open chat in Conversations inbox + assign to admin
        try:
            open_payload = {
                "contact_id": contact_id,
                "pause_hours": pause_hours,
            }
            if assignee_id:
                open_payload["assignee_id"] = str(assignee_id)
            
            resp = await bg_post(open_url, open_payload, token, timeout=5.0)
            if resp and resp.status_code in (200, 201, 202):
                assignee_info = f" → assigned to {assignee_id}" if assignee_id else ""
                print(f"📬 Chat opened for {contact_id}{assignee_info}, bot paused {pause_hours}h", flush=True)
            elif resp and resp.status_code == 404:
                alt_url = f"https://api.sendpulse.com/chatbots/v1/bot/{acc_id}/contacts/{contact_id}/open-chat"
                await bg_post(alt_url, open_payload, token, timeout=5.0)
                print(f"📬 Chat opened (v1) for {contact_id}", flush=True)
        except Exception as e:
            print(f"⚠️ Open chat error (non-critical): {e}", flush=True)

    asyncio.create_task(_send())


async def handle_escalation(shop_doc_id, acc_id, conv_id, user_id, token, agent_id, intent_type, lang, ai_reply=""):
    """Escalate to human admin: AI reply + open chat in SendPulse + Firestore notification.
    
    Uses the AI's own empathetic reply if available — only falls back to hardcoded
    if AI didn't generate anything meaningful.
    """
    print(f"⚠️ Escalating to admin: intent={intent_type}")
    await log_shop_analytics(shop_doc_id, "ESCALATION", {"user_id": user_id, "reason": intent_type})

    # Open chat in SendPulse Conversations inbox + tag + assign to admin + pause bot 1h
    asyncio.create_task(_open_chat_in_sendpulse(acc_id, user_id, token, pause_hours=1, assignee_id=agent_id))
    
    # Firestore notification for admin dashboard
    asyncio.create_task(handover_to_admin(acc_id, conv_id, token, admin_id=agent_id, labels=[intent_type, "Escalated"]))

    # Use AI's empathetic reply if it's good — otherwise fallback
    if ai_reply and len(ai_reply.strip()) > 10:
        print(f"✅ Escalation: Using AI-generated reply ({len(ai_reply)} chars)", flush=True)
        return ai_reply.strip()

    # Hardcoded fallback — warm, human-like, varied by language
    if lang.lower() in ["myanmar", "burmese", "mm"]:
        fallbacks = [
            "အဆင်မပြေမှုအတွက် တောင်းပန်ပါတယ်ရှင့်။ ကျွန်မတို့ရဲ့ customer service ကိုယ်စားလှယ်တစ်ဦးနဲ့ ချိတ်ဆက်ပေးထားပါတယ်။ ခဏစောင့်ပေးပါနော်။",
            "စိတ်မကောင်းပါဘူးရှင့်။ လူကြီးမင်းရဲ့အခက်အခဲကို အမြန်ဆုံးဖြေရှင်းနိုင်ဖို့ admin နဲ့ချိတ်ဆက်ပေးလိုက်ပါတယ်။ ခဏလောက်စောင့်ပေးပါရှင့်။",
            "နားလည်ပေးပါရှင့်။ ဒီကိစ္စကို ကျွန်မတို့အဖွဲ့က ဆက်လက်ကူညီပေးပါမယ်။ ခဏစောင့်ပေးပါနော်။",
        ]
        import random
        return random.choice(fallbacks)
    return "I apologize for the inconvenience. I've connected you with a human agent who will assist you shortly. Please wait a moment."


async def handle_order_confirmation(shop_doc_id, acc_id, conv_id, user_id, token, agent_id, prof, currency, final_data):
    """Save confirmed order to Firestore, update profile, clear history."""
    ident = prof.get("identification", {})
    curr = prof.get("current_order", {})
    sales = prof.get("sales_data", {})
    dynamics = prof.get("dynamics", {})

    items_list = curr.get("items", [])
    items_str = ", ".join(items_list)
    total_price = curr.get('total_price', 0)
    
    # ── Validation: ensure order has minimum required fields ──
    missing = []
    name = (ident.get('name') or '').strip()
    phone = (ident.get('phone') or '').strip()
    address = (curr.get('address') or '').strip()
    
    if not name or len(name) < 2:
        missing.append("name")
    if not phone or len(phone) < 7:
        missing.append("phone")
    if not address or len(address) < 5:
        missing.append("address")
    if not items_list or len(items_list) == 0:
        missing.append("items")
    if total_price <= 0:
        missing.append("total_price")
    
    if missing:
        print(f"⚠️ Order validation FAILED — missing: {', '.join(missing)}. Not saving.", flush=True)
        return  # Don't save incomplete orders
    
    print(f"✅ Order validation PASSED — saving order for {name}", flush=True)
    
    await log_shop_analytics(shop_doc_id, "ORDER_CONFIRMED", {"user_id": user_id, "total_price": total_price})

    # Save order to Firestore
    try:
        doc_ref = db.collection("shops").document(shop_doc_id).collection("orders").document()
        doc_ref.set({
            "order_id": doc_ref.id,
            "customer_name": ident.get('name', ''),
            "customer_phone": ident.get('phone', ''),
            "customer_address": curr.get('address', ''),
            "items": items_list,
            "payment_method": curr.get('payment_method', ''),
            "deli_charge": curr.get('deli_charge', 0),
            "total_price": total_price,
            "payment_slip_url": curr.get('payment_slip_url', ''),
            "status": "pending",
            "sendpulse_bot_id": acc_id,
            "sendpulse_user_id": user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        # Store order ID for reference
        saved_order_id = doc_ref.id
        
        # Auto-invalidate cache after new order
        try:
            from .cache_manager import invalidate_shop_caches
            await invalidate_shop_caches(shop_doc_id, acc_id=acc_id)
        except Exception:
            pass
    except Exception as e:
        print(f"Firestore order save error: {e}")
        saved_order_id = None

    # Build notification note
    note = (
        f"📝 **New Order Alert!**\n"
        f"👤 {ident.get('name', 'N/A')}\n📞 {ident.get('phone', 'N/A')}\n📍 {curr.get('address', 'N/A')}\n"
        f"💳 {curr.get('payment_method', 'N/A')}\n🚚 Deli: {curr.get('deli_charge', 0)} {currency}\n"
        f"💰 Total: {total_price} {currency}\n📦 {items_str}"
    )
    if curr.get('payment_slip_url'):
        note += f"\n🧾 Slip: {curr.get('payment_slip_url')}"

    # ── Admin Notification ──
    try:
        notif_ref = db.collection("shops").document(shop_doc_id).collection("notifications").document()
        notif_ref.set({
            "type": "new_order",
            "title": f"New Order from {ident.get('name', 'Unknown')}",
            "body": note,
            "order_id": doc_ref.id,
            "shop_id": shop_doc_id,
            "user_id": user_id,
            "total_price": total_price,
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        print(f"🔔 Admin notification sent for order {doc_ref.id}", flush=True)
    except Exception as e:
        print(f"⚠️ Admin notification save error: {e}")

    # Update past purchases in sales_data
    past_purchases = sales.get("past_purchases", [])
    past_purchases.append({
        "items": items_list,
        "total_price": total_price,
        "date": datetime.now(timezone.utc).isoformat(),
    })
    sales["past_purchases"] = past_purchases
    sales["total_orders"] = len(past_purchases)
    sales["total_spent"] = sales.get("total_spent", 0) + total_price

    # Reset profile state
    prof["dynamics"]["order_state"] = "NONE"
    prof["dynamics"]["active_order_id"] = ""
    
    prof["current_order"].update({
        "items": [],
        "payment_slip_url": "", 
        "deli_charge": 0, 
        "total_price": 0,
    })
    
    await save_profile(shop_doc_id, user_id, prof)

    # Clear short-term memory after order
    try:
        if r:
            await r.delete(f"chat_hist:{shop_doc_id}:{conv_id}")
    except Exception as e:
        print(f"Error resetting chat history: {e}")
