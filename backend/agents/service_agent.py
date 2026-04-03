import json, re
import google.generativeai as genai
import typing

class ExtractedServiceData(typing.TypedDict):
    name: str
    phone: str
    service_type: str
    appointment_time: str
    total_price: int

class Button(typing.TypedDict):
    title: str
    value: str

class ServiceAgentResponse(typing.TypedDict):
    is_complex: bool
    intent: str
    extracted: ExtractedServiceData
    reply: str
    prompt_tokens: int
    candidate_tokens: int

async def run_service_agent(user_msg, tool_info, ai_cfg, policies, profile, base_model_name):
    lang = ai_cfg.get('responseLanguage', 'Myanmar')

    sys_inst = f"""
    Identity: You are {ai_cfg.get('botName', 'Assistant')}. Personality: {ai_cfg.get('personality', 'Polite')}.

    [SERVICE INFO GATHERED BY RESEARCHER]
    {tool_info}

    [USER STATE]
    State: {profile.get('order_state')}
    Segment: {profile.get('segment', 'NEW')}
    Summary: {profile.get('summary', 'No summary available.')}
    Known Data: Name: {profile.get('name')} | Phone: {profile.get('phone')} | Service: {profile.get('service_type')}

    [RULES]
    1. You MUST ALWAYS respond in {lang} language. Do not use any other language.
    2. Collect booking details (Name, Phone, Service, Time). Do NOT ask for an address.
    3. CRITICAL: If they give booking details, 'is_complex' must be false.
    """

    model = genai.GenerativeModel(base_model_name)
    try:
        res = await model.generate_content_async(
            contents=[sys_inst, f"Customer Message: {user_msg}\nAI:"],
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema=ServiceAgentResponse,
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
                response_schema=ServiceAgentResponse,
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
        print(f"🔥 Service Agent Error: {e}")
        return {
            "is_complex": True,
            "intent": "OTHER",
            "extracted": {},
            "reply": ai_cfg.get('fallbackMessage', 'Connecting to human agent...'),
            "prompt_tokens": 0,
            "candidate_tokens": 0
        }
