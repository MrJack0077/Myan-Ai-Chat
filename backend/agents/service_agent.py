import typing_extensions
from .base import call_agent_model, merge_tokens, make_fallback_response
from core.prompt_builder import assemble_system_prompt, build_user_prompt


class ExtractedServiceData(typing_extensions.TypedDict):
    name: str
    phone: str
    service_type: str
    appointment_time: str
    total_price: int


class ServiceAgentResponse(typing_extensions.TypedDict):
    is_complex: bool
    intent: str
    extracted: ExtractedServiceData
    reply: str
    prompt_tokens: int
    candidate_tokens: int


async def run_service_agent(user_msg, tool_info, ai_cfg, policies, profile, base_model_name, chat_history="", shop_doc_id=None, media_parts=None):
    ident = profile.get("identification", {})
    dynamics = profile.get("dynamics", {})
    sales = profile.get("sales_data", {})
    insights = profile.get("ai_insights", {})

    extra_ctx = [
        f"[SERVICE INFO]\n{tool_info}",
        f"[SHOP POLICIES]\n{build_policies_str(policies)}",
        f"[USER STATE]\nState: {dynamics.get('order_state')} | Segment: {sales.get('segment', 'NEW')}",
        f"Known: Name={ident.get('name')} | Phone={ident.get('phone')} | Service={profile.get('service_type')}",
        "[AGENT RULES]\nCollect Name, Phone, Service Type, Appointment Time. No address. Validate Myanmar phone (09/+959, 9-11 digits). If all details given → is_complex=false.",
    ]

    # Build shop context for prompt caching
    shop_context = {
        "policies": policies,
    }

    sys_inst = await assemble_system_prompt(ai_cfg, intent="SERVICE", extra_context=extra_ctx, shop_context=shop_context, shop_doc_id=shop_doc_id)
    user_prompt = build_user_prompt(user_msg, profile)

    try:
        data, tokens = await call_agent_model(
            base_model_name, sys_inst,
            contents=user_prompt,
            response_schema=ServiceAgentResponse,
            temperature=0.2,
            shop_doc_id=shop_doc_id,
        )
        return merge_tokens(data, tokens)
    except Exception as e:
        print(f"🔥 Service Agent Error: {e}")
        return make_fallback_response(ai_cfg.get('fallbackMessage', 'Connecting to human agent...'))


def build_policies_str(policies):
    if not policies:
        return "- No active policies."
    return "\n".join(f"- {k.capitalize()}: {v}" for k, v in policies.items())
