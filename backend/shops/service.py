"""
Shops: Shop data service — Firestore lookup with Redis caching.
"""
from config import db, r
from shared.exceptions import ShopNotFoundError


async def get_shop_data(acc_id: str) -> dict | None:
    """
    Load shop data from Firestore by bot_id/acc_id.
    Caches shop metadata in Redis for faster lookups.
    """
    if not db:
        return None

    # Check Redis cache first
    cache_key = f"shop:{acc_id}"
    if r:
        try:
            import json
            cached = await r.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    # Query Firestore
    try:
        import asyncio
        shops_ref = db.collection("shops")
        query = shops_ref.where("acc_id", "==", acc_id).limit(1)
        docs = await asyncio.to_thread(query.stream, transaction_timeout=10)

        for doc in docs:
            data = doc.to_dict() if callable(doc.to_dict) else {}
            data["shop_doc_id"] = doc.id
            # Cache in Redis (TTL: 5 min)
            if r:
                try:
                    import json
                    await r.setex(cache_key, 300, json.dumps(data))
                except Exception:
                    pass
            return data
    except Exception as e:
        print(f"🔥 Shop lookup error: {e}", flush=True)

    return None


async def get_shop_automation(shop_doc_id: str) -> dict:
    """Get automation settings for a shop."""
    if not db:
        return {}

    try:
        import asyncio
        doc = await asyncio.to_thread(
            db.collection("shops").document(shop_doc_id).get
        )
        if doc.exists:
            data = doc.to_dict() if callable(doc.to_dict) else {}
            return data.get("ai_config", {}).get("automationRules", [])
    except Exception:
        pass
    return {}


async def list_shops() -> list[dict]:
    """List all shops (for admin dashboard)."""
    if not db:
        return []

    try:
        import asyncio
        docs = await asyncio.to_thread(db.collection("shops").stream)
        shops = []
        for d in docs:
            data = d.to_dict() if callable(d.to_dict) else {}
            data["id"] = d.id
            shops.append({"id": d.id, "name": data.get("name", "N/A"),
                          "acc_id": data.get("acc_id", "")})
        return shops
    except Exception:
        return []
