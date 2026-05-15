"""
Local embedding model — multilingual-e5-base via sentence-transformers.
Runs on CPU, no API quota limits. Supports Burmese (Myanmar language).
768-dimensional embeddings, compatible with existing Firestore vector search.
"""
import asyncio
import time

_model = None

def _load_model():
    """Lazy-load the embedding model (first call only)."""
    global _model
    if _model is None:
        print("🧠 Loading embedding model: intfloat/multilingual-e5-base ...", flush=True)
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer('intfloat/multilingual-e5-base')
        print("✅ Embedding model loaded!", flush=True)
    return _model


async def generate_embedding(text: str, task_type: str = "retrieval_query") -> list:
    """
    Generate embedding for a single text.
    
    Args:
        text: Input text to embed
        task_type: 'retrieval_query' or 'retrieval_document' (adds prefix)
    
    Returns:
        768-dimensional embedding as list of floats
    """
    if not text or not text.strip():
        return []
    
    # Add task prefix for better retrieval
    if task_type == 'retrieval_query':
        prefixed = f"query: {text}"
    elif task_type == 'retrieval_document':
        prefixed = f"passage: {text}"
    else:
        prefixed = text
    
    model = _load_model()
    
    # Run in thread pool (sentence-transformers is sync)
    embedding = await asyncio.to_thread(
        model.encode,
        prefixed,
        normalize_embeddings=True,
    )
    
    return embedding.tolist()
