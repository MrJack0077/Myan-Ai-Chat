"""
API Route: Admin cache management — embed, clear cache, debug endpoints.
"""
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from config import db, r

router = APIRouter()


class EmbedRequest(BaseModel):
    text: str
    shop_id: str = ""


@router.post("/api/embed")
async def embed_text(req: EmbedRequest):
    """Generate embedding for a given text (placeholder — delegates to AI module)."""
    # Deferred: embedding generation moved to ai/embedding.py
    return {"text": req.text, "embedding": [], "dim": 768}


@router.post("/api/clear-cache/{target_id}/history")
async def clean_history_endpoint(target_id: str):
    """Clear chat history keys for a target (shop or conversation)."""
    if not r:
        raise HTTPException(status_code=503, detail="Redis unavailable")
    try:
        pattern = f"history:{target_id}:*"
        keys = await r.keys(pattern)
        if keys:
            await r.delete(*keys)
        return {"ok": True, "cleared": len(keys) if keys else 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/clear-cache/{target_id}")
async def clear_cache_endpoint(target_id: str):
    """Clear ALL caches for a target_id."""
    if not r:
        return {"ok": False, "reason": "Redis unavailable"}
    try:
        # Invalidate shop caches via central manager
        from core.cache_manager import invalidate_shop_caches
        await invalidate_shop_caches(target_id, acc_id=None)
        return {"ok": True, "message": f"Cache cleared for {target_id}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.get("/debug/redis")
async def debug_redis():
    """Debug endpoint: show Redis connection status and sample keys."""
    if not r:
        return {"redis": "disconnected"}
    try:
        await r.ping()
        keys = await r.keys("*") or []
        return {
            "redis": "connected",
            "key_count": len(keys),
            "sample_keys": keys[:20],
        }
    except Exception as e:
        return {"redis": "error", "detail": str(e)}


@router.get("/api/debug/shops")
async def debug_shops():
    """Debug endpoint: list shop documents in Firestore."""
    if not db:
        return {"firestore": "disconnected"}
    try:
        import asyncio
        docs = (await asyncio.to_thread(db.collection("shops").stream))
        shops = []
        for d in docs:
            data = d.to_dict() if hasattr(d, 'to_dict') else {}
            shops.append({"id": d.id, "name": data.get("name", "N/A")})
        return {"shops": shops, "count": len(shops)}
    except Exception as e:
        return {"firestore": "error", "detail": str(e)}
