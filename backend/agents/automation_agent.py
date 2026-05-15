import json
import re
import typing_extensions
from core.prompt_builder import assemble_system_prompt
from agents.base import call_agent_model, merge_tokens


class AutomationRule(typing_extensions.TypedDict):
    id: str
    name: str
    trigger_intent: str
    action_type: str  # REPLY, HANDOVER, LABEL, FOLLOWUP
    action_payload: dict
    is_active: bool


class AutomationAgentResponse(typing_extensions.TypedDict):
    reasoning: str
    reply: str
    intent: str
    is_complex: bool
    internal_notes: str
    followup_needed: bool
    followup_delay_hours: int
    extracted_preferences: dict
    behavioral_tags: list[str]


async def run_automation_agent(user_msg, media_parts, chat_history, profile, ai_config, shop_info, base_model_name, shop_doc_id=None, tool_info=""):
    """Enterprise-level Automation Agent. Handles multi-modal input and complex state transitions."""

    automation_rules = [r for r in ai_config.get('automationRules', []) if r.get('is_active', True)]
    rules_str = json.dumps(automation_rules, indent=2) if automation_rules else "No custom rules defined."

    ident = profile.get("identification", {})
    dynamics = profile.get("dynamics", {})
    sales = profile.get("sales_data", {})
    insights = profile.get("ai_insights", {})

    extra_ctx = [
        f"[AUTOMATION RULES]\n{rules_str}",
        f"[CUSTOMER CONTEXT]\nIDENT: {ident.get('name', 'Unknown')} | STATE: {dynamics.get('order_state', 'NONE')} | SEGMENT: {sales.get('segment', 'NEW')} | SUMMARY: {insights.get('user_summary', 'None')}",
        "[REPLY RULES — condensed]\n"
        "HUMAN_MODE: Never say AI/bot/virtual/automated. Use ပါရှင့်/နော်/ရှင့်/ခင်ဗျ naturally.\n"
        "INTENT: GREETING|PRODUCT_INQUIRY|DELIVERY|PAYMENT|START_ORDER|SLIP_UPLOAD|POLICY_FAQ|COMPLAINT_OR_HUMAN|OUT_OF_DOMAIN\n"
        "GREETING→warm short reply | PRODUCT_INQ→reply empty | SLIP_UPLOAD→reply empty\n"
        "COMPLAINT→is_complex=TRUE, genuine empathy | OUT_OF_DOMAIN→polite redirect\n"
        "MEDIA: IMAGE=PRODUCT_INQUIRY(empty reply), IMAGE=SLIP→SLIP_UPLOAD, IMAGE=unrelated→OUT_OF_DOMAIN, AUDIO=extract intent\n"
        "EMOTIONS: angry→shorter+softer, VIP→warmer, new→informative\n"
        "PREFERENCES: extract to key-value (size:L, skin:dry), TAGS: behavior labels (VIP, Hesitant, Window Shopper)\n"
        "\n[DATABASE INFO for Photo/Voice Matching]\n"
        f"{tool_info if tool_info else 'No product database available. Please classify based on visual content alone.'}\n"
        "\n[SMART EXTRACTION]\n"
        "- extracted_preferences: personal preferences as key-value (e.g. size:L, skin_type:dry)\n"
        "- behavioral_tags: behavior labels (e.g. VIP, Window Shopper, Hesitant, Frequent Buyer)\n"
        "- is_complex=true ONLY for COMPLAINT_OR_HUMAN. Everything else: false.\n"
        "- followup_needed: true if customer seems uncertain/hesitant and might need a check-in later.",
    ]

    sys_inst = await assemble_system_prompt(ai_config, intent=None, extra_context=extra_ctx, shop_doc_id=shop_doc_id)

    req_contents = []
    if chat_history:
        req_contents.append(f"Recent Chat History:\n{chat_history}\n---\n")

    if media_parts:
        for part in media_parts:
            if isinstance(part, dict) and "mime_type" in part and "data" in part:
                req_contents.append(part)

    user_input = user_msg if user_msg else "Customer sent an attachment or voice message."
    req_contents.append(f"Current User Input: {user_input}")

    try:
        data, tokens = await call_agent_model(
            base_model_name, sys_inst,
            contents=req_contents,
            response_schema=AutomationAgentResponse,
            temperature=0.1,
            shop_doc_id=shop_doc_id,
        )
        data["prompt_tokens"] = tokens.get("prompt_tokens", 0)
        data["candidate_tokens"] = tokens.get("candidate_tokens", 0)
        return data

    except Exception as e:
        print(f"🔥 Automation Agent Error: {e}", flush=True)
        # Don't set intent=ERROR — that triggers unnecessary escalation.
        # Instead, let keyword classifier handle it. is_complex=False prevents escalation.
        return {
            "reasoning": f"Error: {str(e)}",
            "reply": "",
            "intent": "",  # ← Empty = let keyword classifier decide
            "is_complex": False,  # ← Don't escalate unless keyword says so
            "internal_notes": str(e),
            "followup_needed": False,
            "followup_delay_hours": 0,
            "extracted_preferences": {},
            "behavioral_tags": [],
            "prompt_tokens": 0,
            "candidate_tokens": 0,
        }
