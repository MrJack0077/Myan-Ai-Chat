import json
import time
import re
import typing_extensions
from .base import call_agent_model, merge_tokens, make_fallback_response
from core.prompt_builder import assemble_system_prompt, build_user_prompt


def validate_order_data(extracted: dict) -> list[str]:
    """Validate extracted order fields. Returns list of issues (empty = valid)."""
    issues = []
    name = (extracted.get("name") or "").strip()
    phone = (extracted.get("phone") or "").strip()
    address = (extracted.get("address") or "").strip()
    
    if name and len(name) < 2:
        issues.append(f"name too short: '{name}'")
    if phone:
        # Myanmar phone: 09/+959, 9-11 digits
        clean = re.sub(r'[\s\-\(\)]', '', phone)
        if not re.match(r'^(09|\+?959)\d{7,9}$', clean):
            issues.append(f"invalid phone: '{phone}'")
    if address and len(address) < 5:
        issues.append(f"address too short: '{address}'")
    
    return issues


class ExtractedOrderData(typing_extensions.TypedDict, total=False):
    name: str
    phone: str
    address: str
    payment_method: str
    items: list[str]
    deli_charge: int
    total_price: int
    images: list[str]
    buttons: list[str]


class OrderAgentResponse(typing_extensions.TypedDict):
    is_complex: bool
    intent: str
    extracted: ExtractedOrderData
    reply: str
    prompt_tokens: int
    candidate_tokens: int


async def run_order_agent(user_msg, profile, ai_cfg, base_model_name, chat_history, delivery_info, payment_info, tool_info, currency, policies, media_parts=None, shop_doc_id=None):
    payment_methods = ", ".join(p.get('type', 'Unknown') for p in payment_info) if payment_info else "Cash"

    ident = profile.get("identification", {})
    dynamics = profile.get("dynamics", {})
    curr = profile.get("current_order", {})

    extra_ctx = [
        f"[PRODUCT PRICES]\n{tool_info}",
        f"[CURRENCY] {currency}",
        f"[AVAILABLE PAYMENTS] {payment_methods}, Cash on Delivery",
        f"[PROFILE]\n"
        f"Name={ident.get('name')} | Phone={ident.get('phone')} | Address={curr.get('address')}\n"
        f"Payment={curr.get('payment_method')} | Items={', '.join(curr.get('items', []))}\n"
        f"Deli={curr.get('deli_charge', 0)} {currency} | Total={curr.get('total_price', 0)} {currency}\n"
        f"OrderState={dynamics.get('order_state', 'NONE')} | Slip={'Yes' if curr.get('payment_slip_url') else 'No'}",
        "[ORDER FLOW]\n"
        "🚫 CRITICAL: ONLY use products from [PRODUCT PRICES] above. Never make up items or prices.\n"
        "🚫 CRITICAL: Never make up product details. If not in [PRODUCT PRICES] → it doesn't exist.\n"
        "🚫 You are a shop ordering bot. Never say your personal name or make up identities.\n"
        "   If customer asks about a product NOT in the list → say it's not available.\n"
        "1. Look at images — if payment slip, recognize as proof of payment.\n"
        "2. Confirm known info instead of re-asking (Name/Phone/Address).\n"
        "3. Ask missing info naturally one at a time: name → phone → address → payment.\n"
        f"4. Suggest ONLY: {payment_methods}, Cash on Delivery.\n"
        f"5. Calculate total = sum items + deli_charge. Currency: {currency}.\n"
        "6. If digital payment & no slip → give account info, ask for slip.\n"
        "7. User confirms → intent=ORDER_CONFIRMED, is_complex=true.\n"
        "8. If question unrelated to ordering → answer from [PRODUCT PRICES], keep intent=COLLECTING.\n"
        "9. Use buttons for quick choices. Validate Myanmar phone format.\n"
        "10. Be warm and human like a real shop assistant.",
    ]

    shop_context = {
        "policies": policies,
        "delivery_info": delivery_info,
        "payment_info": payment_info
    }

    sys_inst = await assemble_system_prompt(ai_cfg, intent="ORDER", extra_context=extra_ctx, shop_context=shop_context, shop_doc_id=shop_doc_id)
    user_prompt = build_user_prompt(user_msg, profile, chat_history, tool_info)
    
    contents = []
    if media_parts:
        contents.extend(media_parts)
    contents.append(user_prompt)

    try:
        t_ai = time.time()
        data, tokens = await call_agent_model(
            base_model_name, sys_inst,
            contents=contents,
            response_schema=OrderAgentResponse,
            temperature=0.1,            shop_doc_id=shop_doc_id,        )
        print(f"⏱️  Order Agent AI: {(time.time()-t_ai):.2f}s | prompt={tokens.get('prompt_tokens',0)} tokens", flush=True)
        # Validate extracted data
        issues = validate_order_data(data.get("extracted", {}))
        if issues:
            print(f"⚠️ Order validation warnings: {', '.join(issues)}", flush=True)
        return merge_tokens(data, tokens)
    except Exception as e:
        print(f"🔥 Order Agent Error: {e}")
        return make_fallback_response(ai_cfg.get('fallbackMessage', 'Connecting to human agent...'))
