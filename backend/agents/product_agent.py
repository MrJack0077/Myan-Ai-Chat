import typing_extensions
from .base import call_agent_model, merge_tokens, make_fallback_response
from core.prompt_builder import assemble_system_prompt, build_user_prompt


class ExtractedProductData(typing_extensions.TypedDict, total=False):
    name: str
    phone: str
    address: str
    items: list[str]
    payment_method: str
    total_price: int
    images: list[str]
    buttons: list[str]


class ProductAgentResponse(typing_extensions.TypedDict):
    reasoning: str
    is_complex: bool
    intent: str
    extracted: ExtractedProductData
    reply: str
    prompt_tokens: int
    candidate_tokens: int


async def run_product_agent(user_msg, tool_info, ai_cfg, policies, profile, base_model_name, chat_history, past_purchases=None, delivery_info=None, payment_info=None, media_parts=None, shop_doc_id=None):
    if past_purchases is None:
        past_purchases = []

    constraints = ai_cfg.get('constraints', [])
    constraints_str = "\n".join(f"- {c}" for c in constraints) if constraints else "- No special constraints."

    extra_ctx = [
        f"[STRICT CONSTRAINTS]\n{constraints_str}",
        f"[DATABASE INFO]\n{tool_info}",
        f"[PAST PURCHASES]\nPast Purchases: {past_purchases if past_purchases else 'None'}",
        "[AGENT RULES — FOLLOW STRICTLY]\n"
        "⚠️ RULE #1: DO NOT show products unless the customer's request CLEARLY matches.\n"
        "   If customer sends a photo of something NOT in [DATABASE INFO]:\n"
        "   → Reply: 'ဒီပစ္စည်းကို ကျွန်မတို့ဆိုင်မှာ မတွေ့ပါဘူးရှင့်။ တခြားပစ္စည်းတွေ ကြည့်ချင်ပါသလား။'\n"
        "   → Set is_complex=false, intent=OUT_OF_DOMAIN\n"
        "   → Do NOT guess, do NOT show random products, do NOT hallucinate.\n"
        "⚠️ RULE #2: Only describe a product if the customer's words CLEARLY match an item by name/brand/category.\n"
        "   Vague queries like 'this product', 'this one', 'available?' → ask for clarification.\n"
        "   Do NOT assume which product they mean. Ask: 'ဘယ်ပစ္စည်းလဲရှင့်? နာမည်လေး ပြောပေးပါဦး။'\n"
        "⚠️ RULE #3: If unsure → set is_complex=true. Better to escalate than give wrong info.\n"
        "- IMAGE: Only identify the product if it CLEARLY matches an item in [DATABASE INFO].\n"
        "- STRICTLY use [DATABASE INFO] for prices, availability, and descriptions.\n"
        "- If user asks about a product, EXPLAIN the product details naturally — like a real shop assistant, not a catalog reader.\n"
        "- Talk like a human: 'ဒီအင်္ကျီလေးက ၂၅၀၀၀ပါရှင့်။ အရောင်လေးတွေလည်း အနီ၊အပြာရှိလို့ ကြိုက်တာလေးပြောပေးပါနော်။'\n"
        "- OUT OF STOCK → apologize warmly + suggest closest alternative with enthusiasm.\n"
        "- PROACTIVE SUGGESTION: After describing a product, subtly mention 1-2 related items.\n"
        "  Example: 'ဒီအင်္ကျီနဲ့လိုက်မယ့် ဘောင်းဘီလေးလည်းရှိပါတယ်နော်။'\n"
        "  Only if [DATABASE INFO] shows related products. Don't make up items.\n"
        "- If user EXPLICITLY wants to buy right now → set intent=START_ORDER.\n"
        "  Generate a warm natural transition into order taking, e.g. 'ဟုတ်ကဲ့ရှင့်။ အော်ဒါတင်ဖို့ နာမည်လေးပြောပေးပါဦးရှင့်။'\n"
        "- If user says hello/hi → intent=MAIN_MENU, short warm welcome.\n"
        "- Extract product image URLs into extracted.images (max 3).\n"
        "- Offer quick choices in extracted.buttons (max 3).\n"
        "- If you CANNOT find the product or answer the question based on database info → set is_complex=true.\n"
        "- Misspelled items → match closest in database.\n"
        "- NEVER sound like a robot or AI. You are a real shop staff member.",
    ]

    shop_context = {
        "policies": policies,
        "delivery_info": delivery_info,
        "payment_info": payment_info
    }

    sys_inst = await assemble_system_prompt(ai_cfg, intent="PRODUCT_INQUIRY", extra_context=extra_ctx, shop_context=shop_context, shop_doc_id=shop_doc_id)
    user_prompt = build_user_prompt(user_msg, profile, chat_history, tool_info)
    
    contents = []
    if media_parts:
        contents.extend(media_parts)
    contents.append(user_prompt)

    try:
        data, tokens = await call_agent_model(
            base_model_name, sys_inst,
            contents=contents,
            response_schema=ProductAgentResponse,
            temperature=0.2,
        )
        return merge_tokens(data, tokens)
    except Exception as e:
        print(f"🔥 Product Agent Error: {e}")
        return make_fallback_response(ai_cfg.get('fallbackMessage', 'Connecting to human agent...'))
