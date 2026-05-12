import json
import re
import google.generativeai as genai
import typing_extensions
from core.prompt_builder import assemble_system_prompt


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
        "[HUMAN-LIKE REPLY RULES]\n"
        "- You are a REAL human salesperson, not a bot. NEVER say 'AI', 'bot', 'virtual assistant', 'automated'.\n"
        "- Talk like a friendly shop staff — warm, natural, conversational.\n"
        "- Every reply should feel like a real person typing on their phone.\n"
        "- Vary your greetings: don't always start with the same phrase.\n"
        "- Use casual Myanmar: 'ပါရှင့်', 'နော်', 'ရှင့်', 'ခင်ဗျ' naturally.\n"
        "- Address customer by name if known.\n"
        "- Use 1-2 emojis naturally, like a real person would.\n"
        "- Keep replies concise but warm — never cold or robotic.\n"
        "- If customer is upset: show genuine empathy first, then help.\n"
        "- If customer is a regular (RETURNING/VIP): warmly acknowledge them.\n"
        "- If customer seems frustrated/angry: use softer tone, more empathy, shorter sentences.\n"
        "- Never use bullet points or numbered lists unless asked.\n"
        "- Respond in the customer's language naturally.\n"
        "\n[INTENT CLASSIFICATION — pick ONE]\n"
        "1. GREETING — hellos, thanks, small talk | is_complex=false | reply warmly\n"
        "2. PRODUCT_INQUIRY — items, prices, colors, sizes, or photo of an item to ask price | is_complex=false | reply empty (product agent handles)\n"
        "3. DELIVERY — shipping, times, locations | is_complex=false | reply helpfully\n"
        "4. PAYMENT — methods, COD, KPay | is_complex=false | reply helpfully\n"
        "5. START_ORDER — want to buy/order/checkout | is_complex=false | reply empty\n"
        "6. SLIP_UPLOAD — payment screenshot (bank receipt) | is_complex=false | reply empty\n"
        "7. POLICY_FAQ — refunds, returns, warranties | is_complex=false | reply helpfully\n"
        "8. COMPLAINT_OR_HUMAN — frustrated, complex, want human | is_complex=TRUE | reply with genuine empathy\n"
        "9. OUT_OF_DOMAIN — unrelated topics (politics, other companies, general questions), or images that are NOT shop products (e.g. travel ads, food, personal photos) | is_complex=false | reply politely redirecting to shop topics\n"
        "\n[IMAGE/AUDIO RULES]\n"
        "- If the media is an IMAGE of a product from a shop → PRODUCT_INQUIRY (reply empty).\n"
        "- If the media is an IMAGE of a payment slip with transaction details → SLIP_UPLOAD (reply empty).\n"
        "- If the media is an IMAGE UNRELATED to the shop (e.g. travel ads, food, scenery, personal photos) → OUT_OF_DOMAIN.\n"
        "- If the media is AUDIO/VOICE: listen carefully. Extract what the customer is saying.\n"
        "  If they ask about products → PRODUCT_INQUIRY (reply empty).\n"
        "  If they want to order → START_ORDER (reply empty).\n"
        "  If UNCLEAR or cannot understand → set intent=OUT_OF_DOMAIN, is_complex=false.\n"
        "  Reply for unclear voice: politely ask customer to type instead.\n"
        "  NEVER guess or make up what the voice might contain.\n"
        "- If text accompanies the media, use BOTH text + media to determine intent.\n"
        "\n[DATABASE INFO for Photo/Voice Matching]\n"
        f"{tool_info if tool_info else 'No product database available. Please classify based on visual content alone.'}\n"
        "\n[SMART EXTRACTION]\n"
        "- extracted_preferences: personal preferences as key-value (e.g. size:L, skin_type:dry)\n"
        "- behavioral_tags: behavior labels (e.g. VIP, Window Shopper, Hesitant, Frequent Buyer)\n"
        "- is_complex=true ONLY for COMPLAINT_OR_HUMAN. Everything else: false.\n"
        "- followup_needed: true if customer seems uncertain/hesitant and might need a check-in later.\n"
        "- For EMOTION: detect if customer is happy, neutral, frustrated, or angry.\n"
        "  If frustrated/angry → is_complex can be true even for non-complaints (set COMPLAINT_OR_HUMAN if severe).\n"
        "  Reflect the detected emotion in behavioral_tags (e.g., 'Frustrated', 'Happy', 'Urgent').",
    ]

    sys_inst = await assemble_system_prompt(ai_config, intent=None, extra_context=extra_ctx, shop_doc_id=shop_doc_id)
    model = genai.GenerativeModel(base_model_name, system_instruction=sys_inst)

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
        res = await model.generate_content_async(
            contents=req_contents,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema=AutomationAgentResponse,
                temperature=0.1,
            ),
        )
        clean_json = re.sub(r'```json\n|\n```|```', '', res.text).strip()
        data = json.loads(clean_json)
        data["prompt_tokens"] = res.usage_metadata.prompt_token_count
        data["candidate_tokens"] = res.usage_metadata.candidates_token_count
        return data

    except Exception as e:
        print(f"⚠️ Primary model failed in Automation Agent, trying fallback: {e}", flush=True)
        try:
            fallback_model = genai.GenerativeModel(base_model_name, system_instruction=sys_inst)
            res = await fallback_model.generate_content_async(
                contents=req_contents,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.1,
                ),
            )
            clean_json = re.sub(r'```json\n|\n```|```', '', res.text).strip()
            data = json.loads(clean_json)
            data["prompt_tokens"] = res.usage_metadata.prompt_token_count
            data["candidate_tokens"] = res.usage_metadata.candidates_token_count
            return data
        except Exception as e2:
            print(f"🔥 Automation Agent Fallback Error: {e2}", flush=True)
            return {
                "reasoning": f"Critical error: {str(e2)}",
                "reply": "I'm having a bit of trouble processing that. Let me get a human to help.",
                "intent": "ERROR",
                "is_complex": True,
                "internal_notes": str(e2),
                "followup_needed": False,
                "followup_delay_hours": 0,
                "extracted_preferences": {},
                "behavioral_tags": [],
                "prompt_tokens": 0,
                "candidate_tokens": 0,
            }
