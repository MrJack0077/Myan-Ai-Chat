"""
Agent routing logic — selects the appropriate AI agent based on intent, order state,
and media presence. Extracted from processor.py to keep it under 400 lines.
"""
import json
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
                          automation_reply="", photo_context=""):
    """Select and run the appropriate AI agent, return (final_data, total_tokens).
    
    automation_reply: AI-generated reply from automation agent (may be used for
    OUT_OF_DOMAIN and other simple intents instead of hardcoded messages).
    photo_context: Pre-analyzed image context (payment slip / product match).
    """
    is_inquiry = intent_type in ["PRODUCT_INQUIRY", "DELIVERY", "PAYMENT", "POLICY_FAQ"]

    # ⚡ CRITICAL: if customer is in active order flow, ALWAYS use order agent
    # regardless of what intent_type says — prevent "yes kpay" from going to product agent
    if order_state in ["COLLECTING", "WAITING_FOR_SLIP", "SUMMARY_SENT"]:
        is_inquiry = False  # Force order agent path

    # Service booking flow
    is_service = prof.get("service_type") or intent_type == "SERVICE"

    if intent_type == "OUT_OF_DOMAIN":
        print("   - Selected: OUT_OF_DOMAIN (Hardcoded only — no AI)")
        # NEVER use AI reply for out-of-domain — hardcoded only
        # AI tends to fabricate stories like "I'm a shop employee named..."
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
    elif order_state in ["COLLECTING", "WAITING_FOR_SLIP", "SUMMARY_SENT"]:
        # Active order flow — ALWAYS use order agent regardless of intent
        print(f"   - Selected: ORDER_AGENT (state={order_state}, intent={intent_type})")
        if order_state == "WAITING_FOR_SLIP" and attachments:
            prof["current_order"]["payment_slip_url"] = attachments[0]
            user_msg = "Slip uploaded."
        final_data = await run_order_agent(user_msg, prof, ai_config, BASE_MODEL_NAME, chat_history, delivery_info, payment_info, tool_info, currency, policies, media_parts=media_parts, shop_doc_id=shop_doc_id)
        if final_data.get("intent") in ["SUMMARY_SENT", "WAITING_FOR_SLIP", "COLLECTING"]:
            prof["dynamics"]["order_state"] = final_data["intent"]
        
        # ── Auto-detect confirmation keywords ──
        msg_lower = user_msg.lower()
        confirm_keywords = ['yes', 'ဟုတ်', 'confirm', 'ok', 'okay', 'အင်း', 'မှန်တယ်', 'ဟုတ်ကဲ့', 'မှာ', 'တင်ပေး', 'ယူမယ်', 'do it', 'go ahead', 'proceed']
        if any(kw in msg_lower for kw in confirm_keywords):
            has_data = (prof["identification"].get("name") and 
                       prof["current_order"].get("items"))
            if has_data:
                print(f"🔔 Auto-detected confirmation keyword → forcing ORDER_CONFIRMED", flush=True)
                final_data["intent"] = "ORDER_CONFIRMED"
                final_data["is_complex"] = True
    elif order_state in ["COLLECTING", "WAITING_FOR_SLIP", "SUMMARY_SENT"] and is_inquiry:
        # Customer is in order flow but message looks like product inquiry
        # → treat as order continuation, not new product inquiry
        print(f"   - Selected: ORDER_AGENT (state={order_state}, inquiry override)", flush=True)
        final_data = await run_order_agent(user_msg, prof, ai_config, BASE_MODEL_NAME, chat_history, delivery_info, payment_info, tool_info, currency, policies, media_parts=media_parts, shop_doc_id=shop_doc_id)
        if final_data.get("intent") in ["SUMMARY_SENT", "WAITING_FOR_SLIP", "COLLECTING"]:
            prof["dynamics"]["order_state"] = final_data["intent"]
        
        msg_lower = user_msg.lower()
        confirm_keywords = ['yes', 'ဟုတ်', 'confirm', 'ok', 'okay', 'အင်း', 'မှန်တယ်', 'ဟုတ်ကဲ့', 'မှာ', 'တင်ပေး', 'do it', 'go ahead', 'proceed']
        if any(kw in msg_lower for kw in confirm_keywords):
            has_data = (prof["identification"].get("name") and 
                       prof["current_order"].get("items"))
            if has_data:
                print(f"🔔 Auto-detected confirmation keyword → forcing ORDER_CONFIRMED", flush=True)
                final_data["intent"] = "ORDER_CONFIRMED"
                final_data["is_complex"] = True
    elif media_parts and intent_type not in ["ORDER", "START_ORDER"]:
        print("   - Selected: MEDIA_AGENT (photo/voice analysis)")
        final_data = await run_media_agent(user_msg, tool_info, ai_config, policies, prof, BASE_MODEL_NAME, chat_history, media_parts, delivery_info, payment_info, shop_doc_id=shop_doc_id, photo_context=photo_context)
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
    extracted = final_data.get("extracted", {})
    print(f"📦 DEBUG: extracted data → name={prof['identification'].get('name','?')}, phone={prof['identification'].get('phone','?')}, items={prof['current_order'].get('items',[])}", flush=True)
    await save_profile(shop_doc_id, user_id, prof)
    
    # ── Professional Order Data Extraction (keyword-based, 0ms) ──
    try:
        from .order_extractor import extract_order_data
        kw_data = extract_order_data(user_msg, tool_info)
        if kw_data:
            if kw_data.get("name") and len(kw_data["name"]) >= 2:
                old_name = prof["identification"].get("name", "")
                # Overwrite if old name is corrupted (short/truncated) or new is better
                if not old_name or len(old_name) < 3 or len(kw_data["name"]) > len(old_name):
                    prof["identification"]["name"] = kw_data["name"]
            if kw_data.get("phone"):
                prof["identification"]["phone"] = kw_data["phone"]
            if kw_data.get("address"):
                old_addr = prof["current_order"].get("address", "")
                ai_junk = ['ပို့ဆောင်', 'မှာယူ', 'ငွေပေး', 'ကျေးဇူး', 'အော်ဒါ']
                # Overwrite if old address has AI junk or empty
                if not old_addr or any(w in old_addr for w in ai_junk) or len(kw_data["address"]) < len(old_addr):
                    prof["current_order"]["address"] = kw_data["address"]
            if kw_data.get("payment_method"):
                prof["current_order"]["payment_method"] = kw_data["payment_method"]
            if kw_data.get("items"):
                prof["current_order"]["items"] = kw_data["items"]
            if kw_data.get("total_price"):
                prof["current_order"]["total_price"] = kw_data["total_price"]
            print(f"📦 Extracted: {json.dumps(kw_data, ensure_ascii=False)[:200]}", flush=True)
    except Exception as e:
        print(f"⚠️ Order extraction error: {e}", flush=True)
    
    # ── Legacy keyword extraction (backup) ──
    import re
    msg_lower = user_msg.lower()
    
    # Name patterns (Myanmar + English)
    if not prof["identification"].get("name"):
        name_pats = [
            r'(?:name|နာမည်|အမည်)[\s:：]*([A-Za-z\u1000-\u109F\s]{2,25})',
            r'(?:ကို|မောင်|မ|မမ|ဦး|ဒေါ်|ကိုကို|မမ)\s*([A-Za-z\u1000-\u109F]{2,20})',
        ]
        for pat in name_pats:
            m = re.search(pat, user_msg, re.IGNORECASE)
            if m:
                name = m.group(1).strip()
                # Clean trailing junk characters
                name = re.sub(r'[\'"]+$', '', name)
                if len(name) >= 2:
                    prof["identification"]["name"] = name
                    print(f"🔑 Extracted name: {prof['identification']['name']}", flush=True)
                    break
    
    # Phone (Myanmar format)
    if not prof["identification"].get("phone"):
        pm = re.search(r'(09\d{7,9}|\+?959\d{7,9})', user_msg)
        if pm:
            prof["identification"]["phone"] = pm.group(1)
            print(f"🔑 Extracted phone: {prof['identification']['phone']}", flush=True)
    
    # Address — strict patterns to avoid extracting AI reply text
    if not prof["current_order"].get("address"):
        addr_pats = [
            r'(?:No\.?\s*\d+|အမှတ်\s*\d+)[\s,，]+([A-Za-z\u1000-\u109F\s]{5,40}?)(?:\.|$|\n|၊)',
            r'(?:ရန်ကုန်|မန္တလေး|နေပြည်တော်|yangon|mandalay|dagon|တာမွေ|ဗဟန်း|လှိုင်|သာကေ|မရမ်း)[\w\u1000-\u109F\s,]{5,30}',
        ]
        for pat in addr_pats:
            am = re.search(pat, user_msg, re.IGNORECASE)
            if am:
                addr = am.group(0).strip()
                # Filter out AI reply text (contains keywords like ပို့ဆောင်, မှာယူ, ကျေးဇူး, etc.)
                ai_junk_words = ['ပို့ဆောင်', 'မှာယူ', 'ကျေးဇူး', 'ငွေပေး', 'အော်ဒါ', 'စျေးဝယ်']
                if len(addr) >= 5 and len(addr) <= 100 and not any(w in addr for w in ai_junk_words):
                    prof["current_order"]["address"] = addr
                    print(f"🔑 Extracted address: {addr[:50]}", flush=True)
                    break
    
    if not extracted:
        print(f"⚠️ No extracted data from AI — using keyword extraction only", flush=True)
    
    # ── Auto-populate items from order context ──
    if not prof["current_order"].get("items") and order_state in ["COLLECTING", "SUMMARY_SENT"]:
        # Try to extract product name from tool_info that was discussed
        if tool_info:
            for line in tool_info.split('\n')[:5]:
                line = line.strip()
                if line and any(kw in line.lower() for kw in ['price', 'mmk', 'kyat', 'ကျပ်']):
                    # This is a product line — extract name
                    name_match = re.match(r'^([^|]+)', line)
                    if name_match:
                        product_name = name_match.group(1).strip()
                        # Clean formatting junk from product name
                        product_name = re.sub(r'^[📦🛒🛍️\s]+', '', product_name)
                        product_name = re.sub(r'\s{2,}', ' ', product_name)
                        # Remove leading "Name:" prefix
                        product_name = re.sub(r'^Name:\s*', '', product_name, flags=re.IGNORECASE)
                        # Trim trailing whitespace and pipe chars
                        product_name = product_name.strip().rstrip('|').strip()
                        if product_name and len(product_name) >= 3:
                            prof["current_order"]["items"] = [product_name]
                            print(f"🔑 Auto-populated items: [{product_name}]", flush=True)
                            
                            # Try to extract price too
                            price_m = re.search(r'(\d[\d,]*)\s*(?:MMK|kyat|ကျပ်|\$)', line)
                            if price_m:
                                try:
                                    prof["current_order"]["total_price"] = int(price_m.group(1).replace(',', ''))
                                    print(f"🔑 Auto-populated price: {prof['current_order']['total_price']}", flush=True)
                                except:
                                    pass
                            break
    await save_profile(shop_doc_id, user_id, prof)

    return final_data, total_tokens
