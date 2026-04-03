import json, re
import google.generativeai as genai
import typing

class ExtractedOrderData(typing.TypedDict):
    name: str
    phone: str
    address: str
    payment_method: str
    items: list[str]
    deli_charge: int
    total_price: int

class Button(typing.TypedDict):
    title: str
    value: str

class OrderAgentResponse(typing.TypedDict):
    is_complex: bool
    intent: str
    extracted: ExtractedOrderData
    reply: str
    prompt_tokens: int
    candidate_tokens: int

async def run_order_agent(user_msg, profile, ai_cfg, base_model_name, chat_history, delivery_info, payment_info, tool_info, currency):
    lang = ai_cfg.get('responseLanguage', 'Myanmar')
    payment_methods_str = ", ".join([p.get('type', 'Unknown') for p in payment_info]) if payment_info else "Cash"

    sys_inst = f"""
    Identity: You are the Order Processing Assistant for {ai_cfg.get('botName', 'our shop')}.
    Personality: Polite, empathetic, and highly helpful.
    Tone: Conversational and natural. DO NOT sound like a robot. Keep responses short (max 2-3 sentences).
    Language: You MUST ALWAYS respond in {lang} language. Do not use any other language.

    [DELIVERY INFO (Database)]
    {json.dumps(delivery_info, ensure_ascii=False)}

    [PAYMENT INFO (Database)]
    {json.dumps(payment_info, ensure_ascii=False)}

    [PRODUCT PRICES (Database Tool Info)]
    {tool_info}

    [CURRENT PROFILE DATA]
    Name: {profile.get('name', '')} | Phone: {profile.get('phone', '')} | Address: {profile.get('address', '')}
    Segment: {profile.get('segment', 'NEW')}
    Summary: {profile.get('summary', 'No summary available.')}
    Payment: {profile.get('payment_method', '')} | Items: {', '.join(profile.get('items', []))}
    Deli Charge: {profile.get('deli_charge', 0)} {currency} | Total Price: {profile.get('total_price', 0)} {currency}
    Order State: {profile.get('order_state', 'NONE')}
    Slip Uploaded: {'Yes' if profile.get('payment_slip_url') else 'No'}
    Past Purchases: {profile.get('past_purchases', [])}

    [MISSION FLOW]
    1. 🚨 CONTEXTUAL MEMORY: If the user has ordered before (check Past Purchases or Profile Data) and you already know their Name, Phone, or Address, DO NOT ask them to type it again. Instead, ask "Should we deliver to [Address]?" or "Is your phone number still [Phone]?".
    2. 🚨 CONCISE & CONVERSATIONAL: Keep your response short (maximum 2-3 sentences). Use natural emojis. Never use robotic phrases.
    3. INFO COLLECTION: If items, name, phone, address, or payment_method is missing, ask for them directly (one at a time if possible).
       - For Address: Match the user's location with [DELIVERY INFO] and extract the exact `deli_charge`.
       - For Payment: Suggest ONLY the available payment methods: {payment_methods_str} and Cash on Delivery.
    4. PRICE CALCULATION: Sum up the prices of `items` based on [PRODUCT PRICES] and add `deli_charge`. Extract as `total_price`.
    5. SLIP COLLECTION: If the chosen payment method is a bank transfer or digital wallet (NOT Cash/COD), AND Slip Uploaded is 'No':
       - Provide the exact account name and number from [PAYMENT INFO] corresponding to their choice.
       - Tell them the Total Price is `total_price` {currency}.
       - Ask them to upload the payment screenshot (Transfer Slip).
       - Set intent to 'WAITING_FOR_SLIP'.
    6. SUMMARY: If ALL info is collected (and if transfer slip is needed, it IS uploaded; if Cash, no slip needed), show the Order Summary.
       - Include: Items, Address, Phone, Payment, Deli Charge, Total Price.
       - Ask the user to confirm the order.
       - Set intent to 'SUMMARY_SENT'.
    7. CONFIRMATION: If user confirms the order AND Order State is 'SUMMARY_SENT', set intent to 'ORDER_CONFIRMED' and 'is_complex' to true.
    8. EDIT: If user wants to edit, set intent to 'COLLECTING'.

    [RULES & EXAMPLES (CRITICAL)]
    - ALWAYS use the exact currency '{currency}' for all prices and totals. DO NOT use 'MMK' or 'Ks' automatically unless it matches the currency.
    - You MUST ALWAYS respond in {lang} language. Do not use any other language.
    """

    model = genai.GenerativeModel(base_model_name)
    try:
        res = await model.generate_content_async(
            contents=[sys_inst, f"Customer: {user_msg}\nAI:"],
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema=OrderAgentResponse,
                temperature=0.1
            )
        )
    except Exception as e:
        print(f"⚠️ Primary model failed, trying fallback: {e}")
        fallback_model = genai.GenerativeModel("models/gemini-3.1-flash-lite-preview")
        res = await fallback_model.generate_content_async(
            contents=[sys_inst, f"Customer: {user_msg}\nAI:"],
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema=OrderAgentResponse,
                temperature=0.1
            )
        )
        
    try:
        clean_json = re.sub(r'```json\n|\n```|```', '', res.text).strip()
        data = json.loads(clean_json)
        data["prompt_tokens"] = res.usage_metadata.prompt_token_count
        data["candidate_tokens"] = res.usage_metadata.candidates_token_count
        return data
    except Exception as e:
        print(f"🔥 Order Agent Error: {e}")
        return {"is_complex": True, "intent": "OTHER", "extracted": {}, "reply": ai_cfg.get('fallbackMessage', 'Connecting to human agent...'), "prompt_tokens": 0, "candidate_tokens": 0}
