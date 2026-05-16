"""
Shops: Automation settings CRUD — update rules and invalidate caches.
"""
from config import db, r
from ai.prompts.cache import invalidate_prompt_cache


async def update_automation(shop_doc_id: str, settings: dict) -> bool:
    """Update automation rules and invalidate all related caches."""
    if not db:
        return False

    try:
        import asyncio

        update_data = {}
        for key in ("automationRules", "humanHandoff", "constraints",
                     "replyGuidelines", "strictness", "spellCheck"):
            if key in settings:
                update_data[f"ai_config.{key}"] = settings[key]

        await asyncio.to_thread(
            db.collection("shops").document(shop_doc_id).update, update_data,
        )

        # Invalidate caches
        if r:
            await invalidate_prompt_cache(shop_doc_id)
            await _invalidate_shop_keys(shop_doc_id)

        return True
    except Exception as e:
        print(f"🔥 Automation update error: {e}", flush=True)
        return False


async def get_automation(shop_doc_id: str) -> dict:
    """Get current automation settings."""
    if not db:
        return {}

    try:
        import asyncio
        doc = await asyncio.to_thread(
            db.collection("shops").document(shop_doc_id).get
        )
        if doc.exists:
            data = doc.to_dict() if callable(doc.to_dict) else {}
            ai = data.get("ai_config", {})
            return {
                "automationRules": ai.get("automationRules", []),
                "humanHandoff": ai.get("humanHandoff", {}),
                "constraints": ai.get("constraints", []),
                "replyGuidelines": ai.get("replyGuidelines", {}),
                "strictness": ai.get("strictness", "moderate"),
                "spellCheck": ai.get("spellCheck", "moderate"),
            }
    except Exception:
        pass
    return {}


async def _invalidate_shop_keys(shop_doc_id: str) -> int:
    """Invalidate all Redis keys for a shop. Returns count of deleted keys."""
    if not r:
        return 0
    try:
        import asyncio
        patterns = [f"cache:{shop_doc_id}:*", f"history:{shop_doc_id}:*",
                     f"prof:{shop_doc_id}:*", f"shop:{shop_doc_id}"]
        all_keys = []
        for pat in patterns:
            keys = await r.keys(pat)
            if keys:
                all_keys.extend(keys)
        if all_keys:
            await r.delete(*all_keys)
        return len(all_keys)
    except Exception:
        return 0
