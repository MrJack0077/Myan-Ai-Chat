from fastapi import APIRouter, HTTPException
from utils import db, r

router = APIRouter(prefix="/api/shops", tags=["Shops"])

@router.post("/{shop_id}/automation")
async def update_automation_settings(shop_id: str, settings: dict):
    if not db: return {"status": "error", "message": "No DB"}
    try:
        db.collection("shops").document(shop_id).update({
            "aiConfig.automationRules": settings.get("rules", []), 
            "aiConfig.personality": settings.get("personality", ""),
            "aiConfig.botName": settings.get("botName", "AI Assistant")
        })
        # Invalidate all caches for this shop immediately
        from core.cache_manager import invalidate_shop_caches
        from core.prompt_cache import invalidate_system_prompt_cache
        doc = db.collection("shops").document(shop_id).get()
        if doc.exists:
            acc_ids = doc.to_dict().get("sendpulseBotIds", [])
            acc_id = acc_ids[0] if acc_ids else ""
            await invalidate_shop_caches(shop_id, acc_id=acc_id)
            invalidate_system_prompt_cache(shop_id)  # ⚡ Invalidate Vertex Cache
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{shop_id}/automation")
async def get_automation_settings(shop_id: str):
    if not db: return {"status": "error", "message": "No DB"}
    try:
        doc = db.collection("shops").document(shop_id).get()
        if not doc.exists: return {"status": "error", "message": "Shop not found"}
        data = doc.to_dict()
        ai_cfg = data.get("aiConfig", {})
        return {
            "rules": ai_cfg.get("automationRules", []),
            "personality": ai_cfg.get("personality", ""),
            "botName": ai_cfg.get("botName", "AI Assistant")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
