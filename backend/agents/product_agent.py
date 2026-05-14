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
        "🚫 CRITICAL: NEVER make up products. ONLY describe items that exist in [DATABASE INFO] above.\n"
        "   If customer asks about 'Smart Switch', 'Smart Bulb', or any product NOT in the list:\n"
        "   → Reply: 'ဒီပစ္စည်းကို ကျွန်မတို့ဆိုင်မှာ လက်ရှိမရှိသေးပါဘူးရှင့်။ တခြားပစ္စည်းတွေ ကြည့်ချင်ပါသလား။'\n"
        "   → DO NOT describe the product. DO NOT make up prices. DO NOT use your own knowledge.\n"
        "   → Set intent=OUT_OF_DOMAIN, is_complex=false\n"
        "🚫 CRITICAL: ALL prices, descriptions, features MUST come from [DATABASE INFO].\n"
        "   If [DATABASE INFO] doesn't have it → you DON'T have it. Period.\n"
        "⚠️ RULE #1: Match products by name/brand. Minor typos OK ('smart buld' → 'Smart Bulb').\n"
        "   Only match if the product EXISTS in [DATABASE INFO].\n"
        "⚠️ RULE #2: If customer sends a photo/image — try to identify it.\n"
        "   If the photo matches a product → describe it and offer to order.\n"
        "   If the photo does NOT match any product → say 'ဒီပုံက ကျွန်မတို့ဆိုင်က ပစ္စည်းနဲ့ မတူပါဘူးရှင့်။'\n"
        "   Do NOT show random products for unrelated photos.\n"
        "⚠️ RULE #3: Vague queries like 'this one', 'it available?' with no product name →\n"
        "   ask politely: 'ဘယ်ပစ္စည်းလဲရှင့်? နာမည်လေး ပြောပေးပါဦး။'\n"
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
