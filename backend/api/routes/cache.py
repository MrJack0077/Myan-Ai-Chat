import asyncio
from fastapi import APIRouter
from pydantic import BaseModel
from utils import db, r, EMBEDDING_MODEL_NAME
from google import genai
from utils.config import genai_client, studio_client

router = APIRouter(prefix="/api", tags=["Cache"])

class EmbedRequest(BaseModel):
    text: str

@router.post("/embed")
async def embed_text(req: EmbedRequest):
    """Generate embedding for product text via google-genai SDK (Vertex AI + AI Studio fallback)."""
    if not req.text.strip():
        return {"status": "error", "message": "Empty text"}
    try:
        # ⚡ AI Studio first (faster, no quota) — fallback to Vertex AI
        embed_client = studio_client or genai_client
        emb_config = genai.types.EmbedContentConfig(
            task_type='RETRIEVAL_DOCUMENT',
            output_dimensionality=768,
        )
        emb_res = await embed_client.aio.models.embed_content(
            model=EMBEDDING_MODEL_NAME,
            contents=[req.text],
            config=emb_config,
        )
        if emb_res and emb_res.embeddings:
            return {"status": "success", "embedding": emb_res.embeddings[0].values, "provider": "vertex"}
    except Exception as e:
        print(f"Embedding failed, trying API key fallback: {e}")
    # Fallback to API Key mode
    try:
        from google import genai
        if studio_client:
            emb_res2 = await studio_client.aio.models.embed_content(
                model=EMBEDDING_MODEL_NAME,
                contents=[req.text],
                config=genai.types.EmbedContentConfig(
                    task_type='RETRIEVAL_DOCUMENT',
                    output_dimensionality=768,
                ),
            )
            return {"status": "success", "embedding": emb_res2.embeddings[0].values, "provider": "studio"}
    except Exception as e2:
        print(f"Studio fallback also failed: {e2}")
    return {"status": "error", "message": str(e) if 'e' in dir() else "Unknown embedding error"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

class CleanHistoryOptions(BaseModel):
    redis: bool = False
    firestore_customers: bool = False
    firestore_semantic: bool = False

@router.post("/clear-cache/{target_id}/history")
async def clean_history_endpoint(target_id: str, options: CleanHistoryOptions):
    results = {"status": "success", "messages": []}
    
    if options.redis and r:
        try:
            hist_keys = await r.keys(f"chat_hist:{target_id}:*")
            if hist_keys:
                await r.delete(*hist_keys)
            
            prof_keys = await r.keys(f"prof:{target_id}:*")
            if prof_keys:
                await r.delete(*prof_keys)
                
            results["messages"].append("Redis chat history & profiles cleared.")
        except Exception as e:
            results["messages"].append(f"Redis clean error: {e}")

    if db:
        if options.firestore_customers:
            try:
                def delete_customers():
                    for d in db.collection("shops").document(target_id).collection("customers").stream():
                        d.reference.delete()
                await asyncio.to_thread(delete_customers)
                results["messages"].append("Firestore tracking (customers) cleared.")
            except Exception as e:
                results["messages"].append(f"Firestore customers clean error: {e}")

        if options.firestore_semantic:
            try:
                def delete_semantic():
                    for d in db.collection("shops").document(target_id).collection("semantic_cache").stream():
                        d.reference.delete()
                await asyncio.to_thread(delete_semantic)
                results["messages"].append("Firestore semantic cache cleared.")
            except Exception as e:
                results["messages"].append(f"Firestore semantic clean error: {e}")

    return results

@router.get("/clear-cache/{target_id}")
async def clear_cache_endpoint(target_id: str):
    if not r:
        return {"status": "error", "message": "Redis Database နှင့် ချိတ်ဆက်မှု မရှိပါ။"}

    from core.cache_manager import invalidate_shop_caches, cache_set, TTL_WARM
    import json

    # Try both: target_id might be acc_id (SendPulse bot ID) or shop_doc_id (Firestore doc ID)
    actual_acc_id = target_id
    shop_doc_id = target_id

    # If target_id is a Firestore shop document ID, resolve the acc_id
    try:
        if db:
            doc_ref = db.collection("shops").document(target_id)
            doc = doc_ref.get()
            if doc.exists:
                data = doc.to_dict()
                bot_ids = data.get("sendpulseBotIds", [])
                actual_acc_id = bot_ids[0] if bot_ids else ""
                shop_doc_id = doc.id
                
                if actual_acc_id:
                    # Central invalidation
                    await invalidate_shop_caches(shop_doc_id, acc_id=actual_acc_id)
                    
                    # Rebuild shop data cache immediately
                    bots = data.get("sendpulseBots", [])
                    channel = "telegram"
                    for b in bots:
                        if b.get("id") == str(actual_acc_id):
                            channel = b.get("channel", "telegram")
                    
                    shop_data = {
                        "shop_info": data,
                        "client_id": data.get("sendpulseClientId"),
                        "client_secret": data.get("sendpulseClientSecret"),
                        "channel": channel,
                        "shop_doc_id": doc.id,
                        "ai_config": data.get("aiConfig", {}),
                        "policies": data.get("policies", {}),
                        "agentId": data.get("agentId")
                    }
                    await cache_set(f"shop_data_v2:{actual_acc_id}", json.dumps(shop_data), TTL_WARM)
                    
                    return {"status": "success", "message": f"Shop ID ({target_id}) ၏ Cache ကို အောင်မြင်စွာ Update လုပ်ပြီးပါပြီ။ Live update ချက်ချင်း အသက်ဝင်ပါမည်။"}
    except Exception as e:
        print(f"Cache clear lookup error: {e}")

    # Fallback: just delete the shop_data_v2 key directly
    await invalidate_shop_caches(target_id, acc_id=target_id)
    return {"status": "success", "message": f"ID ({target_id}) အတွက် Cache ရှင်းလင်းမှု လုပ်ဆောင်ပြီးပါပြီ။"}

@router.get("/debug/redis")
async def debug_redis():
    if not r:
        return {"status": "error", "message": "Redis not initialized (None)"}
    try:
        res = {
            "ping": await r.ping(),
            "queue_len": await r.llen("sendpulse_task_queue"),
            "keys_count": len(await r.keys("*")),
            "sample_keys": (await r.keys("*"))[:50]
        }
        return res
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.get("/api/debug/shops")
async def debug_shops():
    if not db:
        return {"status": "error", "message": "Firestore not initialized"}
    try:
        def fetch():
            docs = db.collection("shops").get()
            return [{"id": d.id, "sendpulseBotIds": d.to_dict().get("sendpulseBotIds", [])} for d in docs]
        shops = await asyncio.to_thread(fetch)
        return {"shops": shops}
    except Exception as e:
        return {"status": "error", "message": str(e)}
