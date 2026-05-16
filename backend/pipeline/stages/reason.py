"""
Pipeline Stage 6: AI reasoning — call unified agent to generate reply.
"""
import time
from ai.agent import run_unified_agent


async def generate_ai_reply(
    user_msg: str, chat_history: str, profile: dict, ai_config: dict,
    tool_info: str, order_state: str, media_parts: list,
    photo_context: str, shop_doc_id: str,
    delivery_info: list, payment_info: list, currency: str,
) -> dict:
    """
    Call the Unified AI Agent to generate intent + reply + extracted data.
    Returns {intent, reply, is_complex, extracted, prompt_tokens, candidate_tokens}.
    """
    t_start = time.time()
    print(f"⚡ Unified Agent: ONE AI call (state={order_state})...", flush=True)

    result = await run_unified_agent(
        user_msg=user_msg,
        chat_history=chat_history,
        profile=profile,
        ai_config=ai_config,
        tool_info=tool_info,
        order_state=order_state,
        media_parts=media_parts,
        photo_context=photo_context,
        shop_doc_id=shop_doc_id,
        delivery_info=delivery_info,
        payment_info=payment_info,
        currency=currency,
    )

    # Normalize reply text
    reply_text = result.get("reply", "")
    if isinstance(reply_text, dict):
        reply_text = reply_text.get("text") or reply_text.get("reply") or ""
    result["reply"] = str(reply_text) if reply_text else ""

    intent = result.get("intent", "PRODUCT_INQUIRY")

    # Handle START_ORDER: clear old order items
    if intent == "START_ORDER":
        profile.setdefault("current_order", {})["items"] = []
        profile["current_order"]["total_price"] = 0
        profile.setdefault("dynamics", {})["order_state"] = "COLLECTING"
        print(f"🧹 Cleared old order — starting fresh", flush=True)

    # Phone extraction from AI reply
    _extract_phone_from_reply(result.get("reply", ""), profile)

    total_tokens = result.get("prompt_tokens", 0) + result.get("candidate_tokens", 0)
    print(f"⏱️  Unified Agent: {(time.time() - t_start):.2f}s | intent={intent} | tokens={total_tokens}", flush=True)

    return result


def _extract_phone_from_reply(reply_text: str, profile: dict) -> None:
    """Auto-extract phone number from AI-generated reply."""
    import re
    if not reply_text:
        return
    match = re.search(r'(09\d{7,10}|\+?959\d{7,9})', reply_text)
    if match:
        phone = match.group(1)
        current = profile.get("identification", {}).get("phone", "")
        if phone != current:
            profile.setdefault("identification", {})["phone"] = phone
            print(f"📱 Phone from AI reply: {phone}", flush=True)
