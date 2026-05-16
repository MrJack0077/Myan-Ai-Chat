"""
API Route: Shop automation settings CRUD.
Get/update automation rules and invalidate caches on change.
"""
import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from config import db, r

router = APIRouter()


class AutomationSettings(BaseModel):
    automationRules: list[dict] = []
    humanHandoff: dict = {}
    constraints: list[str] = []
    replyGuidelines: dict = {}
    strictness: str = "moderate"
    spellCheck: str = "moderate"


@router.get("/api/shops/{shop_id}/automation")
async def get_automation_settings(shop_id: str):
    """Get current automation settings for a shop."""
    if not db:
        raise HTTPException(status_code=503, detail="Firestore unavailable")

    try:
        doc = await asyncio.to_thread(db.collection("shops").document(shop_id).get)
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Shop not found")
        data = doc.to_dict() if callable(doc.to_dict) else {}
        ai_config = data.get("ai_config", {})
        return {
            "shop_id": shop_id,
            "automationRules": ai_config.get("automationRules", []),
            "humanHandoff": ai_config.get("humanHandoff", {}),
            "constraints": ai_config.get("constraints", []),
            "replyGuidelines": ai_config.get("replyGuidelines", {}),
            "strictness": ai_config.get("strictness", "moderate"),
            "spellCheck": ai_config.get("spellCheck", "moderate"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/shops/{shop_id}/automation")
async def update_automation_settings(shop_id: str, settings: AutomationSettings):
    """Update automation settings and invalidate all caches."""
    if not db:
        raise HTTPException(status_code=503, detail="Firestore unavailable")

    try:
        update_data = {
            "ai_config.automationRules": settings.automationRules,
            "ai_config.humanHandoff": settings.humanHandoff,
            "ai_config.constraints": settings.constraints,
            "ai_config.replyGuidelines": settings.replyGuidelines,
            "ai_config.strictness": settings.strictness,
            "ai_config.spellCheck": settings.spellCheck,
        }
        await asyncio.to_thread(
            db.collection("shops").document(shop_id).update, update_data
        )

        # Invalidate caches via shop automation + prompt cache modules
        if r:
            from shops.automation import _invalidate_shop_keys
            from ai.prompts.cache import invalidate_prompt_cache
            await _invalidate_shop_keys(shop_id)
            await invalidate_prompt_cache(shop_id)

        return {"ok": True, "shop_id": shop_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
