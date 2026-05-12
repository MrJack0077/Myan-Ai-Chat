import json
import asyncio
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from .config import db, r
from core.cache_manager import cache_get, cache_set, TTL_WARM

async def get_shop_data(acc_id):
    """Get shop data from Redis cache (TTL 120s) or Firestore."""
    cache_key = f"shop_data_v2:{acc_id}"
    
    cached = await cache_get(cache_key)
    if cached:
        try:
            data = json.loads(cached)
            if isinstance(data, dict) and "shop_doc_id" in data:
                if not data.get("shop_info", {}).get("disableCache", False):
                    return data
        except Exception:
            pass

    if not db: return None

    def fetch_db():
        try:
            shops = db.collection("shops").where(filter=FieldFilter("sendpulseBotIds", "array_contains", str(acc_id))).limit(1).get()
            if not shops:
                try: shops = db.collection("shops").where(filter=FieldFilter("sendpulseBotIds", "array_contains", int(acc_id))).limit(1).get()
                except ValueError: pass
            
            if not shops: return None
            
            shop_doc = shops[0]
            data = shop_doc.to_dict()
            channel = "telegram"
            for b in data.get("sendpulseBots", []):
                if str(b.get("id")) == str(acc_id):
                    channel = b.get("channel", "telegram")
            
            return {
                "shop_info": data,
                "client_id": data.get("sendpulseClientId"),
                "client_secret": data.get("sendpulseClientSecret"),
                "channel": channel,
                "shop_doc_id": shop_doc.id,
                "ai_config": data.get("aiConfig", {}),
                "policies": data.get("policies", {}),
                "agentId": data.get("agentId")
            }
        except: return None

    shop_data = await asyncio.to_thread(fetch_db)

    if shop_data and r:
        if not shop_data.get("shop_info", {}).get("disableCache", False):
            await cache_set(cache_key, json.dumps(shop_data), TTL_WARM)

    return shop_data

async def increment_shop_tokens(acc_id, tokens):
    if not db or tokens <= 0: return
    def inc():
        try:
            shops = db.collection("shops").where(filter=FieldFilter("sendpulseBotIds", "array_contains", acc_id)).limit(1).get()
            if shops:
                db.collection("shops").document(shops[0].id).update({"usedTokens": firestore.Increment(tokens)})
        except: pass
    await asyncio.to_thread(inc)

async def log_shop_analytics(shop_id, event_type, details):
    if not db: return
    def log_db():
        try:
            db.collection("shops").document(shop_id).collection("analytics").add({
                "event_type": event_type,
                "details": details,
                "timestamp": firestore.SERVER_TIMESTAMP
            })
        except: pass
    await asyncio.to_thread(log_db)