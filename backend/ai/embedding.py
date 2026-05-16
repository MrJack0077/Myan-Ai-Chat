"""
AI: Embedding generation for semantic search.
Tiered fallback: Vertex AI (text-embedding-004) → AI Studio (gemini-embedding-2) → local.
"""
import asyncio
from config import genai_client, studio_client, EMBEDDING_MODEL_NAME


async def generate_embedding(text: str) -> list[float]:
    """
    Generate embedding for a text string.
    Falls back through multiple providers.
    """
    if not text or not isinstance(text, str) or len(text.strip()) < 2:
        return []

    # Tier 1: Vertex AI — always use text-embedding-004 (stable, available)
    if genai_client:
        try:
            result = await asyncio.wait_for(
                genai_client.aio.models.embed_content(
                    model="text-embedding-004",
                    contents=[text],
                ),
                timeout=5.0,
            )
            if result and result.embeddings:
                dims = len(result.embeddings[0].values)
                print(f"✅ Vertex embedding: {dims}d", flush=True)
                return result.embeddings[0].values
        except Exception as e:
            print(f"⚠️ Vertex embedding failed: {e}", flush=True)

    # Tier 2: AI Studio — try user's configured model (gemini-embedding-2 etc)
    if studio_client:
        try:
            result = studio_client.models.embed_content(
                model=EMBEDDING_MODEL_NAME,
                contents=[text],
            )
            if result and result.embeddings:
                dims = len(result.embeddings[0].values)
                print(f"✅ AI Studio embedding ({EMBEDDING_MODEL_NAME}): {dims}d", flush=True)
                return result.embeddings[0].values
        except Exception as e:
            print(f"⚠️ AI Studio embedding failed: {e}", flush=True)

    # Tier 3: AI Studio with text-embedding-004 as last resort
    if studio_client:
        try:
            result = studio_client.models.embed_content(
                model="text-embedding-004",
                contents=[text],
            )
            if result and result.embeddings:
                dims = len(result.embeddings[0].values)
                print(f"✅ AI Studio fallback (text-embedding-004): {dims}d", flush=True)
                return result.embeddings[0].values
        except Exception:
            pass

    # Tier 4: Local sentence-transformers
    try:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer("all-MiniLM-L6-v2")
        emb = model.encode([text])[0].tolist()
        print(f"✅ Local embedding: {len(emb)}d", flush=True)
        return emb
    except Exception:
        pass

    print("❌ All embedding providers failed!", flush=True)
    return []
