import typing_extensions
from .base import call_agent_model, merge_tokens, make_fallback_response
from core.prompt_builder import assemble_system_prompt, build_user_prompt


class ExtractedMediaData(typing_extensions.TypedDict):
    """Media-specific extraction: recognized item names, detected intent, any text from image/voice."""
    recognized_items: list[str]
    detected_intent: str
    extracted_text: str
    images: list[str]
    buttons: list[str]


class MediaAgentResponse(typing_extensions.TypedDict):
    is_complex: bool
    intent: str
    extracted: ExtractedMediaData
    reply: str
    prompt_tokens: int
    candidate_tokens: int


async def run_media_agent(user_msg, tool_info, ai_cfg, policies, profile, base_model_name, chat_history, media_parts, delivery_info=None, payment_info=None, shop_doc_id=None):
    ident = profile.get("identification", {})
    dynamics = profile.get("dynamics", {})
    
    extra_ctx = [
        f"[DATABASE INFO]\n{tool_info}",
        f"[CUSTOMER STATE]\nName: {ident.get('name', '')} | OrderState: {dynamics.get('order_state', 'NONE')}",
        "[MEDIA RULES]\n"
        "- IMAGE (photo of product): Look carefully at the image. Identify what the customer sent.\n"
        "  Match against [DATABASE INFO]. If found → describe the item naturally (name, price, features).\n"
        "  If NOT in database → politely say 'ဒီပစ္စည်းကို ကျွန်မတို့ဆိုင်မှာ မတွေ့ပါဘူးရှင့်။ တခြားပစ္စည်းတွေကြည့်ချင်ပါသလား။'\n"
        "- IMAGE (payment slip/screenshot): Recognize bank transaction details.\n"
        "  If OrderState is WAITING_FOR_SLIP or SUMMARY_SENT → intent=SLIP_UPLOAD, is_complex=false.\n"
        "- IMAGE (unrelated — food, scenery, person, ad): Politely redirect to shop topics.\n"
        "  intent=OUT_OF_DOMAIN, reply='ဒါက ကျွန်မတို့ဆိုင်နဲ့ မဆိုင်တဲ့ပုံပါရှင့်။ ပစ္စည်းတွေအကြောင်း မေးချင်တာရှိရင် မေးပါနော်။'\n"
        "- VOICE/AUDIO: Listen carefully to the audio content. Extract customer's spoken words.\n"
        "  If the audio is in Myanmar/Burmese and you can understand → answer based on [DATABASE INFO].\n"
        "  If audio is unclear or in an unsupported language → reply warmly asking them to type instead.\n"
        "    Example: 'အသံကို နားမလည်နိုင်ပါဘူးရှင့်။ စာနဲ့ရေးပြီး မေးပေးပါလားရှင့်။'\n"
        "  CRITICAL: Do NOT guess or fabricate what the customer said. Only respond to what you clearly hear.\n"
        "- ALWAYS reply in the customer's language naturally, like a real shop assistant.",
    ]

    shop_context = {
        "policies": policies,
        "delivery_info": delivery_info,
        "payment_info": payment_info
    }

    sys_inst = await assemble_system_prompt(ai_cfg, intent="MEDIA", extra_context=extra_ctx, shop_context=shop_context, shop_doc_id=shop_doc_id)
    msg_text = f"Customer Message: {user_msg}" if user_msg else "Customer sent an attachment."
    contents = media_parts + [msg_text]

    try:
        data, tokens = await call_agent_model(
            base_model_name, sys_inst,
            contents=contents,
            response_schema=MediaAgentResponse,
            temperature=0.2,
        )
        return merge_tokens(data, tokens)
    except Exception as e:
        print(f"🔥 Media Agent Error: {e}")
        return make_fallback_response(ai_cfg.get('fallbackMessage', 'Connecting to human agent...'))
