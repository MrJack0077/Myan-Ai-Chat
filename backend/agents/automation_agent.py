import json, re, asyncio
import google.generativeai as genai
from datetime import datetime, timezone
import typing

class AutomationRule(typing.TypedDict):
    id: str
    name: str
    trigger_intent: str
    action_type: str # REPLY, HANDOVER, LABEL, FOLLOWUP
    action_payload: dict
    is_active: bool

class AutomationAgentResponse(typing.TypedDict):
    reasoning: str
    reply: str
    intent: str
    is_complex: bool
    internal_notes: str
    followup_needed: bool
    followup_delay_hours: int
    extracted_preferences: dict
    behavioral_tags: list[str]

async def run_automation_agent(user_msg, media_parts, chat_history, profile, ai_config, shop_info, base_model_name):
    """
    Enterprise-level Automation Agent.
    Handles multi-modal input and complex state transitions.
    """
    lang = ai_config.get('responseLanguage', 'Myanmar')
    tone = ai_config.get('tone', 'professional')
    bot_name = ai_config.get('botName', 'AI Assistant')
    personality = ai_config.get('personality', 'Helpful, polite, and professional.')
    
    # Custom Automation Rules from AI Config - Only active ones
    automation_rules = [r for r in ai_config.get('automationRules', []) if r.get('is_active', True)]
    rules_str = json.dumps(automation_rules, indent=2) if automation_rules else "No custom rules defined."

    sys_inst = f"""
    Identity: You are the {bot_name} Automation Engine.
    Role: Manage customer interactions at an enterprise level.
    Language: ALWAYS respond in {lang}.
    Tone: {tone}.
    Personality: {personality}

    [CONTEXT]
    Customer Name: {profile.get('name', 'Unknown')}
    Order State: {profile.get('order_state', 'NONE')}
    Segment: {profile.get('segment', 'NEW')}
    Summary: {profile.get('summary', 'No summary.')}

    [AUTOMATION RULES]
    {rules_str}

    [CORE CAPABILITIES]
    1. Multi-modal: You can see images (slips, products) and hear voice messages (transcribed).
    2. State Management: Guide the user through the sales funnel (Inquiry -> Order -> Payment -> Confirmation).
    3. Proactive: If a user seems hesitant, offer help or a small discount if allowed by policies.
    4. Enterprise Quality: Your responses must be helpful, accurate, and never robotic.

    [TASK - INTENT CLASSIFICATION]
    Analyze the user's message (and any media) and the chat history. You MUST classify the message into one of the following 9 intents:
    
    1. GREETING: Simple hellos, thanks, or small talk. (Provide a polite 'reply', is_complex=false)
    2. PRODUCT_INQUIRY: Asking about items, prices, colors, sizes. (Set intent='PRODUCT_INQUIRY', is_complex=false)
    3. DELIVERY: Asking about shipping fees, delivery times, locations. (Provide a 'reply' based on policies, intent='DELIVERY', is_complex=false)
    4. PAYMENT: Asking about payment methods, COD, KPay. (Provide a 'reply' based on policies, intent='PAYMENT', is_complex=false)
    5. START_ORDER: Explicitly stating they want to buy, order, or checkout. (Set intent='START_ORDER', is_complex=false)
    6. SLIP_UPLOAD: Uploading a payment screenshot. (Set intent='SLIP_UPLOAD', is_complex=false)
    7. POLICY_FAQ: Asking about refunds, returns, warranties. (Provide a 'reply', intent='POLICY_FAQ', is_complex=false)
    8. COMPLAINT_OR_HUMAN: Frustrated user, complex issue, or explicitly asking for a human/admin. (Set intent='COMPLAINT_OR_HUMAN', is_complex=true)
    9. OUT_OF_DOMAIN: Asking about weather, politics, or unrelated topics. (Politely decline in 'reply', intent='OUT_OF_DOMAIN', is_complex=false)
    
    [TASK - SMART EXTRACTION]
    1. extracted_preferences: If the user mentions personal preferences (e.g., "I wear size L", "I have dry skin", "I like red"), extract them as key-value pairs (e.g., {"size": "L", "skin_type": "dry"}).
    2. behavioral_tags: Observe the user's behavior and assign relevant tags (e.g., ["VIP", "Window Shopper", "Hesitant", "Frequent Buyer"]).
    
    [CRITICAL]
    'is_complex' = true will IMMEDIATELY hand over the chat to a human. Only use this for COMPLAINT_OR_HUMAN.
    For product questions or orders, ALWAYS set 'is_complex' to false.
    
    [OUTPUT FORMAT]
    You must return a JSON object matching the AutomationAgentResponse schema.
    """

    model = genai.GenerativeModel(base_model_name, system_instruction=sys_inst)
    
    # Prepare contents
    req_contents = []
    
    # Add chat history as context if available
    if chat_history:
        req_contents.append(f"Recent Chat History for Context:\n{chat_history}\n---\n")
    
    # Add media parts (images/audio)
    if media_parts:
        for part in media_parts:
            # Ensure part is in correct format for SDK
            if isinstance(part, dict) and "mime_type" in part and "data" in part:
                req_contents.append(part)
    
    # Add user message
    user_input = user_msg if user_msg else "Customer sent an attachment or voice message."
    req_contents.append(f"Current User Input: {user_input}")

    try:
        res = await model.generate_content_async(
            contents=req_contents,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema=AutomationAgentResponse,
                temperature=0.1
            )
        )
        
        # Clean response text in case of markdown blocks
        clean_json = re.sub(r'```json\n|\n```|```', '', res.text).strip()
        data = json.loads(clean_json)
        
        data["prompt_tokens"] = res.usage_metadata.prompt_token_count
        data["candidate_tokens"] = res.usage_metadata.candidates_token_count
        return data
    except Exception as e:
        print(f"🔥 Automation Agent Error: {e}")
        # Fallback to a simpler prompt if schema-based generation fails
        try:
            fallback_res = await model.generate_content_async(
                contents=req_contents + ["\nReturn JSON only."],
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.3
                )
            )
            clean_json = re.sub(r'```json\n|\n```|```', '', fallback_res.text).strip()
            data = json.loads(clean_json)
            data["prompt_tokens"] = fallback_res.usage_metadata.prompt_token_count
            data["candidate_tokens"] = fallback_res.usage_metadata.candidates_token_count
            return data
        except:
            return {
                "reasoning": f"Critical error: {str(e)}",
                "reply": "I'm having a bit of trouble processing that. Let me get a human to help.",
                "intent": "ERROR",
                "is_complex": True,
                "internal_notes": str(e),
                "followup_needed": False,
                "followup_delay_hours": 0,
                "extracted_preferences": {},
                "behavioral_tags": [],
                "prompt_tokens": 0,
                "candidate_tokens": 0
            }
