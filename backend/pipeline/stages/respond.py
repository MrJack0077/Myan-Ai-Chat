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

    # ── Stop typing + send ──
    await send_stop_typing(acc_id, user_id, token)
    await asyncio.sleep(_typing_delay(reply_text))
    await send_message(acc_id, user_id, reply_text, extracted, token, channel)

    # ── Order confirmation ──
    if intent_type == "ORDER_CONFIRMED":
        print(f"🔔 Order confirmed! Saving...", flush=True)
        await handle_order_confirmation(
            shop_doc_id, acc_id, conv_id, user_id, token, agent_id,
            prof, currency, unified_result,
        )


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
