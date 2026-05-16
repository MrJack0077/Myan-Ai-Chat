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

    # ⚡ Auto-extract items from database before AI call (keyword-based)
    _auto_extract_items(user_msg, tool_info, profile)

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

    # ── Guard: handle None result ──
    if result is None:
        print(f"⚠️ AI returned None — using fallback", flush=True)
        result = {"intent": "PRODUCT_INQUIRY", "reply": "ခဏစောင့်ပေးပါရှင့်။", "is_complex": False, "extracted": {}, "prompt_tokens": 0, "candidate_tokens": 0}

    # ── Post-AI processing ──
    reply_text = result.get("reply", "")
    if isinstance(reply_text, dict):
        reply_text = reply_text.get("text") or reply_text.get("reply") or ""
    result["reply"] = str(reply_text) if reply_text else ""

    intent = result.get("intent", "PRODUCT_INQUIRY")
    extracted = result.get("extracted", {})

    # ⚡ Phase 1: Professional Order Data Extraction — keyword-based backup
    if not extracted or not any([extracted.get("name"), extracted.get("phone"), extracted.get("items")]):
        from orders.extractor import extract_order_data
        kw_data = extract_order_data(user_msg)
        if kw_data.get("name"):
            extracted["name"] = kw_data["name"]
            profile.setdefault("identification", {})["name"] = kw_data["name"]
        if kw_data.get("phone"):
            extracted["phone"] = kw_data["phone"]
            profile.setdefault("identification", {})["phone"] = kw_data["phone"]
        if kw_data.get("address"):
            extracted["address"] = kw_data["address"]
            profile.setdefault("identification", {})["address"] = kw_data["address"]
        if kw_data.get("items"):
            extracted["items"] = kw_data["items"]
            existing = profile.setdefault("current_order", {}).setdefault("items", [])
            for item in kw_data["items"]:
                if item not in existing:
                    existing.append(item)
        if kw_data.get("payment_method"):
            extracted["payment_method"] = kw_data["payment_method"]
            profile.setdefault("current_order", {})["payment_method"] = kw_data["payment_method"]
        
        if any([kw_data.get("name"), kw_data.get("phone"), kw_data.get("items")]):
            import asyncio as _aio
            from customers.profile import save_profile as _sp
            _aio.create_task(_sp(shop_doc_id, user_id, profile))
            print(f"🔑 Keyword extraction saved: {kw_data}", flush=True)

    # ⚡ Auto-extract items from database if not already present
    if not extracted.get("items") or (order_state in ("COLLECTING",) and not profile.get("current_order", {}).get("items")):
        _auto_extract_items(user_msg, tool_info, profile)
        if profile.get("current_order", {}).get("items"):
            result.setdefault("extracted", {})["items"] = profile["current_order"]["items"]
            print(f"📦 Auto-items: {profile['current_order']['items']}", flush=True)

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


def _auto_extract_items(text: str, tool_info: str, profile: dict) -> None:
    """Auto-extract product items from message by matching against database products."""
    if not text or not tool_info or tool_info == "No products in database.":
        return
    
    import re
    text_lower = text.lower()
    
    # Extract product names from tool_info (format: "- Name | Price | Status: ... | Keywords: ...")
    product_names = re.findall(r'- ([A-Za-z0-9\s\-\+]+?) \|', tool_info)
    
    matched = []
    for name in product_names:
        name_clean = name.strip()
        if len(name_clean) < 3:
            continue
        # Check if product name appears in user message (fuzzy match)
        name_words = name_clean.lower().split()
        # Match if at least 2 words of the product name appear in the user message
        match_count = sum(1 for w in name_words if w in text_lower)
        if match_count >= 2 or name_clean.lower() in text_lower:
            # Clean the name (remove leading symbols/emojis)
            clean_name = re.sub(r'^[^\w\s]+', '', name_clean).strip()
            matched.append(clean_name)
    
    if matched:
        # Save to current_order.items if in order flow
        profile.setdefault("current_order", {}).setdefault("items", [])
        for item in matched:
            if item not in profile["current_order"]["items"]:
                profile["current_order"]["items"].append(item)
                print(f"📦 Auto-added to order: {item}", flush=True)


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

    # Also check if phone was in the reply text directly (customer said it earlier)
    # This helps when profile has old phone that customer is updating
    phone_match = re.search(r'(?:phone|ဖုန်း|ဖွန်း|09)\s*[:=]?\s*(\d{7,11})', reply_text, re.IGNORECASE)
    if phone_match and not profile.get("identification", {}).get("phone"):
        profile.setdefault("identification", {})["phone"] = "09" + phone_match.group(1) if not phone_match.group(1).startswith("09") else phone_match.group(1)
        print(f"📱 Phone extracted from context: {profile['identification']['phone']}", flush=True)
