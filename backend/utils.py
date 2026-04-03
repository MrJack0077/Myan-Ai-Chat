import os
import json
import hmac
import hashlib
import asyncio
import httpx
import re
import google.generativeai as genai
import redis.asyncio as aioredis
from datetime import datetime, timezone, timedelta
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from google.cloud.firestore_v1.vector import Vector
from google.cloud.firestore_v1.base_vector_query import DistanceMeasure
from dotenv import load_dotenv
from tenacity import retry, wait_exponential, stop_after_attempt

load_dotenv()

sa_path = os.getenv("SERVICE_ACCOUNT_PATH")
if sa_path:
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = sa_path

try:
    db = firestore.Client(project="myanaichat")
    print("✅ DEBUG: Firestore initialized.")
except Exception as e:
    print(f"🔥 Firestore Error: {e}")
    db = None

try:
    r = aioredis.from_url(
        f"redis://{os.getenv('REDIS_HOST', 'localhost')}:{os.getenv('REDIS_PORT', 6379)}/{os.getenv('REDIS_DB', 0)}",
        decode_responses=True
    )
    print("✅ DEBUG: Async Redis connected.")
except Exception as e:
    print(f"🔥 Redis Error: {e}")
    r = None

def verify_chatwoot_signature(payload_body: bytes, signature_header: str, webhook_token: str) -> bool:
    if not signature_header or not webhook_token:
        return True
    calculated_signature = hmac.new(webhook_token.encode('utf-8'), payload_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(calculated_signature, signature_header)

@retry(wait=wait_exponential(multiplier=1, min=1, max=10), stop=stop_after_attempt(2))
async def robust_api_post(url, json_data, token, timeout=7.0):
    async with httpx.AsyncClient() as client:
        res = await client.post(
            url,
            json=json_data,
            headers={"api_access_token": token, "Content-Type": "application/json"},
            timeout=timeout
        )
        res.raise_for_status()
        return res

async def bg_post(url, json_data, token, timeout=7.0):
    try:
        return await robust_api_post(url, json_data, token, timeout=timeout)
    except Exception as e:
        print(f"📡 API FAILED AFTER RETRIES: {e}")
        return None

async def get_shop_data(acc_id):
    cache_key = f"shop_data_v2:{acc_id}"
    if r:
        try:
            cached = await r.get(cache_key)
            if cached:
                data = json.loads(cached)
                if isinstance(data, dict) and "shop_doc_id" in data:
                    return data
        except Exception as e:
            print(f"Redis get error: {e}")

    if not db: return None

    def fetch_db():
        shops = db.collection("shops").where(filter=FieldFilter("chatwootAccountId", "==", acc_id)).limit(1).get()
        if not shops: return None
        shop_doc = shops[0]
        data = shop_doc.to_dict()
        return {
            "shop_info": data,
            "token": data.get("chatwootToken"),
            "shop_doc_id": shop_doc.id,
            "ai_config": data.get("aiConfig", {}),
            "policies": data.get("policies", {}),
            "agentId": data.get("agentId")
        }

    shop_data = await asyncio.to_thread(fetch_db)

    if shop_data and r:
        try:
            await r.setex(cache_key, 600, json.dumps(shop_data))
        except Exception as e:
            print(f"Redis set error: {e}")

    return shop_data

async def handover_to_admin(acc_id, conv_id, token, admin_id=None, labels=None):
    if labels is None:
        labels = ["Human Requested"]

    api_host = os.getenv("API_HOST", "https://allchat.ddnsfree.com")
    url = f"{api_host}/api/v1/accounts/{acc_id}/conversations/{conv_id}"

    await bg_post(f"{url}/toggle_status", {"status": "open"}, token)
    await bg_post(f"{url}/labels", {"labels": labels}, token)

    if admin_id:
        await bg_post(f"{url}/assignments", {"assignee_id": int(str(admin_id).strip())}, token)

async def increment_shop_tokens(acc_id, tokens):
    if not db or tokens <= 0: return
    def inc():
        try:
            shops = db.collection("shops").where(filter=FieldFilter("chatwootAccountId", "==", acc_id)).limit(1).get()
            if shops:
                db.collection("shops").document(shops[0].id).update({"usedTokens": firestore.Increment(tokens)})
        except Exception as e:
            print(f"💰 Token Update Error: {e}")
    await asyncio.to_thread(inc)

async def summarize_chat_history(shop_id, conv_id, history_list, prof, base_model_name="models/gemini-3.1-flash-lite-preview"):
    """Summarize long chat history and save to profile"""
    try:
        full_text = "\n".join(history_list)
        sys_prompt = "Summarize the customer's preferences, key details, and current context from this chat history in 2-3 short sentences. Focus on what a sales agent needs to remember."
        model = genai.GenerativeModel(base_model_name)
        res = await model.generate_content_async(
            contents=[sys_prompt, f"History:\n{full_text}"],
            generation_config=genai.GenerationConfig(temperature=0.2)
        )
        summary = res.text.strip()
        prof["summary"] = summary
        
        # Keep only the last 4 messages in Redis, clear the rest
        key = f"chat_hist:{shop_id}:{conv_id}"
        await r.ltrim(key, -4, -1)
        
        # Save profile
        prof["last_updated"] = datetime.now(timezone.utc).isoformat()
        if r: await r.set(f"prof:{shop_id}:{conv_id}", json.dumps(prof))
        def save_db():
            db.collection("shops").document(shop_id).collection("customers").document(conv_id).set(prof)
        await asyncio.to_thread(save_db)
        print(f"✅ Chat history summarized for {conv_id}")
    except Exception as e:
        print(f"Summarization Error: {e}")

async def add_to_history(shop_id, conv_id, role, message):
    if not r or not message: return
    key = f"chat_hist:{shop_id}:{conv_id}"
    entry = f"{role}: {message}"
    try:
        await r.rpush(key, entry)
        # We will keep up to 20 messages, but summarize if it hits 15
        await r.ltrim(key, -20, -1)
    except Exception as e:
        print(f"Redis history add error: {e}")

async def get_history(shop_id, conv_id, prof=None):
    if not r: return ""
    key = f"chat_hist:{shop_id}:{conv_id}"
    try:
        history_list = await r.lrange(key, 0, -1)
        if not history_list:
            return "No previous chat history."

        # Trigger summarization if history is getting long (e.g., > 12 messages)
        if len(history_list) > 12 and prof is not None:
            asyncio.create_task(summarize_chat_history(shop_id, conv_id, history_list, prof))

        # ⚡ နောက်ဆုံး စာကြောင်း (၄) ကြောင်းကိုသာ AI ထံ ပို့ပေးမည် (Token ချွေတာရန်)
        recent_4 = history_list[-4:]
        return "\n".join(recent_4)
    except Exception as e:
        print(f"Redis history get error: {e}")
        return ""

async def check_rate_limit(shop_id, limit=30, window=60):
    """Per-shop rate limiting using Redis (Token Bucket / Fixed Window)"""
    if not r: return True
    key = f"rate_limit:{shop_id}"
    try:
        current = await r.incr(key)
        if current == 1:
            await r.expire(key, window)
        if current > limit:
            return False
        return True
    except Exception as e:
        print(f"Rate limit error: {e}")
        return True

async def log_shop_analytics(shop_id, event_type, details):
    """Log per-shop analytics for monitoring"""
    if not db: return
    try:
        def log_db():
            db.collection("shops").document(shop_id).collection("analytics").add({
                "event_type": event_type,
                "details": details,
                "timestamp": firestore.SERVER_TIMESTAMP
            })
        await asyncio.to_thread(log_db)
    except Exception as e:
        print(f"Analytics log error: {e}")

async def classify_message_intent(user_msg, base_model_name):
    """Classify user intent and sentiment using a fast LLM call"""
    sys_prompt = "Analyze the customer message. Return JSON with 'intent' (GREETING, PRODUCT_INQUIRY, SHOP_POLICY_PRIVACY, ORDER_CHECKOUT, COMPLAINT_OR_HUMAN, MEDIA, OTHER) and 'sentiment' (POSITIVE, NEUTRAL, NEGATIVE)."
    try:
        model = genai.GenerativeModel(base_model_name)
        res = await model.generate_content_async(
            contents=[sys_prompt, f"Message: {user_msg}"],
            generation_config=genai.GenerationConfig(response_mime_type="application/json", temperature=0.1)
        )
        clean_json = re.sub(r'```json\n|\n```|```', '', res.text).strip()
        data = json.loads(clean_json)
        if isinstance(data, dict): return data
        return {"intent": "PRODUCT_INQUIRY", "sentiment": "NEUTRAL"}
    except Exception as e:
        print(f"Intent Classification Error: {e}")
        return {"intent": "PRODUCT_INQUIRY", "sentiment": "NEUTRAL"}

async def hybrid_search_items(shop_doc_id, user_msg, msg_emb, limit=4):
    """Combine Vector Search with Keyword Re-ranking"""
    if not db: return []
    try:
        def fetch_vector():
            items_ref = db.collection("shops").document(shop_doc_id).collection("items")
            return items_ref.find_nearest(
                vector_field="embedding", 
                query_vector=Vector(msg_emb), 
                distance_measure=DistanceMeasure.COSINE, 
                limit=10
            ).get()
        
        docs = await asyncio.to_thread(fetch_vector)
        if not docs: return []

        user_words = set(re.findall(r'\w+', user_msg.lower()))
        scored_docs = []
        
        for d in docs:
            data = d.to_dict()
            if not data.get('is_available', True): continue
            
            score = 0
            name = data.get('name', '').lower()
            category = data.get('category', '').lower()
            keywords = data.get('ai_keywords', '').lower()
            
            # Boost score if exact words match
            for w in user_words:
                if len(w) > 2 and (w in name or w in category or w in keywords):
                    score += 1
            
            scored_docs.append((score, data))

        # Sort by keyword score (descending), then take top `limit`
        scored_docs.sort(key=lambda x: x[0], reverse=True)
        return [d[1] for d in scored_docs[:limit]]
    except Exception as e:
        print(f"Hybrid Search Error: {e}")
        return []
