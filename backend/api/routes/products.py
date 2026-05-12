from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
import time
import google.generativeai as genai
from google.cloud.firestore_v1.vector import Vector
from utils import db, r, EMBEDDING_MODEL_NAME
import asyncio

router = APIRouter(prefix="/api/products", tags=["Products"])

class ProductSyncRequest(BaseModel):
    shop_id: str
    product_ids: Optional[List[str]] = None

async def generate_product_embedding(product_data):
    """Combine product fields and generate embedding."""
    name = product_data.get('name', '')
    desc = product_data.get('description', '')
    ai_desc = product_data.get('ai_custom_description', '')
    ai_keys = product_data.get('ai_keywords', '')
    
    # Combine meaningful text for better search
    text_to_embed = f"Product: {name}\nDescription: {desc}\nAI Info: {ai_desc}\nKeywords: {ai_keys}"
    
    try:
        res = await genai.embed_content_async(
            model=EMBEDDING_MODEL_NAME,
            content=text_to_embed,
            task_type="retrieval_document",
            title=name,
            output_dimensionality=768
        )
        return res['embedding']
    except Exception as e:
        print(f"Error embedding product {name}: {e}")
        return None

async def sync_products_task(shop_id: str, product_ids: Optional[List[str]] = None):
    """Background task to sync embeddings and clear cache."""
    try:
        shop_ref = db.collection("shops").document(shop_id)
        products_ref = shop_ref.collection("items")
        
        if product_ids:
            # Sync specific products
            docs = []
            for pid in product_ids:
                doc = products_ref.document(pid).get()
                if doc.exists:
                    docs.append(doc)
        else:
            # Sync all products
            docs = products_ref.get()
            
        for doc in docs:
            data = doc.to_dict()
            embedding = await generate_product_embedding(data)
            if embedding:
                doc.reference.update({
                    "embedding": Vector(embedding),
                    "last_ai_sync": time.time()
                })
        
        # Clear Semantic Cache in Firestore
        cache_ref = shop_ref.collection("semantic_cache")
        cache_docs = cache_ref.limit(500).get()
        batch = db.batch()
        for cdoc in cache_docs:
            batch.delete(cdoc.reference)
        batch.commit()
        
        print(f"✅ Sync Complete for Shop: {shop_id}. Cache Cleared.")
        
    except Exception as e:
        print(f"❌ Sync Task Failed: {e}")

@router.post("/sync")
async def sync_products(req: ProductSyncRequest, background_tasks: BackgroundTasks):
    """API to trigger product sync and embedding updates."""
    if not req.shop_id:
        raise HTTPException(status_code=400, detail="shop_id is required")
        
    # Run in background to not block UI
    background_tasks.add_task(sync_products_task, req.shop_id, req.product_ids)
    
    return {"status": "success", "message": "Synchronization started in background"}
