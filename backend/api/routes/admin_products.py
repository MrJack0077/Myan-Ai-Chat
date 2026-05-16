"""
API Route: Product embedding sync endpoint.
Triggers background product embedding generation for semantic search.
"""
import asyncio
import google.cloud.firestore as firestore_module
from fastapi import APIRouter, BackgroundTasks
from config import db, r

router = APIRouter()


async def _generate_embedding(text: str, model_name: str = "text-embedding-004") -> list[float]:
    """Generate embedding vector for product text using Vertex AI or fallback."""
    try:
        from config import genai_client
        result = genai_client.models.embed_content(
            model=model_name,
            contents=[text],
        )
        if result and result.embeddings:
            return result.embeddings[0].values
    except Exception as e:
        print(f"⚠️ Vertex AI embedding failed: {e}, trying AI Studio...", flush=True)
        try:
            from config import studio_client
            if studio_client:
                result = studio_client.models.embed_content(
                    model="text-embedding-004",
                    contents=[text],
                )
                if result and result.embeddings:
                    return result.embeddings[0].values
        except Exception as e2:
            print(f"⚠️ AI Studio embedding also failed: {e2}", flush=True)

    # Last resort: local sentence-transformers
    try:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer("all-MiniLM-L6-v2")
        return model.encode([text])[0].tolist()
    except Exception:
        return []


async def _sync_products_task():
    """Background task: sync all shop products with fresh embeddings."""
    if not db:
        return

    shops_docs = await asyncio.to_thread(db.collection("shops").stream)
    total_updated = 0
    for shop_doc in shops_docs:
        shop_data = shop_doc.to_dict() if callable(shop_doc.to_dict) else {}
        products = shop_data.get("products", [])
        if not products:
            continue

        batch = db.batch()
        for i, prod in enumerate(products[:50]):  # max 50 per run
            name = prod.get("name", "")
            if not name or not isinstance(name, str) or len(name) < 2:
                continue
            embedding = await _generate_embedding(name)
            if embedding:
                ref = db.collection("shops").document(shop_doc.id)\
                        .collection("products").document(str(i))
                batch.set(ref, {
                    **prod,
                    "embedding": embedding,
                    "updated_at": firestore.SERVER_TIMESTAMP,
                }, merge=True)
                total_updated += 1
        batch.commit()

    print(f"✅ Product sync done: {total_updated} embeddings updated", flush=True)


@router.post("/api/products/sync")
async def sync_products(background_tasks: BackgroundTasks):
    """Trigger background product embedding sync."""
    background_tasks.add_task(_sync_products_task)
    return {"ok": True, "message": "Product sync started (background)"}
