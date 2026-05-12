"""Embedding-based semantic research and cache management."""
import json
import asyncio
import time
from datetime import datetime, timezone, timedelta
import google.generativeai as genai
from google.cloud.firestore_v1.vector import Vector
from google.cloud.firestore_v1.base_vector_query import DistanceMeasure
from utils import db, hybrid_search_items, increment_shop_tokens, FAST_MODEL_NAME, EMBEDDING_MODEL_NAME

# Distance thresholds for semantic cache trust
CACHE_TRUST_DISTANCE  = 0.08   # distance < 0.08 → trust without AI validation
CACHE_CHECK_DISTANCE  = 0.15   # distance < 0.15 → AI validation required
CACHE_MAX_AGE_SECONDS = 604800 # 7 days — older entries auto-ignored


async def run_embedding_search(user_msg, shop_doc_id, currency):
    """Run embedding and hybrid item search."""
    if not user_msg:
        return "No items", None

    try:
        try:
            emb_res = await genai.embed_content_async(
                model=EMBEDDING_MODEL_NAME, content=user_msg,
                task_type='retrieval_query', output_dimensionality=768,
            )
        except Exception as e:
            print(f"Embedding API Error: {e}")
            return "No items", None

        docs = await hybrid_search_items(shop_doc_id, user_msg, emb_res['embedding'], limit=5)

        if docs:
            res_list = []
            for d in docs:
                stock = int(d.get('stock_quantity') or 0)
                status = "OUT OF STOCK" if stock <= 0 else f"In Stock ({stock})"
                desc = d.get('description', '')
                ai_desc = d.get('ai_custom_description', '')
                ai_keys = d.get('ai_keywords', '')
                usage = d.get('usage_instructions', '')
                specs = d.get('specifications', '')
                images = d.get('image_url') or d.get('images', [])
                if isinstance(images, list):
                    images = ','.join(images)
                img_str = f" | Image: {images}" if images else ""
                
                def truncate(text, length=500):
                    if not text: return ""
                    return text[:length] + "..." if len(text) > length else text

                info_parts = [f"📦 Name: {d.get('name')} | Price: {d.get('price')} {currency} | Status: {status}"]
                if desc: info_parts.append(f"Desc: {truncate(desc)}")
                if ai_desc: info_parts.append(f"AI Desc: {truncate(ai_desc, 300)}")
                if ai_keys: info_parts.append(f"Keywords: {truncate(ai_keys, 200)}")
                if specs: info_parts.append(f"Specs: {truncate(specs, 300)}")
                if usage: info_parts.append(f"Usage: {truncate(usage, 300)}")
                info_parts.append(img_str)
                
                res_list.append(" | ".join(filter(None, info_parts)))
            tool_info = "Database Results:\n" + "\n\n".join(res_list)
        else:
            tool_info = "Database Result: No items found."

        return tool_info, emb_res['embedding']
    except Exception as e:
        print(f"🔥 Research Error: {e}")
        return "No items", None


async def check_semantic_cache(shop_doc_id, user_msg, msg_emb, intent_type, order_state, acc_id):
    """
    Check semantic cache with tiered validation:
    - distance < CACHE_TRUST_DISTANCE (0.08) → trust immediately (no AI call)
    - distance < CACHE_CHECK_DISTANCE (0.15) → AI validation required
    - distance >= CACHE_CHECK_DISTANCE or expired → miss
    
    Only caches for FAQ-like intents when order state is NONE.
    """
    if not msg_emb or intent_type in ["GREETING", "START_ORDER", "SLIP_UPLOAD"] or order_state != "NONE":
        return None

    try:
        def fetch_cache():
            cache_ref = db.collection("shops").document(shop_doc_id).collection("semantic_cache")
            return cache_ref.find_nearest(
                vector_field="embedding",
                query_vector=Vector(msg_emb),
                distance_measure=DistanceMeasure.COSINE,
                limit=1,
                distance_threshold=CACHE_CHECK_DISTANCE,
            ).get()

        cached_docs = await asyncio.to_thread(fetch_cache)
        if not cached_docs:
            return None

        # Firestore returns distance on the document
        raw_cache = cached_docs[0].to_dict()
        distance = getattr(cached_docs[0], '_distance', CACHE_CHECK_DISTANCE)
        potential_reply = raw_cache.get('reply')
        created_at = raw_cache.get('created_at', '')

        # Check TTL: expire entries older than 7 days
        if created_at:
            try:
                created_dt = datetime.fromisoformat(created_at)
                if (datetime.now(timezone.utc) - created_dt).total_seconds() > CACHE_MAX_AGE_SECONDS:
                    # Delete expired entry in background
                    asyncio.create_task(_delete_expired_cache(shop_doc_id, cached_docs[0].id))
                    return None
            except (ValueError, TypeError):
                pass

        # ── Tier 1: Trust low-distance matches (no AI validation) ──
        if distance < CACHE_TRUST_DISTANCE:
            print(f"🎯 Cache Hit (TRUSTED, dist={distance:.4f}): {user_msg[:30]}...")
            return potential_reply

        # ── Tier 2: Medium distance → AI validation ──
        print(f"🔍 Cache Hit (VALIDATING, dist={distance:.4f}): {user_msg[:30]}...")
        verify_sys = """
Role: Semantic Cache Validator.
Task: Decide if the 'Cached Answer' correctly and naturally answers the 'Current User Question'.
Return JSON: {"decision": "VALID" | "INVALID"}
"""
        verify_prompt = f"Current User Question: {user_msg}\nCached Answer: {potential_reply}\nDecision (JSON):"

        v_model = genai.GenerativeModel(FAST_MODEL_NAME)
        v_res = await v_model.generate_content_async(
            contents=[verify_sys, verify_prompt],
            generation_config=genai.GenerationConfig(response_mime_type="application/json", temperature=0.1),
        )
        v_data = json.loads(v_res.text.strip())

        if v_data.get("decision") == "VALID":
            print(f"🎯 Cache Hit Verified! (dist={distance:.4f})")
            await increment_shop_tokens(acc_id, v_res.usage_metadata.total_token_count)
            return potential_reply
        else:
            # Delete invalid cache entry
            asyncio.create_task(_delete_expired_cache(shop_doc_id, cached_docs[0].id))
    except Exception as ce:
        print(f"⚠️ Semantic Cache Error: {ce}")

    return None


async def _delete_expired_cache(shop_doc_id, doc_id):
    """Delete an expired or invalid cache entry."""
    try:
        db.collection("shops").document(shop_doc_id).collection("semantic_cache").document(doc_id).delete()
        print(f"🗑️ Deleted expired/invalid cache entry: {doc_id}", flush=True)
    except Exception:
        pass


def save_to_semantic_cache_async(shop_doc_id, user_msg, reply_text, msg_emb, intent_type, final_data):
    """Fire-and-forget save to semantic cache. Adds TTL (created_at) for later cleanup."""
    cacheable_intents = ["POLICY_FAQ", "DELIVERY", "PAYMENT", "PRODUCT_INQUIRY"]
    if intent_type not in cacheable_intents and final_data.get("intent") not in cacheable_intents:
        return

    now_iso = datetime.now(timezone.utc).isoformat()

    async def _save():
        try:
            db.collection("shops").document(shop_doc_id).collection("semantic_cache").add({
                "query": user_msg,
                "reply": reply_text,
                "embedding": Vector(msg_emb),
                "intent": intent_type,
                "created_at": now_iso,
            })
            print(f"💾 New Knowledge Cached: {user_msg[:30]}...")
        except Exception as e:
            print(f"Cache Save Error: {e}")

    asyncio.create_task(_save())
