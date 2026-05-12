"""
Agent routing logic — selects the appropriate AI agent based on intent, order state,
and media presence. Extracted from processor.py to keep it under 400 lines.
"""
from utils import BASE_MODEL_NAME
from agents.product_agent import run_product_agent
from agents.media_agent import run_media_agent
from agents.order_agent import run_order_agent
from agents.service_agent import run_service_agent
from .profile_manager import save_profile
from .data_extractor import update_nested_profile


async def route_to_agent(order_state, prof, user_msg, ai_config, chat_history, media_parts,
                          tool_info, currency, policies, delivery_info, payment_info, attachments,
                          should_bypass, shop_doc_id, user_id, lang, intent_type,
                          automation_reply=""):
    """Select and run the appropriate AI agent, return (final_data, total_tokens).
    
    automation_reply: AI-generated reply from automation agent (may be used for
    OUT_OF_DOMAIN and other simple intents instead of hardcoded messages).
    """
    is_inquiry = intent_type in ["PRODUCT_INQUIRY", "DELIVERY", "PAYMENT", "POLICY_FAQ"]

    # Service booking flow
    is_service = prof.get("service_type") or intent_type == "SERVICE"

    if intent_type == "OUT_OF_DOMAIN":
        print("   - Selected: OUT_OF_DOMAIN (Using AI reply)")
        # Prefer AI's own words — only fallback to hardcoded if AI gave nothing
        reply = automation_reply.strip() if automation_reply and len(automation_reply.strip()) > 10 else ""
        if not reply:
            if lang.lower() in ["myanmar", "burmese", "mm"]:
                reply = "တောင်းပန်ပါတယ်ရှင့်။ ဒါက ကျွန်မတို့ shop နဲ့ သက်ဆိုင်တဲ့ အကြောင်းအရာ မဟုတ်လို့ ဖြေကြားပေးလို့ မရပါဘူးရှင်။ Product တွေနဲ့ပတ်သက်ပြီး မေးမြန်းချင်တာရှိရင်တော့ မေးမြန်းနိုင်ပါတယ်ရှင့်။"
            else:
                reply = "I'm sorry, but I can only answer questions related to our shop and products. If you have any product-related questions, feel free to ask!"
        final_data = {
            "is_complex": False, "intent": "OUT_OF_DOMAIN",
            "reply": reply,
            "extracted": {}
        }
    elif is_service:
        print("   - Selected: SERVICE_AGENT")
        final_data = await run_service_agent(user_msg, tool_info, ai_config, policies, prof, BASE_MODEL_NAME, chat_history=chat_history, shop_doc_id=shop_doc_id, media_parts=media_parts)
    elif order_state in ["COLLECTING", "WAITING_FOR_SLIP", "SUMMARY_SENT"] and not is_inquiry:
        print(f"   - Selected: ORDER_AGENT (state={order_state})")
        if order_state == "WAITING_FOR_SLIP" and attachments:
            prof["current_order"]["payment_slip_url"] = attachments[0]
            user_msg = "Slip uploaded."
        final_data = await run_order_agent(user_msg, prof, ai_config, BASE_MODEL_NAME, chat_history, delivery_info, payment_info, tool_info, currency, policies, media_parts=media_parts, shop_doc_id=shop_doc_id)
        if final_data.get("intent") in ["SUMMARY_SENT", "WAITING_FOR_SLIP", "COLLECTING"]:
            prof["dynamics"]["order_state"] = final_data["intent"]
    elif media_parts and intent_type not in ["ORDER", "START_ORDER"]:
        print("   - Selected: MEDIA_AGENT (photo/voice analysis)")
        final_data = await run_media_agent(user_msg, tool_info, ai_config, policies, prof, BASE_MODEL_NAME, chat_history, media_parts, delivery_info, payment_info, shop_doc_id=shop_doc_id)
    elif order_state == "NONE" and should_bypass:
        print("   - Selected: ORDER_AGENT (bypass)")
        prof["dynamics"]["order_state"] = "COLLECTING"
        final_data = await run_order_agent(user_msg, prof, ai_config, BASE_MODEL_NAME, chat_history, delivery_info, payment_info, tool_info, currency, policies, media_parts=media_parts, shop_doc_id=shop_doc_id)
        if final_data.get("intent") in ["SUMMARY_SENT", "WAITING_FOR_SLIP", "COLLECTING"]:
            prof["dynamics"]["order_state"] = final_data["intent"]
    else:
        print("   - Selected: PRODUCT_AGENT")
        past_purchases = prof.get("sales_data", {}).get("past_purchases", [])
        final_data = await run_product_agent(user_msg, tool_info, ai_config, policies, prof, BASE_MODEL_NAME, chat_history, past_purchases, delivery_info, payment_info, media_parts=media_parts, shop_doc_id=shop_doc_id)
        if final_data.get("intent") == "START_ORDER":
            prof["dynamics"]["order_state"] = "COLLECTING"
            agent_reply = final_data.get("reply", "").strip()
            # Prefer AI's natural transition — only hardcode if AI gave nothing meaningful
            if not agent_reply or len(agent_reply) < 10:
                if lang.lower() in ["myanmar", "burmese", "mm"]:
                    transitions = [
                        "အော်ဒါတင်ဖို့ လူကြီးမင်းရဲ့ နာမည်လေး ပြောပေးပါဦးရှင့်။",
                        "ဟုတ်ကဲ့ရှင့် 😊 အော်ဒါတင်ဖို့ နာမည်နဲ့ ဖုန်းနံပါတ်လေး ပေးပါဦးနော်။",
                        "ရပါတယ်ရှင့်။ ပထမဆုံး နာမည်လေးပြောပေးပါဦးရှင့်။",
                    ]
                    import random
                    agent_reply = random.choice(transitions)
                else:
                    agent_reply = "To proceed with your order, please share your name and phone number."
            final_data = {
                "is_complex": False, "intent": "COLLECTING",
                "extracted": final_data.get("extracted", {}),
                "reply": agent_reply,
                "prompt_tokens": final_data.get("prompt_tokens", 0),
                "candidate_tokens": final_data.get("candidate_tokens", 0),
            }

    prompt_tokens = final_data.get("prompt_tokens", 0)
    candidate_tokens = final_data.get("candidate_tokens", 0)
    total_tokens = prompt_tokens + candidate_tokens

    print(f"📊 AI USAGE [{shop_doc_id}]: Prompt={prompt_tokens}  Cand={candidate_tokens}  Total={total_tokens}")

    # Save extracted data to profile (using nested helper)
    update_nested_profile(prof, final_data.get("extracted", {}))
    await save_profile(shop_doc_id, user_id, prof)

    return final_data, total_tokens
