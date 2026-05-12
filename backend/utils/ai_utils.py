import re
import json
import asyncio
import google.generativeai as genai
from google.cloud.firestore_v1.vector import Vector
from google.cloud.firestore_v1.base_vector_query import DistanceMeasure
from .config import db, BASE_MODEL_NAME

def filter_knowledge_base(kb, user_msg, max_items=5):
    if not kb or not user_msg: return kb[:max_items] if kb else []
    user_words = set(re.findall(r'\w+', user_msg.lower()))
    if not user_words: return kb[:max_items]
        
    scored_kb = []
    for k in kb:
        content = k.get('content', '') + " " + k.get('title', '') if isinstance(k, dict) else str(k)
        score = len(user_words.intersection(set(re.findall(r'\w+', content.lower()))))
        scored_kb.append((score, k))
        
    scored_kb.sort(key=lambda x: x[0], reverse=True)
    return [item for score, item in scored_kb][:max_items]

async def classify_message_intent(user_msg, base_model_name=None):
    sys_prompt = "Analyze the customer message. Return JSON with 'intent' (GREETING, PRODUCT_INQUIRY, SHOP_POLICY_PRIVACY, ORDER_CHECKOUT, COMPLAINT_OR_HUMAN, MEDIA, OTHER) and 'sentiment' (POSITIVE, NEUTRAL, NEGATIVE)."
    try:
        model = genai.GenerativeModel(base_model_name or BASE_MODEL_NAME)
        res = await model.generate_content_async(
            contents=[sys_prompt, f"Message: {user_msg}"],
            generation_config=genai.GenerationConfig(response_mime_type="application/json", temperature=0.1)
        )
        clean_json = re.sub(r'```json\n|\n```|```', '', res.text).strip()
        data = json.loads(clean_json)
        if isinstance(data, dict): return data
    except: pass
    return {"intent": "PRODUCT_INQUIRY", "sentiment": "NEUTRAL"}

async def hybrid_search_items(shop_doc_id, user_msg, msg_emb, limit=4):
    if not db: return []
    try:
        import math
        def cosine_sim(v1, v2):
            if not v1 or not v2 or len(v1) != len(v2): return 0
            dot = sum(a * b for a, b in zip(v1, v2))
            m1 = math.sqrt(sum(a * a for a in v1))
            m2 = math.sqrt(sum(b * b for b in v2))
            if m1 == 0 or m2 == 0: return 0
            return dot / (m1 * m2)

        def fetch_vector():
            try:
                # Try simple fetch first to verify collection has data
                test_docs = list(db.collection("shops").document(shop_doc_id).collection("items").limit(5).stream())
                print(f"📊 DEBUG: Manual collection stream found {len(test_docs)} docs.")
                
                # Try vector search
                return db.collection("shops").document(shop_doc_id).collection("items").find_nearest(
                    vector_field="embedding", query_vector=Vector(msg_emb), 
                    distance_measure=DistanceMeasure.COSINE, limit=10
                ).get(), True
            except Exception as e:
                print(f"⚠️ Vector search failed (missing index?), falling back to regular fetch: {e}")
                # Fallback: get recent/all active items and score them
                return list(db.collection("shops").document(shop_doc_id).collection("items").limit(50).stream()), False
        
        docs, used_vector_index = await asyncio.to_thread(fetch_vector)
        print(f"🔍 DEBUG: hybrid_search_items RAW DOCS FETCHED: {len(docs)} for shop {shop_doc_id}")
        
        if len(docs) > 0:
            sample_data = docs[0].to_dict()
            print(f"   - Sample Item Keys: {list(sample_data.keys())}")
            print(f"   - Sample Item Available: {sample_data.get('is_available')}")
        
        if not docs: 
            print(f"❌ DEBUG: No documents found at all in 'items' collection for shop {shop_doc_id}. Please check if the collection name is correct (should be 'items').")
            return []

        user_words = set(re.findall(r'\w+', user_msg.lower()))
        scored_docs = []
        
        for i, doc_obj in enumerate(docs):
            data = doc_obj.to_dict()
            # If the item explicitly says unavailable, skip it. Default to True if missing.
            is_avail = data.get('is_available')
            if is_avail is False: continue 
            
            score = 0
            name = data.get('name', '').lower()
            category = data.get('category', '').lower()
            brand = data.get('brand', '').lower()
            description = data.get('description', '').lower()
            keywords = data.get('ai_keywords', '').lower()
            
            # 1. Direct Keyword Matching (High Boost)
            for word in user_words:
                if len(word) < 2: continue
                # Exact name match
                if word in name: score += 10
                # Category match
                if word in category: score += 5
                # Brand match
                if word in brand: score += 5
                # Description/Keywords
                if word in description or word in keywords: score += 2
            
            # 2. Vector Similarity Score (if fallback)
            if not used_vector_index:
                doc_emb = data.get('embedding')
                if doc_emb:
                    try:
                        # Handle Firestore Vector type to list conversion
                        doc_emb_list = list(doc_emb) if hasattr(doc_emb, '__iter__') else []
                        if hasattr(doc_emb, 'to_map_value'): doc_emb_list = list(doc_emb)
                            
                        similarity = cosine_sim(msg_emb, doc_emb_list)
                        score += similarity * 20 # Weight similarity heavily
                    except Exception as e:
                        # print(f"DEBUG: cosine_sim failed: {e}")
                        pass
            else:
                # Firestore already sorted them, add rank-based boost
                score += (len(docs) - i) * 3
            
            # Minimum threshold to include result
            if score > 0:
                scored_docs.append((score, data))

        # Sort by total score descending
        scored_docs.sort(key=lambda x: x[0], reverse=True)
        return [d[1] for d in scored_docs[:limit]]
    except Exception as outer_e: 
        print(f"🔥 hybrid_search error: {outer_e}")
        return []