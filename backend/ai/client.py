"""
AI: GenAI client wrapper.
Provides a thin abstraction over google-genai for calling models with retry/fallback.
"""
import asyncio
from typing import Any
from config import genai_client, BASE_MODEL_NAME


async def generate_content(
    model: str = BASE_MODEL_NAME,
    contents: list[Any] = None,
    config: Any = None,
    timeout: float = 8.0,
) -> Any:
    """
    Call the GenAI model with timeout and error handling.
    Returns the GenAI response object, or raises AIError on failure.
    """
    if not genai_client:
        raise RuntimeError("GenAI client not initialized")

    try:
        return await asyncio.wait_for(
            genai_client.aio.models.generate_content(
                model=model,
                contents=contents or [],
                config=config,
            ),
            timeout=timeout,
        )
    except asyncio.TimeoutError:
        raise TimeoutError(f"AI call timed out after {timeout}s")
    except Exception as e:
        raise RuntimeError(f"AI generation failed: {e}")


async def generate_embedding(text: str, model: str = "text-embedding-004") -> list[float]:
    """
    Generate an embedding vector for a text string.
    Tries Vertex AI first, falls back to AI Studio, then local model.
    """
    if not genai_client:
        return []

    # Vertex AI
    try:
        result = await asyncio.wait_for(
            genai_client.aio.models.embed_content(model=model, contents=[text]),
            timeout=5.0,
        )
        if result and result.embeddings:
            return result.embeddings[0].values
    except Exception as e:
        print(f"⚠️ Vertex embedding failed: {e}", flush=True)

    # AI Studio fallback
    try:
        from config import studio_client
        if studio_client:
            result = studio_client.models.embed_content(
                model="text-embedding-004", contents=[text],
            )
            if result and result.embeddings:
                return result.embeddings[0].values
    except Exception as e:
        print(f"⚠️ AI Studio embedding failed: {e}", flush=True)

    # Local sentence-transformers fallback
    try:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer("all-MiniLM-L6-v2")
        return model.encode([text])[0].tolist()
    except Exception:
        pass

    return []
