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

class MediaAgentResponse(typing.TypedDict):
    is_complex: bool
    intent: str
    extracted: ExtractedProductData
    reply: str
    prompt_tokens: int
    candidate_tokens: int

async def run_media_agent(user_msg, tool_info, ai_cfg, policies, profile, base_model_name, chat_history, media_parts):
    lang = ai_cfg.get('responseLanguage', 'Myanmar')

    sys_inst = f"""
    Identity: You are {ai_cfg.get('botName', 'Assistant')}. 
    Personality: Polite, empathetic, and highly helpful.
    Tone: Conversational and natural. DO NOT sound like a robot. Keep responses short (max 2-3 sentences).
    Language: You MUST ALWAYS respond in {lang} language. Do not use any other language.

    [CUSTOMER PROFILE]
    Name: {profile.get('name', 'Unknown')}
    Segment: {profile.get('segment', 'NEW')}
    Summary: {profile.get('summary', 'No summary available.')}
    Order State: {profile.get('order_state', 'NONE')}
    Past Purchases: {profile.get('past_purchases', [])}

    [RECENT CHAT HISTORY]
    {chat_history}

    [DATABASE INFO]
    {tool_info}

    [RULES FOR MEDIA (VOICE/IMAGE)]
    1. 🚨 CONCISE & CONVERSATIONAL: Keep your response short (maximum 2-3 sentences). Use natural emojis. Never use robotic phrases.
    2. 🚨 IMAGE VERIFICATION: If the user uploaded an image, LOOK AT IT CAREFULLY. If it shows an item COMPLETELY UNRELATED to the [DATABASE INFO] (e.g., random electronics, unknown parts, unrelated objects), politely decline and state that the shop does not sell this item. DO NOT guess the product based on the chat history.
    3. 🎵 VOICE PROCESSING: If it's a voice message, listen to the user's intent carefully and respond based strictly on the [DATABASE INFO].
    4. CRITICAL: Always trust the [DATABASE INFO] for prices and availability.
    5. 🚨 EMPATHY: If the customer is frustrated or an item is unavailable, show empathy ("I'm so sorry about that...").
    6. 🚨 ORDER CONFIRMATION: If the user says "confirm" or "approve" (via voice or text) and the Order State is 'SUMMARY_SENT', set 'intent' to 'ORDER_CONFIRMED' and 'is_complex' to true.
    7. If the user provides clear order details, set 'is_complex' to false.
    """

    model = genai.GenerativeModel(base_model_name, system_instruction=sys_inst)
    try:
        msg_text = f"Customer Message: {user_msg}" if user_msg else "Customer sent an attachment."
        req_contents = media_parts + [msg_text]

        res = await model.generate_content_async(
            contents=req_contents,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema=MediaAgentResponse,
                temperature=0.2
            )
        )
    except Exception as e:
        print(f"⚠️ Primary model failed, trying fallback: {e}")
        fallback_model = genai.GenerativeModel("models/gemini-3.1-flash-lite-preview", system_instruction=sys_inst)
        res = await fallback_model.generate_content_async(
            contents=req_contents,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema=MediaAgentResponse,
                temperature=0.2
            )
        )
        
    try:
        clean_json = re.sub(r'```json\n|\n```|```', '', res.text).strip()
        data = json.loads(clean_json)
        data["prompt_tokens"] = res.usage_metadata.prompt_token_count
        data["candidate_tokens"] = res.usage_metadata.candidates_token_count
        return data
    except Exception as e:
        print(f"🔥 Media Agent Error: {e}")
        return {
            "is_complex": True,
            "intent": "OTHER",
            "extracted": {},
            "reply": ai_cfg.get('fallbackMessage', 'Connecting to human agent...'),
            "prompt_tokens": 0,
            "candidate_tokens": 0
        }
