"""Greeting vs Domain Request router using fast AI model."""
import json
import time
import random
import asyncio
import google.generativeai as genai
from utils import add_to_history, increment_shop_tokens, send_sendpulse_messages, FAST_MODEL_NAME, BASE_MODEL_NAME
from core.prompt_builder import resolve_style, INTENT_GUIDELINES


async def run_greeting_router(user_msg, chat_history, ai_config, shop_doc_id, conv_id, acc_id, user_id, token, lang):
    """Use fast model to decide: simple GREETING or DOMAIN_REQUEST. Exits early if greeting.
    
    IMPORTANT: If user says hello AND asks a question, classify as DOMAIN_REQUEST.
    Only pure greetings/small talk/thanks without any request should be GREETING.
    """
    router_start = time.time()
    style = resolve_style(ai_config)
    preset = style.get("_preset", {})

    router_sys = f"""You are a friendly shop employee.
Tone: {preset.get('tone_description', 'friendly, helpful')}.

Role: Decide if the user message is PURE GREETING/SMALL_TALK or if it contains any DOMAIN_REQUEST.

[CONTEXT]
{chat_history}

[RULES — BE STRICT]
1. "yes", "no", "okay", "confirm", "sure", "go ahead" responding to AI's question → DOMAIN_REQUEST.
2. Asking about products, ordering, pricing, shop info, delivery, payment → DOMAIN_REQUEST.
3. Greeting + Question (e.g. "hello do you have shoes?") → DOMAIN_REQUEST.
4. Greeting + Request (e.g. "hi I want to order") → DOMAIN_REQUEST.
5. ONLY pure greetings/thanks/small talk with NO request/NO question → GREETING.
   Examples of PURE greeting: "hi", "hello", "mingalabar", "thanks", "ok thanks bye".
   Examples of NOT pure greeting: "hi what do you have?", "hello I want to buy", "mingalabar show me products".
6. If GREETING: short warm natural response. Vary your greeting — don't always say the same thing.
7. If AI asked a question in history, user's "yes"/"ok" MUST be DOMAIN_REQUEST.

JSON only: {{"intent": "GREETING" | "DOMAIN_REQUEST", "reply": "reply if GREETING else empty"}}"""

    try:
        router_model = genai.GenerativeModel(FAST_MODEL_NAME)
        router_res = await asyncio.wait_for(
            router_model.generate_content_async(
                contents=[router_sys, f"User: {user_msg}"],
                generation_config=genai.GenerationConfig(response_mime_type="application/json", temperature=0.1),
            ),
            timeout=8.0  # Max 8s for greeting classification
        )
        router_data = json.loads(router_res.text.strip())
        print(f"🚦 Router: intent={router_data.get('intent')} | took={time.time() - router_start:.2f}s")

        if router_data.get("intent") == "GREETING":
            reply_text = router_data.get("reply", "").strip()
            
            # If AI gave a good reply, use it directly
            if reply_text and len(reply_text) > 5:
                # AI reply is good — use as-is
                pass
            else:
                # AI reply empty or too short → use BASE model for quality greeting
                try:
                    greet_model = genai.GenerativeModel(BASE_MODEL_NAME)
                    greet_res = await greet_model.generate_content_async(
                        contents=[f"You are a friendly shop assistant. Reply warmly to this customer in {lang}. Keep it short (1-2 sentences). Be natural.\n\nCustomer: {user_msg}"],
                        generation_config=genai.GenerationConfig(temperature=0.7, max_output_tokens=60),
                    )
                    reply_text = greet_res.text.strip()
                    if r:
                        await increment_shop_tokens(acc_id, greet_res.usage_metadata.total_token_count)
                except Exception:
                    # Last resort fallback: varied hardcoded
                    greetings_mm = [
                        "မင်္ဂလာပါရှင့်။ ဘာကူညီပေးရမလဲရှင့်။",
                        "မင်္ဂလာပါ။ ဘယ်လိုကူညီပေးရမလဲခင်ဗျ။",
                        "ဟိုင်းရှင့် 👋 ဘာမေးချင်လဲရှင့်။",
                        "မင်္ဂလာပါရှင့် 😊 ဘယ်လိုကူညီပေးရမလဲ။",
                    ]
                    greetings_en = [
                        "Hello! How can I help you today?",
                        "Hi there! 👋 What can I do for you?",
                        "Good day! How may I assist you?",
                    ]
                    if lang.lower() in ["myanmar", "burmese", "mm"]:
                        reply_text = random.choice(greetings_mm)
                    else:
                        reply_text = random.choice(greetings_en)
            
            await add_to_history(shop_doc_id, conv_id, "AI", reply_text)
            await send_sendpulse_messages(acc_id, user_id, {"intent": "GREETING"}, reply_text, token)
            await increment_shop_tokens(acc_id, router_res.usage_metadata.total_token_count)
            return True

    except Exception as e:
        print(f"⚠️ Router Error: {e}")

    return False
