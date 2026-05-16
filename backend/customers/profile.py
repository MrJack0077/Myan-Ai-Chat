"""
Customers: Customer profile management.
Load/save profiles, segmentation, order state expiry, preferences.
"""
import json
from datetime import datetime, timezone, timedelta
from config import db, r


async def get_profile(shop_doc_id: str, user_id: str) -> dict:
    """Load user profile from Redis cache or Firestore."""
    # Try Redis cache
    cache_key = f"prof:{shop_doc_id}:{user_id}"
    if r:
        try:
            cached = await r.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    # Try Firestore
    if db:
        try:
            import asyncio
            doc = await asyncio.to_thread(
                db.collection("customer_profiles").document(f"{shop_doc_id}_{user_id}").get
            )
            if doc.exists:
                data = doc.to_dict() if callable(doc.to_dict) else {}
                return data
        except Exception:
            pass

    # Return fresh profile template
    return _fresh_profile()


async def save_profile(shop_doc_id: str, user_id: str, prof: dict) -> None:
    """Save user profile to Redis cache and Firestore (background)."""
    cache_key = f"prof:{shop_doc_id}:{user_id}"

    # Always update Redis cache
    if r:
        try:
            await r.setex(cache_key, 7200, json.dumps(prof))
        except Exception:
            pass

    # Firestore persistence (background)
    if db:
        import asyncio
        asyncio.create_task(_persist_profile(shop_doc_id, user_id, prof))


async def _persist_profile(shop_doc_id: str, user_id: str, prof: dict) -> None:
    """Background task: save profile to Firestore."""
    try:
        import asyncio as aio
        doc_id = f"{shop_doc_id}_{user_id}"
        await aio.to_thread(
            db.collection("customer_profiles").document(doc_id).set,
            prof, merge=True,
        )
    except Exception as e:
        print(f"⚠️ Profile save error: {e}", flush=True)


def segment_customer(prof: dict) -> str:
    """Segment customer: new / returning / vip based on purchase history."""
    purchases = prof.get("sales_data", {}).get("past_purchases", [])
    msg_count = prof.get("dynamics", {}).get("message_count", 0)

    if len(purchases) >= 3:
        prof["identification"]["segment"] = "vip"
        return "vip"
    elif len(purchases) >= 1:
        prof["identification"]["segment"] = "returning"
        return "returning"
    elif msg_count > 0 and msg_count < 30:
        prof["identification"]["segment"] = "returning"
        return "returning"
    else:
        prof["identification"]["segment"] = "new"
        return "new"


async def expire_order_state(prof: dict, shop_doc_id: str, user_id: str) -> str:
    """Expire stale order state if inactive for > 30 minutes."""
    state = prof.get("dynamics", {}).get("order_state", "NONE")
    if state in ("NONE", "HUMAN_HANDOVER"):
        return state

    last_interaction = prof.get("dynamics", {}).get("last_interaction", "")
    if last_interaction:
        try:
            last = datetime.fromisoformat(last_interaction)
            if datetime.now(timezone.utc) - last > timedelta(minutes=30):
                prof["dynamics"]["order_state"] = "NONE"
                prof["current_order"] = {"items": [], "total_price": 0}
                await save_profile(shop_doc_id, user_id, prof)
                return "NONE"
        except (ValueError, TypeError):
            pass

    return state


def build_memory_context(prof: dict) -> str:
    """Build a concise memory context string for the AI prompt."""
    ident = prof.get("identification", {})
    summary = prof.get("ai_insights", {}).get("conversation_summary", "")
    preferences = prof.get("ai_insights", {}).get("preferences", {})

    parts = []
    if ident.get("name"):
        parts.append(f"Name: {ident['name']}")
    if ident.get("phone"):
        parts.append(f"Phone: {ident['phone']}")
    if ident.get("segment"):
        if ident["segment"] == "vip":
            parts.append("This is a VIP customer. Treat them specially and warmly.")
        elif ident["segment"] == "returning":
            parts.append("Returning customer. Welcome them back.")
    if summary:
        parts.append(f"Memory: {summary}")
    if preferences:
        pref_str = ", ".join(f"{k}={v}" for k, v in preferences.items())
        parts.append(f"Preferences: {pref_str}")

    return "\n".join(parts) if parts else ""


def update_customer_preferences(prof: dict, prefs: dict) -> None:
    """Update customer preference insights."""
    existing = prof.get("ai_insights", {}).get("preferences", {})
    existing.update(prefs)
    prof.setdefault("ai_insights", {})["preferences"] = existing


def _fresh_profile() -> dict:
    """Create a fresh customer profile template."""
    return {
        "identification": {"name": "", "phone": "", "address": "",
                           "messenger_id": "", "telegram_id": "", "segment": "new"},
        "dynamics": {"message_count": 0, "order_state": "NONE",
                      "last_interaction": datetime.now(timezone.utc).isoformat()},
        "current_order": {"items": [], "total_price": 0},
        "sales_data": {"past_purchases": [], "total_spent": 0},
        "ai_insights": {"conversation_summary": "", "preferences": {}},
    }
