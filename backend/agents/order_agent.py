import json
import typing_extensions
from .base import call_agent_model, merge_tokens, make_fallback_response
from core.prompt_builder import assemble_system_prompt, build_user_prompt


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
        "1. IMAGE: If user sends an image, look at it. If it's a payment slip/screenshot, and OrderState is WAITING_FOR_SLIP or SUMMARY_SENT, recognize it as proof of payment.\n"
        "2. Context memory: if you already know Name/Phone/Address, confirm instead of re-asking.\n"
        "3. Ask missing info one at a time naturally: name → phone → address → payment.\n"
        "   Like a real person: 'နာမည်လေးပြောပေးပါဦးရှင့်' not robotic forms.\n"
        "4. Match address to [DELIVERY INFO], extract exact deli_charge.\n"
        f"5. Suggest ONLY: {payment_methods}, Cash on Delivery.\n"
        f"6. Calculate total_price = sum(item prices) + deli_charge. Currency: {currency}.\n"
        "7. If digital payment & no slip yet → give account info naturally, ask for slip, intent=WAITING_FOR_SLIP.\n"
        "8. Once slip received (via IMAGE) → thank warmly, show summary, ask confirm, intent=SUMMARY_SENT.\n"
        "9. User confirms → intent=ORDER_CONFIRMED, is_complex=true.\n"
        "10. If the user asks a question unrelated to ordering (e.g. product specs, details), ANSWER it briefly using [PRODUCT PRICES] and keep intent=COLLECTING. DO NOT set intent=ORDER_CONFIRMED.\n"
        "11. Use extracted.buttons for quick choices (payment options, Confirm/Edit).\n"
        "12. Validate: Myanmar phone (09/+959, 9-11 digits), complete address.\n"
        "13. Be warm and human. Confirm details like a real shop assistant: 'အော်ဒါလေး confirm လုပ်လိုက်တော့မလားရှင့်' not robotic forms.",
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
        data, tokens = await call_agent_model(
            base_model_name, sys_inst,
            contents=contents,
            response_schema=OrderAgentResponse,
            temperature=0.1,
        )
        return merge_tokens(data, tokens)
    except Exception as e:
        print(f"🔥 Order Agent Error: {e}")
        return make_fallback_response(ai_cfg.get('fallbackMessage', 'Connecting to human agent...'))
