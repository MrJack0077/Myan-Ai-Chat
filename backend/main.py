import asyncio
import json
import os
import httpx
import io
from PIL import Image
from datetime import datetime, timezone, timedelta
from contextlib import asynccontextmanager

import google.generativeai as genai
from fastapi import FastAPI, Request, HTTPException
from google.cloud.firestore_v1.vector import Vector
from google.cloud.firestore_v1.base_vector_query import DistanceMeasure
from google.cloud.firestore_v1.base_query import FieldFilter
from dotenv import load_dotenv

# Utilities and Agents
from utils import db, r, handover_to_admin, increment_shop_tokens, get_shop_data, bg_post, verify_chatwoot_signature, add_to_history, get_history, check_rate_limit, log_shop_analytics, hybrid_search_items
from agents.product_agent import run_product_agent
from agents.media_agent import run_media_agent
from agents.order_agent import run_order_agent
from agents.service_agent import run_service_agent
from agents.automation_agent import run_automation_agent

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

base_model_name = "models/gemini-3.1-flash-lite-preview"
fast_model_name = "models/gemini-3.1-flash-lite-preview"
embedding_model_name = "models/gemini-embedding-2-preview"
API_HOST = os.getenv("API_HOST", "https://allchat.ddnsfree.com")
CHATWOOT_WEBHOOK_TOKEN = os.getenv("CHATWOOT_WEBHOOK_TOKEN", "")

# --- Memory Helpers ---
async def save_profile(shop_id, user_id, prof):
    prof["last_updated"] = datetime.now(timezone.utc).isoformat()
    if r:
        try: await r.set(f"prof:{shop_id}:{user_id}", json.dumps(prof))
        except Exception as e: print(f"Redis Profile Save Error: {e}")
    try: db.collection("shops").document(shop_id).collection("customers").document(user_id).set(prof)
    except Exception as e: print(f"⚠️ Profile Save Error: {e}")

async def get_user_profile(shop_id, user_id):
    if r:
        try:
            cached = await r.get(f"prof:{shop_id}:{user_id}")
            if cached:
                data = json.loads(cached)
                if isinstance(data, dict): return data
        except Exception as e: print(f"Redis Profile Get Error: {e}")
    try:
        doc = db.collection("shops").document(shop_id).collection("customers").document(user_id).get()
        if doc.exists: return doc.to_dict()
    except Exception as e: print(f"Firestore Profile Get Error: {e}")
    return {
        "summary": "", "order_state": "NONE", "items": [],
        "name": "", "phone": "", "payment_method": "", "address": "",
        "deli_charge": 0, "total_price": 0, "payment_slip_url": "",
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "last_button_msg_id": ""
    }

# --- Queue & Worker Setup ---
task_queue = asyncio.Queue()

async def worker_process():
    while True:
        if r:
            try:
                result = await r.brpop("chatwoot_task_queue", timeout=5)
                if result:
                    _, data_str = result
                    data = json.loads(data_str)
                    if isinstance(data, dict):
                        await process_core_logic(data)
                    else:
                        print(f"⚠️ Invalid task data in Redis: {data}")
            except Exception as e:
                print(f"💥 Redis Worker Error: {e}")
                await asyncio.sleep(1)
        else:
            data = await task_queue.get()
            try: await process_core_logic(data)
            except Exception as e: print(f"💥 Worker Error: {e}")
            finally: task_queue.task_done()

@asynccontextmanager
async def lifespan(app: FastAPI):
    workers = [asyncio.create_task(worker_process()) for _ in range(5)]
    yield
    for w in workers: w.cancel()

app = FastAPI(lifespan=lifespan)
pending_messages = {}

@app.post("/api/shops/{shop_id}/automation")
async def update_automation_settings(shop_id: str, settings: dict):
    if not db: return {"status": "error", "message": "No DB"}
    try:
        db.collection("shops").document(shop_id).update({
            "ai_config.automationRules": settings.get("rules", []), 
            "ai_config.personality": settings.get("personality", ""),
            "ai_config.botName": settings.get("botName", "AI Assistant")
        })
        if r:
            # Clear cache to apply changes immediately
            shop_doc = db.collection("shops").document(shop_id).get()
            if shop_doc.exists:
                acc_id = shop_doc.to_dict().get("chatwootAccountId")
                if acc_id: await r.delete(f"shop_data_v2:{acc_id}")
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/shops/{shop_id}/automation")
async def get_automation_settings(shop_id: str):
    if not db: return {"status": "error", "message": "No DB"}
    try:
        doc = db.collection("shops").document(shop_id).get()
        if not doc.exists: return {"status": "error", "message": "Shop not found"}
        data = doc.to_dict()
        ai_cfg = data.get("ai_config", {})
        return {
            "rules": ai_cfg.get("automationRules", []),
            "personality": ai_cfg.get("personality", ""),
            "botName": ai_cfg.get("botName", "AI Assistant")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@app.get("/api/clear-cache/{target_id}")
async def clear_cache_endpoint(target_id: str):
    if not r:
        return {"status": "error", "message": "Redis Database နှင့် ချိတ်ဆက်မှု မရှိပါ။"}

    # ၁။ Chatwoot ID (acc_id) ဖြင့် လာခဲ့လျှင် တိုက်ရိုက်ဖျက်ရန်
    try:
        await r.delete(f"shop_data_v2:{target_id}")
    except Exception as e:
        print(f"Redis delete error: {e}")

    # ၂။ React Frontend မှ Firebase shopId ဖြင့် လာခဲ့လျှင် သက်ဆိုင်ရာ acc_id ကို ရှာ၍ ဖျက်ပေးရန်
    try:
        if db:
            # Document ID ဖြင့် တိုက်ရိုက်ဖတ်ခြင်းက Strong Consistency ရရှိစေသည်
            doc_ref = db.collection("shops").document(target_id)
            doc = await asyncio.to_thread(doc_ref.get)
            if doc.exists:
                data = doc.to_dict()
                actual_acc_id = str(data.get("chatwootAccountId", ""))
                if actual_acc_id:
                    # Redis ထဲက shop data ကို ဖျက်ပါ
                    await r.delete(f"shop_data_v2:{actual_acc_id}")
                    
                    # Eventual Consistency ကို ကျော်လွှားရန်အတွက် 
                    # Cache ထဲကို data အသစ်ကို တိုက်ရိုက် ရေးထည့်ပေးလိုက်ပါ
                    shop_data = {
                        "shop_info": data,
                        "token": data.get("chatwootToken"),
                        "shop_doc_id": doc.id,
                        "ai_config": data.get("aiConfig", {}),
                        "policies": data.get("policies", {}),
                        "agentId": data.get("agentId")
                    }
                    await r.setex(f"shop_data_v2:{actual_acc_id}", 600, json.dumps(shop_data))
                    
                    # ၃။ Chat History Cache ကိုပါ ရှင်းလင်းရန် (Optional but recommended for Language/Tone changes)
                    # မှတ်ချက် - conversation အားလုံးကို လိုက်ဖျက်ရန် ခက်ခဲသဖြင့် 
                    # AI က config အသစ်ကို အလေးထားရန် system prompt တွင် ညွှန်ကြားထားပြီးဖြစ်သည်
                    
                    return {"status": "success", "message": f"Shop ID ({target_id}) ၏ Cache ကို အောင်မြင်စွာ Update လုပ်ပြီးပါပြီ။ Live update ချက်ချင်း အသက်ဝင်ပါမည်။"}
    except Exception as e:
        print(f"Cache clear lookup error: {e}")

    return {"status": "success", "message": f"ID ({target_id}) အတွက် Cache ရှင်းလင်းမှု လုပ်ဆောင်ပြီးပါပြီ။"}

@app.get("/api/cron/followup")
async def cron_followup():
    """Check for abandoned carts and send follow-up messages"""
    if not db: return {"status": "error", "message": "No DB"}
    try:
        # Find customers who are in COLLECTING or WAITING_FOR_SLIP state
        # and haven't been updated in the last 2 hours
        two_hours_ago = datetime.now(timezone.utc) - timedelta(hours=2)
        
        shops_ref = db.collection("shops")
        shops = await asyncio.to_thread(lambda: list(shops_ref.stream()))
        
        followups_sent = 0
        for shop in shops:
            shop_data = shop.to_dict()
            shop_id = shop.id
            token = shop_data.get("token")
            acc_id = shop_data.get("acc_id")
            if not token or not acc_id: continue
            
            customers_ref = db.collection("shops").document(shop_id).collection("customers")
            # In a real app, we'd use a composite index or query, but for now we'll fetch and filter
            customers = await asyncio.to_thread(lambda: list(customers_ref.stream()))
            
            for cust in customers:
                prof = cust.to_dict()
                order_state = prof.get("order_state", "NONE")
                last_updated_str = prof.get("last_updated")
                followup_sent = prof.get("followup_sent", False)
                
                if order_state in ["COLLECTING", "WAITING_FOR_SLIP"] and last_updated_str and not followup_sent:
                    last_dt = datetime.fromisoformat(last_updated_str)
                    if last_dt < two_hours_ago:
                        # Send follow-up
                        conv_id = cust.id # Assuming conv_id is used as customer doc id
                        lang = shop_data.get("ai_config", {}).get("responseLanguage", "Myanmar")
                        if lang.lower() in ["myanmar", "burmese", "mm"]:
                            msg = "မင်္ဂလာပါရှင်၊ အစ်ကို/အစ်မ ပစ္စည်းလေး ယူဖြစ်မလားရှင့်။ အခက်အခဲတစ်စုံတစ်ရာရှိရင် ပြောပြပေးပါနော်။"
                        else:
                            msg = "Hello! Are you still interested in completing your order? Let us know if you need any help."
                        
                        await bg_post(f"{API_HOST}/api/v1/accounts/{acc_id}/conversations/{conv_id}/messages", {"content": msg, "message_type": "outgoing"}, token)
                        
                        # Mark as sent
                        prof["followup_sent"] = True
                        prof["last_updated"] = datetime.now(timezone.utc).isoformat()
                        await asyncio.to_thread(lambda: customers_ref.document(cust.id).update({"followup_sent": True, "last_updated": prof["last_updated"]}))
                        followups_sent += 1
                        
        return {"status": "success", "followups_sent": followups_sent}
    except Exception as e:
        print(f"Cron followup error: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/webhook")
async def chatwoot_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("X-Chatwoot-Signature", "")
    if not verify_chatwoot_signature(body, signature, CHATWOOT_WEBHOOK_TOKEN):
        raise HTTPException(status_code=403, detail="Invalid Signature")

    data = await request.json()
    msg_type = data.get("message_type")
    
    # Automated Feedback Loop: Learn from Admin replies
    if msg_type == "outgoing" and data.get("event") == "message_created":
        sender = data.get("sender", {})
        # Check if it's a human agent (not a bot/automation)
        if sender.get("type") == "user":
            conv_id = str(data.get("conversation", {}).get("id", ""))
            acc_id = str(data.get("account", {}).get("id", ""))
            admin_reply = data.get("content", "").strip()
            if admin_reply:
                # We need to queue this to process the feedback
                feedback_data = {
                    "type": "admin_feedback",
                    "acc_id": acc_id,
                    "conv_id": conv_id,
                    "admin_reply": admin_reply
                }
                if r:
                    try: await r.lpush("chatwoot_task_queue", json.dumps(feedback_data))
                    except: await task_queue.put(feedback_data)
                else:
                    await task_queue.put(feedback_data)
        return {"status": "ignored_outgoing"}

    if msg_type == "incoming" and data.get("event") == "message_created":
        conv_id = str(data.get("conversation", {}).get("id", ""))
        content = data.get("content", "") or ""
        atts = data.get("attachments", [])

        if not content and not atts and data.get("content_attributes"):
            submitted = data.get("content_attributes", {}).get("submitted_values", {})
            if isinstance(submitted, list) and len(submitted) > 0: content = submitted[0].get("value", "")
            elif isinstance(submitted, dict): content = submitted.get("value", "") or submitted.get("payload", "")

        if not content and not atts: return {"status": "ignored"}

        if conv_id in pending_messages:
            pending_messages[conv_id]["timer"].cancel()
            if content: pending_messages[conv_id]["contents"].append(content)
            if atts: pending_messages[conv_id]["attachments"].extend(atts)
        else:
            pending_messages[conv_id] = {
                "base_data": data,
                "contents": [content] if content else [],
                "attachments": atts or []
            }

        async def queue_message(cid):
            await asyncio.sleep(0.5)
            if cid in pending_messages:
                msg_info = pending_messages.pop(cid)
                final_data = msg_info["base_data"]
                final_data["content"] = "\n".join(msg_info["contents"]).strip()
                final_data["attachments"] = msg_info["attachments"]
                if r:
                    try:
                        await r.lpush("chatwoot_task_queue", json.dumps(final_data))
                    except Exception as e:
                        print(f"Redis queue push error: {e}")
                        await task_queue.put(final_data)
                else:
                    await task_queue.put(final_data)

        pending_messages[conv_id]["timer"] = asyncio.create_task(queue_message(conv_id))

    return {"status": "queued"}

async def process_core_logic(data):
    if data.get("type") == "admin_feedback":
        acc_id = data["acc_id"]
        conv_id = data["conv_id"]
        admin_reply = data["admin_reply"]
        shop = await get_shop_data(acc_id)
        if not shop: return
        shop_doc_id = shop['shop_doc_id']
        
        # Fetch history to get the last customer message
        history = await get_history(shop_doc_id, conv_id)
        last_cust_msg = ""
        for line in reversed(history.split("\n")):
            if line.startswith("Customer:"):
                last_cust_msg = line.replace("Customer:", "").strip()
                break
        
        if last_cust_msg and admin_reply:
            correction = f"Q: {last_cust_msg} | A: {admin_reply}"
            try:
                shop_ref = db.collection("shops").document(shop_doc_id)
                shop_doc = shop_ref.get()
                if shop_doc.exists:
                    ai_cfg = shop_doc.to_dict().get("ai_config", {})
                    lc = ai_cfg.get("learningCenter", {})
                    corrections = lc.get("corrections", [])
                    if correction not in corrections:
                        corrections.append(correction)
                        # Keep only last 20 corrections to avoid prompt bloat
                        corrections = corrections[-20:]
                        lc["corrections"] = corrections
                        ai_cfg["learningCenter"] = lc
                        shop_ref.update({"ai_config": ai_cfg})
                        if r: await r.delete(f"shop_data_v2:{acc_id}")
                        print(f"✅ Learned from Admin: {correction}")
            except Exception as e:
                print(f"Feedback loop error: {e}")
        return

    acc_id = str(data["account"]["id"])
    conv_id = str(data["conversation"]["id"])
    user_id = str(data["sender"]["id"])
    total_tokens_used = 0

    user_msg = data.get("content", "").strip()
    attachments = data.get("attachments", [])

    print(f"\n📩 DEBUG: Grouped Message from {user_id}: Text='{user_msg}', Attachments={len(attachments)}")

    shop = await get_shop_data(acc_id)
    if not shop: return
    
    shop_doc_id = shop['shop_doc_id']
    
    # Check Rate Limit
    is_allowed = await check_rate_limit(shop_doc_id)
    if not is_allowed:
        print(f"⚠️ Rate limit exceeded for shop {shop_doc_id}")
        await log_shop_analytics(shop_doc_id, "rate_limit_exceeded", {"user_id": user_id})
        return

    prof = await get_user_profile(shop_doc_id, user_id)

    def clean_large_strings(data_input, max_len=3000):
        if isinstance(data_input, dict):
            return {k: clean_large_strings(v, max_len) for k, v in data_input.items()}
        elif isinstance(data_input, list):
            return [clean_large_strings(i, max_len) for i in data_input]
        elif isinstance(data_input, str) and len(data_input) > max_len:
            return "[Data Too Long - Removed]"
        return data_input

    token = shop['token']
    agent_id = shop.get('agentId')
    ai_config = clean_large_strings(shop.get('ai_config', {}))
    policies = clean_large_strings(ai_config.get('policies', {}))
    shop_info_data = shop.get("shop_info", {})
    delivery_info = clean_large_strings(shop_info_data.get("deliveryInfo", []))
    payment_info = clean_large_strings(shop_info_data.get("paymentInfo", []))
    currency = shop_info_data.get("currency", "MMK")
    lang = ai_config.get('responseLanguage', 'Myanmar')

    if user_msg.strip().lower() == "/refresh":
        if r: 
            try: await r.delete(f"shop_data_v2:{acc_id}")
            except Exception as e: print(f"Redis delete error: {e}")
        msg_payload = {"content": f"✅ Shop data refreshed.", "message_type": "outgoing", "private": True}
        await bg_post(f"{API_HOST}/api/v1/accounts/{acc_id}/conversations/{conv_id}/messages", msg_payload, token)
        return

    order_state = prof.get("order_state", "NONE")
    past_purchases = prof.get("past_purchases", [])
    if not isinstance(past_purchases, list): past_purchases = []
    
    # Customer Segmentation (VIP, RETURNING, NEW)
    total_spent = sum([p.get("total_price", 0) for p in past_purchases if isinstance(p, dict)])
    if total_spent > 100000: # Example threshold for VIP
        prof["segment"] = "VIP"
    elif len(past_purchases) > 0:
        prof["segment"] = "RETURNING"
    else:
        prof["segment"] = "NEW"

    last_updated_str = prof.get("last_updated")
    if last_updated_str and order_state != "NONE":
        try:
            last_dt = datetime.fromisoformat(last_updated_str)
            if (datetime.now(timezone.utc) - last_dt).total_seconds() > 10800:
                print("⏰ DEBUG: Order state expired. Resetting to NONE.")
                order_state = "NONE"
                prof.update({"order_state": "NONE", "items": [], "payment_slip_url": "", "deli_charge": 0, "total_price": 0})
                await save_profile(shop_doc_id, user_id, prof)
        except Exception as e: print(f"Date parsing error: {e}")

    typing_url = f"{API_HOST}/api/v1/accounts/{acc_id}/conversations/{conv_id}/toggle_typing_status"
    asyncio.create_task(bg_post(typing_url, {"typing_status": "on"}, token, timeout=3.0))

    media_parts = []
    if attachments:
        ack_msg = {"content": "Processing your attachment... 🔍", "message_type": "outgoing"}
        asyncio.create_task(bg_post(f"{API_HOST}/api/v1/accounts/{acc_id}/conversations/{conv_id}/messages", ack_msg, token, timeout=3.0))

        async with httpx.AsyncClient() as client:
            for att in attachments:
                if not isinstance(att, dict): continue
                data_url = att.get("data_url") or att.get("url")
                if data_url:
                    if data_url.startswith("/"): data_url = f"{API_HOST}{data_url}"
                    try:
                        headers = {"api_access_token": token}
                        resp = await client.get(data_url, headers=headers, follow_redirects=True)
                        if resp.status_code == 200:
                            mime_type = resp.headers.get("content-type", "").split(";")[0].strip() or "image/jpeg"
                            if mime_type.startswith("image/"):
                                try:
                                    img = Image.open(io.BytesIO(resp.content))
                                    img.thumbnail((1024, 1024))
                                    if img.mode in ("RGBA", "P"): img = img.convert("RGB")
                                    img_byte_arr = io.BytesIO()
                                    img.save(img_byte_arr, format='JPEG', quality=80)
                                    media_parts.append({"mime_type": "image/jpeg", "data": img_byte_arr.getvalue()})
                                except Exception as e:
                                    print(f"Image processing error: {e}")
                                    media_parts.append({"mime_type": mime_type, "data": resp.content})
                            elif mime_type.startswith("audio/"):
                                media_parts.append({"mime_type": mime_type, "data": resp.content})
                    except Exception as e: print(f"Attachment download error: {e}")

    hist_msg = user_msg if user_msg else "[Voice/Image/Payload]"
    asyncio.create_task(add_to_history(shop_doc_id, conv_id, "Customer", hist_msg))
    chat_history = await get_history(shop_doc_id, conv_id, prof)

    # 1. Enterprise Automation Agent (Multi-modal & Intent) - Use Lite for speed if it's a simple message
    automation_model = "models/gemini-3.1-flash-lite-preview" 
    
    import time
    start_time = time.time()
    
    async def run_research():
        """Run embedding and search in parallel with automation agent"""
        if not user_msg or attachments or order_state != "NONE":
            return None, None, ""
        try:
            emb_start = time.time()
            emb_res = await genai.embed_content_async(model=embedding_model_name, content=user_msg, task_type="retrieval_query", output_dimensionality=768)
            print(f"⏱️ Embedding took: {time.time() - emb_start:.2f}s")
            
            search_start = time.time()
            docs = await hybrid_search_items(shop_doc_id, user_msg, emb_res['embedding'], limit=2)
            print(f"⏱️ Hybrid Search took: {time.time() - search_start:.2f}s")
            
            tool_info = "Database Result: No items found."
            if docs:
                res_list = []
                for d in docs:
                    try: stock = int(d.get('stock_quantity') or 0)
                    except: stock = 0
                    status = "OUT OF STOCK" if stock <= 0 else f"In Stock ({stock})"
                    
                    item_str = f"📦 Name: {d.get('name')} | Price: {d.get('price')} {currency} | Status: {status}"
                    
                    # Inject brand and category
                    brand = d.get('brand', '')
                    category = d.get('category', '')
                    if brand or category:
                        item_str += f"\n   - Brand/Category: {brand} / {category}"
                        
                    # Inject Sub-items (Variants like Color/Size)
                    sub_items = d.get('sub_items', [])
                    if isinstance(sub_items, list) and len(sub_items) > 0:
                        variant_list = []
                        for sub in sub_items:
                            sub_name = sub.get('name', 'Unknown')
                            sub_stock = int(sub.get('stock_quantity') or 0)
                            sub_status = "Out of Stock" if sub_stock <= 0 else f"In Stock ({sub_stock})"
                            variant_list.append(f"{sub_name} ({sub_status})")
                        item_str += f"\n   - Available Variants: {', '.join(variant_list)}"
                    
                    # Inject rich product data for AI
                    ai_desc = d.get('ai_custom_description', '')
                    desc = d.get('description', '')
                    specs = d.get('specifications', '')
                    usage = d.get('usage_instructions', '')
                    target = d.get('target_audience', '')
                    warranty = d.get('warranty_info', '')
                    return_policy = d.get('return_policy', '')
                    shipping = d.get('shipping_info', '')
                    
                    if ai_desc: item_str += f"\n   - Marketing/AI Desc: {ai_desc}"
                    elif desc: item_str += f"\n   - Description: {desc}"
                    if specs: item_str += f"\n   - Specifications: {specs}"
                    if usage: item_str += f"\n   - Usage Instructions: {usage}"
                    if target: item_str += f"\n   - Target Audience: {target}"
                    if warranty: item_str += f"\n   - Warranty: {warranty}"
                    if return_policy: item_str += f"\n   - Return Policy: {return_policy}"
                    if shipping: item_str += f"\n   - Shipping Info: {shipping}"
                    
                    res_list.append(item_str)
                tool_info = "Database Results:\n" + "\n\n".join(res_list)
                
            # Upgrade 2: Semantic Vector Memory (Search past interactions)
            recalled_memory = ""
            try:
                def fetch_user_memory():
                    mem_ref = db.collection("shops").document(shop_doc_id).collection("customers").document(user_id).collection("vector_memory")
                    return mem_ref.find_nearest(vector_field="embedding", query_vector=Vector(emb_res['embedding']), distance_measure=DistanceMeasure.COSINE, limit=2, distance_threshold=0.2).get()
                mem_docs = await asyncio.to_thread(fetch_user_memory)
                if mem_docs:
                    mem_list = [f"User: {d.to_dict().get('query')} -> AI: {d.to_dict().get('reply')}" for d in mem_docs]
                    recalled_memory = "Recalled Past Context:\n" + "\n".join(mem_list)
            except Exception as e:
                print(f"Semantic memory search error: {e}")
                
            return tool_info, emb_res['embedding'], recalled_memory
        except Exception as e:
            print(f"🔥 Research Phase Error: {e}")
            return "Database Result: Error searching.", None, ""

    # Start research and automation in parallel
    tasks = [
        run_automation_agent(user_msg, media_parts, chat_history, prof, ai_config, shop_info_data, automation_model),
        run_research()
    ]
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    automation_end = time.time()
    print(f"⏱️ Parallel Phase (Automation + Research) took: {automation_end - start_time:.2f}s")
    
    automation_data = results[0] if not isinstance(results[0], Exception) else {}
    research_data = results[1] if not isinstance(results[1], Exception) else ("Database Result: No items found.", None, "")
    
    tool_info, msg_emb, recalled_memory = research_data
    if tool_info is None: tool_info = "Database Result: No items found."
    
    if recalled_memory:
        chat_history = recalled_memory + "\n\n" + chat_history
    
    intent_type = automation_data.get("intent", "PRODUCT_INQUIRY")
    sentiment = "NEUTRAL" 
    reply_text = automation_data.get("reply", "")
    is_complex = automation_data.get("is_complex", False)
    total_tokens_used = automation_data.get("prompt_tokens", 0) + automation_data.get("candidate_tokens", 0)

    # Upgrade 1 & 3: Smart Preference Extraction & Behavioral Tagging
    extracted_prefs = automation_data.get("extracted_preferences", {})
    behavioral_tags = automation_data.get("behavioral_tags", [])
    
    if extracted_prefs or behavioral_tags:
        current_prefs = prof.get("preferences", {})
        if isinstance(current_prefs, dict) and isinstance(extracted_prefs, dict):
            current_prefs.update(extracted_prefs)
            prof["preferences"] = current_prefs
            
        current_tags = prof.get("tags", [])
        if isinstance(current_tags, list) and isinstance(behavioral_tags, list):
            for tag in behavioral_tags:
                if tag not in current_tags:
                    current_tags.append(tag)
            prof["tags"] = current_tags
        
        # Save profile immediately if preferences or tags were updated
        await save_profile(shop_doc_id, user_id, prof)

    # 2. Smart Escalation
    if is_complex or intent_type == "COMPLAINT_OR_HUMAN":
        print(f"⚠️ Escalating to admin due to {sentiment} sentiment / {intent_type} intent.")
        await log_shop_analytics(shop_doc_id, "ESCALATION", {"user_id": user_id, "reason": intent_type})
        await handover_to_admin(acc_id, conv_id, token, admin_id=agent_id, labels=["Complaint", "Urgent"])
        if lang.lower() in ["myanmar", "burmese", "mm"]:
            reply_text = "အဆင်မပြေမှုများအတွက် အထူးတောင်းပန်အပ်ပါတယ်။ လူကြီးမင်းရဲ့ ပြဿနာကို အမြန်ဆုံး ဖြေရှင်းပေးနိုင်ဖို့အတွက် Customer Service ကိုယ်စားလှယ်တစ်ဦးနဲ့ ချိတ်ဆက်ပေးထားပါတယ်။ ခဏစောင့်ပေးပါခင်ဗျာ။"
        else:
            reply_text = "I sincerely apologize for the inconvenience. I have transferred your chat to a human agent who will assist you shortly. Please wait a moment."
        await bg_post(f"{API_HOST}/api/v1/accounts/{acc_id}/conversations/{conv_id}/messages", {"content": reply_text, "message_type": "outgoing"}, token)
        return

    cached_reply = None
    final_data = {}
    should_bypass_cache = (intent_type in ["ORDER", "START_ORDER", "ORDER_CHECKOUT", "COMPLAINT_OR_HUMAN", "SLIP_UPLOAD"])

    if msg_emb:
        try:
            def fetch_cache():
                cache_ref = db.collection("shops").document(shop_doc_id).collection("semantic_cache")
                return cache_ref.find_nearest(vector_field="embedding", query_vector=Vector(msg_emb), distance_measure=DistanceMeasure.COSINE, limit=1, distance_threshold=0.12).get()
            cached_docs = await asyncio.to_thread(fetch_cache)
            if cached_docs: cached_reply = cached_docs[0].to_dict().get('reply')
        except Exception as e: print(f"Semantic cache search error: {e}")

    if cached_reply:
        reply_text, is_complex, total_tokens_used = cached_reply, False, 0
        final_data = {"reply": reply_text, "is_complex": False, "tokens": 0}
        await add_to_history(shop_doc_id, conv_id, "AI", reply_text)
    elif reply_text and not is_complex and intent_type not in ["PRODUCT_INQUIRY", "ORDER", "START_ORDER", "ORDER_CHECKOUT", "SLIP_UPLOAD"]:
        # Use automation agent's reply directly for simple intents
        final_data = {
            "reply": reply_text,
            "is_complex": False,
            "intent": intent_type,
            "prompt_tokens": automation_data.get("prompt_tokens", 0),
            "candidate_tokens": automation_data.get("candidate_tokens", 0)
        }
        await add_to_history(shop_doc_id, conv_id, "AI", reply_text)
    else:
        if order_state in ["COLLECTING", "WAITING_FOR_SLIP", "SUMMARY_SENT"]:
            if order_state == "WAITING_FOR_SLIP" and attachments:
                prof["payment_slip_url"] = attachments[0].get("data_url") or attachments[0].get("url")
                user_msg = "Slip uploaded."
            agent_start = time.time()
            final_data = await run_order_agent(user_msg, prof, ai_config, fast_model_name, chat_history, delivery_info, payment_info, tool_info, currency)
            print(f"⏱️ Order Agent took: {time.time() - agent_start:.2f}s")
            if final_data.get("intent") in ["SUMMARY_SENT", "WAITING_FOR_SLIP", "COLLECTING"]:
                prof["order_state"] = final_data["intent"]
        elif media_parts:
            agent_start = time.time()
            final_data = await run_media_agent(user_msg, tool_info, ai_config, policies, prof, fast_model_name, chat_history, media_parts)
            print(f"⏱️ Media Agent took: {time.time() - agent_start:.2f}s")
        else:
            if order_state == "NONE" and should_bypass_cache:
                prof["order_state"] = "COLLECTING"
                agent_start = time.time()
                final_data = await run_order_agent(user_msg, prof, ai_config, fast_model_name, chat_history, delivery_info, payment_info, tool_info, currency)
                print(f"⏱️ Order Agent (Auto-start) took: {time.time() - agent_start:.2f}s")
                if final_data.get("intent") in ["SUMMARY_SENT", "WAITING_FOR_SLIP", "COLLECTING"]:
                    prof["order_state"] = final_data["intent"]
            else:
                # 4. Personalized Recommendations (Pass past_purchases)
                past_purchases = prof.get("past_purchases", [])
                agent_start = time.time()
                final_data = await run_product_agent(user_msg, tool_info, ai_config, policies, prof, fast_model_name, chat_history, past_purchases)
                print(f"⏱️ Product Agent took: {time.time() - agent_start:.2f}s")
                if final_data.get("intent") == "START_ORDER":
                    prof["order_state"] = "COLLECTING"
                    
                    # UPGRADE: Proper localized prompt instead of system instruction leak
                    if lang.lower() in ["myanmar", "burmese", "mm"]:
                        order_prompt = "အော်ဒါတင်ရန်အတွက် လူကြီးမင်းရဲ့ နာမည်၊ ဖုန်းနံပါတ်၊ ပို့ဆောင်ပေးရမယ့် လိပ်စာနဲ့ ငွေပေးချေမယ့် နည်းလမ်းကို ပြောပြပေးပါရှင်။"
                    else:
                        order_prompt = "To proceed with your order, please provide your Name, Phone Number, Delivery Address, and preferred Payment Method."
                    
                    final_data = {
                        "is_complex": False, 
                        "intent": "COLLECTING", 
                        "extracted": final_data.get("extracted", {}),
                        "reply": order_prompt,
                        "prompt_tokens": final_data.get("prompt_tokens", 0),
                        "candidate_tokens": final_data.get("candidate_tokens", 0)
                    }

        reply_text, is_complex = final_data.get("reply", "..."), final_data.get("is_complex", False)
        prompt_tokens = final_data.get("prompt_tokens", 0)
        candidate_tokens = final_data.get("candidate_tokens", 0)
        total_tokens_used = prompt_tokens + candidate_tokens
        
        print(f"📊 AI USAGE LOG [{shop_doc_id}]:")
        print(f"   - Input (Prompt) Tokens: {prompt_tokens}")
        print(f"   - Output (Candidate) Tokens: {candidate_tokens}")
        print(f"   - Total Tokens: {total_tokens_used}")

        prof.update(final_data.get("extracted", {}))
        await save_profile(shop_doc_id, user_id, prof)
        await add_to_history(shop_doc_id, conv_id, "AI", reply_text)

        async def run_rolling_summarizer():
            if not r: return
            key = f"chat_hist:{shop_doc_id}:{conv_id}"
            try:
                hist_list = await r.lrange(key, 0, -1)
                if len(hist_list) >= 20:
                    older_10, recent_10 = "\n".join(hist_list[:10]), hist_list[10:]
                    prompt = f"Summarize this old chat history concisely in {lang}. Keep important details.\nCurrent Summary: {prof.get('summary', '')}\nOld Chat:\n{older_10}"
                    res = await genai.GenerativeModel(fast_model_name).generate_content_async(prompt)
                    prof["summary"] = res.text.strip()
                    await save_profile(shop_doc_id, user_id, prof)
                    await r.delete(key)
                    if recent_10: await r.rpush(key, *recent_10)
            except Exception as e: print(f"Rolling summarizer error: {e}")
        asyncio.create_task(run_rolling_summarizer())

        if msg_emb and not is_complex and order_state == "NONE" and final_data.get("intent") != "START_ORDER":
            try: db.collection("shops").document(shop_doc_id).collection("semantic_cache").add({"query": user_msg, "reply": reply_text, "embedding": Vector(msg_emb)})
            except Exception as e: print(f"Semantic cache save error: {e}")

    msg_payload = {"content": reply_text, "message_type": "outgoing"}
    if is_complex:
        msg_payload["content_type"] = "input_select"
        msg_payload["content_attributes"] = {"items": [{"title": "📞 Talk to Human", "value": "support"}]}
    elif final_data.get("intent") == "SUMMARY_SENT":
        msg_payload["content_type"] = "input_select"
        msg_payload["content_attributes"] = {"items": [{"title": "✅ Confirm", "value": "confirm"}, {"title": "✏️ Edit", "value": "edit"}]}

    if is_complex:
        if final_data.get("intent") == "ORDER_CONFIRMED":
            await log_shop_analytics(shop_doc_id, "ORDER_CONFIRMED", {"user_id": user_id, "total_price": prof.get('total_price', 0)})
            items_str = ", ".join(prof.get("items", []))
            custom_attributes_data = {"custom_attributes": {"order_items": items_str, "customer_phone": prof.get('phone', ''), "delivery_address": prof.get('address', ''), "payment_method": prof.get('payment_method', '')}}
            try:
                async with httpx.AsyncClient() as client:
                    await client.post(f"{API_HOST}/api/v1/accounts/{acc_id}/conversations/{conv_id}/custom_attributes", json=custom_attributes_data, headers={"api_access_token": token})
                    await client.put(f"{API_HOST}/api/v1/accounts/{acc_id}/contacts/{user_id}", json={"custom_attributes": {"customer_phone": prof.get('phone', ''), "delivery_address": prof.get('address', '')}}, headers={"api_access_token": token})
            except Exception as e: print(f"Chatwoot custom attributes update error: {e}")

            try:
                doc_ref = db.collection("shops").document(shop_doc_id).collection("orders").document()
                doc_ref.set({
                    "order_id": doc_ref.id, "customer_name": prof.get('name', ''), "customer_phone": prof.get('phone', ''),
                    "customer_address": prof.get('address', ''), "items": prof.get('items', []), "payment_method": prof.get('payment_method', ''),
                    "deli_charge": prof.get('deli_charge', 0), "total_price": prof.get('total_price', 0), "payment_slip_url": prof.get('payment_slip_url', ''),
                    "status": "pending", "chatwoot_acc_id": acc_id, "chatwoot_conv_id": conv_id, "created_at": datetime.now(timezone.utc).isoformat()
                })
            except Exception as e: print(f"Firestore order save error: {e}")

            note = f"📝 **New Order Alert!**\n👤 {prof.get('name')}\n📞 {prof.get('phone')}\n📍 {prof.get('address')}\n💳 {prof.get('payment_method')}\n🚚 Deli: {prof.get('deli_charge')} {currency}\n💰 Total: {prof.get('total_price')} {currency}\n📦 {items_str}"
            if prof.get('payment_slip_url'): note += f"\n🧾 Slip: {prof.get('payment_slip_url')}"
            await bg_post(f"{API_HOST}/api/v1/accounts/{acc_id}/conversations/{conv_id}/messages", {"content": note, "message_type": "outgoing", "private": True}, token)
            await handover_to_admin(acc_id, conv_id, token, admin_id=agent_id, labels=["orderconfirm"])
            
            # Save past purchases for future recommendations
            past_purchases = prof.get("past_purchases", [])
            if not isinstance(past_purchases, list): past_purchases = []
            
            new_purchase = {
                "items": prof.get('items', []),
                "total_price": prof.get('total_price', 0),
                "date": datetime.now(timezone.utc).isoformat()
            }
            past_purchases.append(new_purchase)
            
            prof.update({"order_state": "NONE", "items": [], "payment_slip_url": "", "deli_charge": 0, "total_price": 0, "past_purchases": past_purchases})
            await save_profile(shop_doc_id, user_id, prof)
            
            # Upgrade 4: Context Reset (Clear short-term memory after order)
            try:
                if r: await r.delete(f"chat_hist:{shop_doc_id}:{conv_id}")
            except Exception as e:
                print(f"Error resetting chat history: {e}")
        else:
            await handover_to_admin(acc_id, conv_id, token, admin_id=agent_id, labels=["Human Requested"])

    asyncio.create_task(bg_post(typing_url, {"typing_status": "off"}, token))
    
    # Upgrade 2: Save to Semantic Vector Memory
    if msg_emb and user_msg and reply_text:
        try:
            db.collection("shops").document(shop_doc_id).collection("customers").document(user_id).collection("vector_memory").add({
                "query": user_msg,
                "reply": reply_text,
                "embedding": Vector(msg_emb),
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        except Exception as e:
            print(f"Error saving to vector memory: {e}")
            
    # Remove previous buttons if any
    last_btn_id = prof.get("last_button_msg_id")
    if last_btn_id:
        async def remove_old_buttons():
            try:
                async with httpx.AsyncClient() as client:
                    await client.patch(f"{API_HOST}/api/v1/accounts/{acc_id}/conversations/{conv_id}/messages/{last_btn_id}", 
                                      json={"content_attributes": {}}, 
                                      headers={"api_access_token": token})
            except Exception as e: print(f"Error removing old buttons: {e}")
        asyncio.create_task(remove_old_buttons())
        prof["last_button_msg_id"] = ""
        await save_profile(shop_doc_id, user_id, prof)

    resp = await bg_post(f"{API_HOST}/api/v1/accounts/{acc_id}/conversations/{conv_id}/messages", msg_payload, token, timeout=15.0)
    if resp and resp.status_code == 200:
        msg_id = resp.json().get("id")
        if msg_payload.get("content_type") == "input_select" and msg_id:
            prof["last_button_msg_id"] = str(msg_id)
            await save_profile(shop_doc_id, user_id, prof)

    await increment_shop_tokens(acc_id, total_tokens_used)

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8001)
