"""
Pipeline Stage 7: Send AI reply to user via SendPulse.
Handles escalation, order confirmation, and fallback responses.
"""
import asyncio
from sendpulse.messages import send_message
from sendpulse.actions import send_stop_typing
from customers.history import add_to_history
from customers.profile import save_profile
from orders.handler import handle_order_confirmation, handle_escalation


async def send_reply(
    unified_result: dict, acc_id: str, user_id: str, conv_id: str,
    shop_doc_id: str, token: str, prof: dict, currency: str,
    channel: str = "", agent_id: str = "", lang: str = "Myanmar",
) -> None:
    """
    Send the AI-generated reply to the user.
    - Handles escalation (complex queries → human)
    - Handles order confirmation
    - Falls back to safe defaults for empty replies
    """
    reply_text = unified_result.get("reply", "")
    intent_type = unified_result.get("intent", "PRODUCT_INQUIRY")
    is_complex = unified_result.get("is_complex", False)
    extracted = unified_result.get("extracted", {})

    # ── Escalation ──
    if (is_complex and intent_type != "ORDER_CONFIRMED") or intent_type == "COMPLAINT_OR_HUMAN":
        ai_reply = reply_text
        reply_text = await handle_escalation(
            shop_doc_id, acc_id, conv_id, user_id, token, agent_id,
            intent_type, lang, ai_reply=ai_reply,
        )
        await add_to_history(shop_doc_id, conv_id, "AI", reply_text, max_len=10)
        await send_message(acc_id, user_id, reply_text, extracted, token, channel)
        return

    # ── Empty reply fallback ──
    if not reply_text.strip():
        reply_text = _fallback_reply(intent_type, lang)
        unified_result["reply"] = reply_text

    # ── Save to history ──
    await add_to_history(shop_doc_id, conv_id, "AI", reply_text, max_len=10)

    # ⚡ CRITICAL: Save profile with AI-extracted data immediately
    if extracted:
        ident = prof.setdefault("identification", {})
        curr = prof.setdefault("current_order", {})
        dyn = prof.setdefault("dynamics", {})
        
        if extracted.get("name"):
            ident["name"] = str(extracted["name"])
        if extracted.get("phone"):
            ident["phone"] = str(extracted["phone"])
        if extracted.get("address"):
            ident["address"] = str(extracted["address"])
        if extracted.get("items"):
            curr["items"] = list(extracted["items"])
        if extracted.get("total_price"):
            try:
                curr["total_price"] = int(extracted["total_price"])
            except (ValueError, TypeError):
                curr["total_price"] = 0
        if extracted.get("payment_method"):
            curr["payment_method"] = str(extracted["payment_method"])
        
        # Save profile to Redis + Firestore (background-safe)
        if any(extracted.get(k) for k in ["name", "phone", "items", "payment_method"]):
            asyncio.create_task(save_profile(shop_doc_id, conv_id, prof))
            print(f"📝 Profile auto-saved with: name={ident.get('name','')}, phone={ident.get('phone','')}, items={curr.get('items',[])}", flush=True)

    # ── Stop typing + send (with channel detection from shop data) ──
    await send_stop_typing(acc_id, user_id, token)
    await asyncio.sleep(_typing_delay(reply_text))
    
    # Detect channel from shop's sendpulseBots array
    detected_channel = channel  # Use passed channel if available
    if not detected_channel:
        from shops.service import get_shop_data
        shop = await get_shop_data(acc_id)
        if shop:
            bots = shop.get("sendpulseBots", [])
            for bot in bots:
                if isinstance(bot, dict) and bot.get("id") == acc_id:
                    detected_channel = bot.get("channel", "")
                    break
    
    await send_message(acc_id, user_id, reply_text, extracted, token, detected_channel)

    # ── Order confirmation ──
    should_confirm = (intent_type == "ORDER_CONFIRMED" or 
                      (order_state == "COLLECTING" and _is_confirmation(reply_text, user_msg)))
    
    if should_confirm:
        # Force intent to ORDER_CONFIRMED if keyword detected
        if intent_type != "ORDER_CONFIRMED":
            print(f"🔔 Keyword override: COLLECTING + confirm → ORDER_CONFIRMED", flush=True)
            unified_result["intent"] = "ORDER_CONFIRMED"
        
        print(f"🔔 Order confirmed! Saving...", flush=True)
        print(f"🔔 DEBUG: ident={prof.get('identification',{})} order={prof.get('current_order',{})}", flush=True)
        print(f"🔔 DEBUG: extracted={extracted}", flush=True)
        
        await handle_order_confirmation(
            shop_doc_id, acc_id, conv_id, user_id, token, agent_id,
            prof, currency, unified_result,
        )


def _is_confirmation(ai_reply: str, user_msg: str) -> bool:
    """Check if message indicates order confirmation (keyword + context)."""
    msg = (user_msg or "").lower().strip()
    confirm_words = [
        "yes", "ok", "okay", "confirm", "correct", "right", "confirmed",
        "ဟုတ်", "ဟုတ်ကဲ့", "မှန်", "အိုကေ", "yes ပါ",
        "အားလုံးမှန်ပါတယ်", "တင်လိုက်ပါ", "အော်ဒါတင်လိုက်",
        "အတည်ပြုပါတယ်", "ဟုတ်ပါတယ်", "မှန်ပါတယ်",
    ]
    if any(w in msg for w in confirm_words):
        return True
    # Also check if AI reply contains order summary (indicates AI already confirmed)
    if ai_reply and any(w in (ai_reply or "").lower() for w in ["order confirmed", "အော်ဒါအတည်ပြု", "အတည်ပြုပြီး"]):
        return True
    return False


def _fallback_reply(intent: str, lang: str) -> str:
    """Generate a safe default reply when AI returns empty."""
    if lang.lower() in ("myanmar", "burmese", "mm"):
        replies = {
            "PRODUCT_INQUIRY": "ရှာမတွေ့ပါဘူးရှင့်။ နာမည်အပြည့်အစုံလေး ပြောပေးပါဦးနော်။",
            "START_ORDER": "ဟုတ်ကဲ့ရှင့်။ အော်ဒါတင်ဖို့ နာမည်လေး ပြောပေးပါဦးနော်။",
            "DELIVERY": "ပို့ဆောင်ရေးအကြောင်း ပြောပြပေးပါမယ်ရှင့်။ ဘယ်မြို့လဲ ပြောပေးပါဦး။",
        }
        return replies.get(intent, "ဘာကူညီပေးရမလဲရှင့်။")
    else:
        replies = {
            "PRODUCT_INQUIRY": "I couldn't find that. Could you share the exact product name?",
            "DELIVERY": "Let me share our delivery info. Which city are you in?",
        }
        return replies.get(intent, "How can I help you today?")


def _typing_delay(reply_text: str) -> float:
    """Simulate human typing delay (fast, capped at 0.15s)."""
    import random
    if not reply_text:
        return 0.0
    delay = len(reply_text) / 40.0  # 40 chars/sec
    delay += random.uniform(-0.1, 0.1) * delay
    return max(0.05, min(delay, 0.15))
