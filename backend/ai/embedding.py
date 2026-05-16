"""
AI: Embedding generation for semantic search.
Tiered fallback: Vertex AI → AI Studio → local sentence-transformers.
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

    # Tier 1: Vertex AI
    if genai_client:
        try:
            result = await asyncio.wait_for(
                genai_client.aio.models.embed_content(
                    model=EMBEDDING_MODEL_NAME,
                    contents=[text],
                ),
                timeout=5.0,
            )
            if result and result.embeddings:
                return result.embeddings[0].values
        except Exception as e:
            print(f"⚠️ Vertex embedding failed: {e}", flush=True)

    # Tier 2: AI Studio
    if studio_client:
        try:
            result = studio_client.models.embed_content(
                model="gemini-embedding-2",
                contents=[text],
            )
            if result and result.embeddings:
                return result.embeddings[0].values
        except Exception as e:
            print(f"⚠️ AI Studio embedding failed: {e}", flush=True)

    # Tier 3: Local sentence-transformers
    try:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer("all-MiniLM-L6-v2")
        return model.encode([text])[0].tolist()
    except Exception:
        pass

    return []
