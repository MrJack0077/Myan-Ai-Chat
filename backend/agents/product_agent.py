import json, re
import google.generativeai as genai
import typing

class ExtractedProductData(typing.TypedDict):
    name: str
    phone: str
    address: str
    items: list[str]
    payment_method: str
    total_price: int

class Button(typing.TypedDict):
    title: str
    value: str

class ProductAgentResponse(typing.TypedDict):
    reasoning: str
    is_complex: bool
    intent: str
    extracted: ExtractedProductData
    reply: str
    prompt_tokens: int
    candidate_tokens: int

async def run_product_agent(user_msg, tool_info, ai_cfg, policies, profile, base_model_name, chat_history, past_purchases=None):
    if past_purchases is None:
        past_purchases = []
    
    constraints_list = ai_cfg.get('constraints', [])
    constraints_str = "\n".join([f"- {c}" for c in constraints_list]) if constraints_list else "- No special constraints."

    policies_str = "\n".join([f"- {k.capitalize()}: {v}" for k, v in policies.items()]) if policies else "- No active policies."

    tone = ai_cfg.get('tone', 'professional')
    lang = ai_cfg.get('responseLanguage', 'Myanmar')

    corrections = ai_cfg.get('learningCenter', {}).get('corrections', [])
    kb = ai_cfg.get('knowledgeBase', [])

    extra_knowledge = ""
    if corrections or kb:
        extra_knowledge = "[CUSTOM KNOWLEDGE & PREVIOUS CORRECTIONS]\n"
        for c in corrections: extra_knowledge += f"- {c}\n"
        for k in kb: extra_knowledge += f"- {k}\n"

    sys_inst = f"""
    Identity: You are {ai_cfg.get('botName', 'a Customer Service Agent')}.
    Personality: {ai_cfg.get('personality', 'Polite, empathetic, and highly helpful')}.
    Tone: {tone}. Be conversational and natural. DO NOT sound like a robot.
    Language: You MUST ALWAYS respond in {lang} language. Do not use any other language.

    [SYSTEM PROMPT / CORE DIRECTIVE]
    {ai_cfg.get('systemPrompt', 'Assist the customer actively and professionally.')}

    [SHOP POLICIES & KNOWLEDGE]
    {policies_str}
    {extra_knowledge}

    [STRICT CONSTRAINTS]
    {constraints_str}

    [PAST PURCHASES & PROFILE]
    Name: {profile.get('name', 'Unknown')}
    Phone: {profile.get('phone', 'Unknown')}
    Address: {profile.get('address', 'Unknown')}
    Segment: {profile.get('segment', 'NEW')}
    Past Purchases: {past_purchases if past_purchases else 'No past purchases recorded.'}

    [RULES FOR BEST ANSWER & SALES (CRITICAL)]
    1. 🚨 CONCISE & CONVERSATIONAL: Keep your response short (maximum 2-3 sentences). Use natural emojis. Never use robotic phrases like "I am an AI".
    2. 🚨 CLARIFYING QUESTIONS: If the customer asks a vague question (e.g., "I want a shirt"), DO NOT list all shirts. Instead, ask a clarifying question like "What color or size are you looking for?".
    3. 🚨 CONTEXTUAL MEMORY: Use the [PAST PURCHASES & PROFILE] data. If they ask about delivery and you know their address, say "Should we deliver to [Address]?" instead of asking for it again.
    4. 🚨 PROACTIVE RECOMMENDATIONS & UPSELLING: If an item is "OUT OF STOCK", explicitly apologize and proactively suggest the closest available alternative from the [DATABASE INFO]. If they are buying something, naturally recommend a related accessory.
    5. 🚨 EMPATHY: If the customer is frustrated or an item is unavailable, show empathy ("I'm so sorry about that...").
    6. Base your answer STRICTLY on the [DATABASE INFO], [SHOP POLICIES], and [CUSTOM KNOWLEDGE].
    7. SPELLING MISTAKES: If the user misspells an item, intelligently match it with the closest sounding item in the [DATABASE INFO].
    8. 🚨 ORDER START DETECTOR: If the user explicitly wants to buy an item, MUST set 'intent' to "START_ORDER".
    9. 🚨 MAIN MENU: If the user says "hello", "hi", or seems to want to start a conversation, provide a welcoming message and set 'intent' to "MAIN_MENU".
    10. CRITICAL RULE: If the intent is START_ORDER, just set it and remain silent in the reply (let the main router handle it).
    11. 🚨 COMPLEX QUESTIONS: If the user asks a question you cannot answer based on [DATABASE INFO], or explicitly wants to talk to a human, set 'is_complex' to true.

    [CUSTOMER SUMMARY (Long-term Memory)]
    {profile.get('summary', 'No summary yet.')}

    [RECENT CHAT HISTORY (Short-term)]
    {chat_history}

    [DATABASE INFO (Top Matches)]
    {tool_info}
    """

    model = genai.GenerativeModel(base_model_name)
    try:
        res = await model.generate_content_async(
            contents=[sys_inst, f"Customer Message: {user_msg}\nAI:"],
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema=ProductAgentResponse,
                temperature=0.2
            )
        )
    except Exception as e:
        print(f"⚠️ Primary model failed, trying fallback: {e}")
        fallback_model = genai.GenerativeModel("models/gemini-3.1-flash-lite-preview")
        res = await fallback_model.generate_content_async(
            contents=[sys_inst, f"Customer Message: {user_msg}\nAI:"],
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema=ProductAgentResponse,
                temperature=0.2
            )
        )
    
    try:
        clean_json = re.sub(r'```json\n|\n```|```', '', res.text).strip()
        data = json.loads(clean_json)
        data["prompt_tokens"] = res.usage_metadata.prompt_token_count
        data["candidate_tokens"] = res.usage_metadata.candidates_token_count
        if isinstance(data, dict): return data
        return {"is_complex": True, "intent": "OTHER", "extracted": {}, "reply": ai_cfg.get('fallbackMessage', 'Connecting to human agent...'), "prompt_tokens": 0, "candidate_tokens": 0}
    except Exception as e:
        print(f"🔥 Product Agent Error: {e}")
        return {"is_complex": True, "intent": "OTHER", "extracted": {}, "reply": ai_cfg.get('fallbackMessage', 'Connecting to human agent...'), "prompt_tokens": 0, "candidate_tokens": 0}
