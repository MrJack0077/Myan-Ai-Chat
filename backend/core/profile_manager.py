"""Profile management: save, load, segmentation, state expiry."""
import json
from datetime import datetime, timezone
from utils import db, r
from .cache_manager import cache_set, cache_get, cache_touch, TTL_COOL


DEFAULT_PROFILE = {
    "identification": {
        "name": "",
        "phone": "",
        "messenger_id": "",
        "telegram_id": "",
        "language": "my"
    },
    "dynamics": {
        "last_interaction": datetime.now(timezone.utc).isoformat(),
        "current_intent": "DEFAULT",
        "active_order_id": "",
        "message_count": 0,
        "order_state": "NONE",
        "last_button_msg_id": ""
    },
    "sales_data": {
        "segment": "NEW",
        "total_orders": 0,
        "total_spent": 0,
        "last_purchased_items": [],
        "past_purchases": []
    },
    "ai_insights": {
        "user_summary": "",
        "conversation_summary": "",
        "tags": [],
        "preferences": {}
    },
    "current_order": {
        "items": [],
        "payment_method": "",
        "address": "",
        "deli_charge": 0,
        "total_price": 0,
        "payment_slip_url": ""
    },
    "last_updated": datetime.now(timezone.utc).isoformat(),
}


def migrate_profile(prof):
    """Ensure older profiles match the new nested structure."""
    if "identification" in prof:
        return prof  # Already migrated

    new_prof = json.loads(json.dumps(DEFAULT_PROFILE))
    
    # Map old keys to new identification
    new_prof["identification"]["name"] = prof.get("name", "")
    new_prof["identification"]["phone"] = prof.get("phone", "")
    
    # Dynamics
    new_prof["dynamics"]["order_state"] = prof.get("order_state", "NONE")
    new_prof["dynamics"]["last_button_msg_id"] = prof.get("last_button_msg_id", "")
    
    # Sales
    new_prof["sales_data"]["past_purchases"] = prof.get("past_purchases", [])
    new_prof["sales_data"]["segment"] = prof.get("segment", "NEW")
    
    # Insights
    # Check for both "summary" (old) and "user_summary" (intermediate)
    new_prof["ai_insights"]["user_summary"] = prof.get("user_summary") or prof.get("summary", "")
    new_prof["ai_insights"]["conversation_summary"] = prof.get("conversation_summary", "")
    new_prof["ai_insights"]["preferences"] = prof.get("preferences", {})
    
    # Current Order
    new_prof["current_order"]["items"] = prof.get("items", [])
    new_prof["current_order"]["payment_method"] = prof.get("payment_method", "")
    new_prof["current_order"]["address"] = prof.get("address", "")
    new_prof["current_order"]["total_price"] = prof.get("total_price", 0)
    new_prof["current_order"]["deli_charge"] = prof.get("deli_charge", 0)
    new_prof["current_order"]["payment_slip_url"] = prof.get("payment_slip_url", "")
    
    new_prof["last_updated"] = prof.get("last_updated", datetime.now(timezone.utc).isoformat())
    return new_prof


async def save_profile(shop_id, user_id, prof):
    """Save user profile to Redis (with TTL) and Firestore."""
    prof["last_updated"] = datetime.now(timezone.utc).isoformat()
    profile_json = json.dumps(prof)
    profile_key = f"prof:{shop_id}:{user_id}"
    
    # Redis: SETEX with 1-hour TTL — active users get TTL renewed every save
    await cache_set(profile_key, profile_json, TTL_COOL)
    
    # Firestore: durable backup
    try:
        db.collection("shops").document(shop_id).collection("customers").document(user_id).set(prof)
    except Exception as e:
        print(f"⚠️ Profile Save Error (Firestore): {e}")


async def get_user_profile(shop_id, user_id):
    """Get user profile from cache or Firestore, or return default.
    After cache hit, renew TTL so active users stay cached."""
    profile_key = f"prof:{shop_id}:{user_id}"
    
    # Try Redis cache first
    cached = await cache_get(profile_key)
    if cached:
        try:
            data = json.loads(cached)
            if isinstance(data, dict):
                # Renew TTL — active user
                await cache_touch(profile_key, TTL_COOL)
                return migrate_profile(data)
        except Exception as e:
            print(f"Redis Profile Get Parse Error: {e}")
    
    # Fallback to Firestore
    try:
        doc = db.collection("shops").document(shop_id).collection("customers").document(user_id).get()
        if doc.exists:
            prof = migrate_profile(doc.to_dict())
            # Re-populate Redis cache
            await cache_set(profile_key, json.dumps(prof), TTL_COOL)
            return prof
    except Exception as e:
        print(f"Firestore Profile Get Error: {e}")
    
    return json.loads(json.dumps(DEFAULT_PROFILE))


def segment_customer(prof):
    """Assign customer segment based on purchase history."""
    past_purchases = prof.get("sales_data", {}).get("past_purchases", [])
    if not isinstance(past_purchases, list):
        past_purchases = []
        if "sales_data" not in prof: prof["sales_data"] = {}
        prof["sales_data"]["past_purchases"] = past_purchases

    total_spent = sum(p.get("total_price", 0) for p in past_purchases if isinstance(p, dict))
    
    segment = "NEW"
    if total_spent > 100000:
        segment = "VIP"
    elif len(past_purchases) > 0:
        segment = "RETURNING"
    
    prof["sales_data"]["segment"] = segment
    prof["sales_data"]["total_spent"] = total_spent
    prof["sales_data"]["total_orders"] = len(past_purchases)


async def expire_order_state(prof, shop_doc_id, user_id, max_age_seconds=10800):
    """Reset order state if too old (default 3 hours)."""
    dynamics = prof.get("dynamics", {})
    order_state = dynamics.get("order_state", "NONE")
    last_updated_str = prof.get("last_updated")

    if not last_updated_str or order_state == "NONE":
        return order_state

    try:
        last_dt = datetime.fromisoformat(last_updated_str)
        if (datetime.now(timezone.utc) - last_dt).total_seconds() > max_age_seconds:
            print("⏰ DEBUG: Order state expired. Resetting to NONE.")
            
            # Reset dynamics
            prof["dynamics"]["order_state"] = "NONE"
            
            # Reset current_order
            prof["current_order"].update({
                "items": [],
                "payment_slip_url": "", "deli_charge": 0, "total_price": 0,
            })
            
            await save_profile(shop_doc_id, user_id, prof)
            return "NONE"
    except Exception as e:
        print(f"Date parsing error: {e}")

    return order_state


# ── Memory & Preference Functions ──

def build_memory_context(prof: dict) -> str:
    """Build rich memory context for AI prompt: segment, preferences, purchases."""
    sales = prof.get("sales_data", {})
    insights = prof.get("ai_insights", {})
    
    parts = []
    
    segment = sales.get("segment", "NEW")
    total_orders = sales.get("total_orders", 0)
    total_spent = sales.get("total_spent", 0)
    
    if segment == "VIP":
        parts.append(f"⭐ VIP Customer — {total_orders} orders, {total_spent} MMK. Give priority service.")
    elif segment == "RETURNING":
        parts.append(f"🔄 Returning Customer — {total_orders} orders. Welcome back warmly, reference past purchases.")
    elif segment == "NEW" and total_orders == 0:
        parts.append("🆕 New Customer — Be extra welcoming, explain how to order.")
    
    preferences = insights.get("preferences", {})
    if preferences:
        pref_parts = []
        for k, v in preferences.items():
            if isinstance(v, list) and v:
                pref_parts.append(f"{k}: {', '.join(str(x) for x in v[:3])}")
            elif isinstance(v, (str, int, float)) and v:
                pref_parts.append(f"{k}: {v}")
        if pref_parts:
            parts.append(f"🎯 Preferences: {'; '.join(pref_parts)}")
    
    past = sales.get("past_purchases", [])
    if past and isinstance(past, list) and len(past) > 0:
        last = past[-1] if isinstance(past[-1], dict) else None
        if last:
            items = last.get("items", [])
            item_names = [i.get("name", i) if isinstance(i, dict) else str(i) for i in items[:3]]
            if item_names:
                parts.append(f"🛒 Last Purchase: {', '.join(item_names)} — mention naturally if relevant.")
    
    summary = insights.get("conversation_summary", "")
    if summary:
        parts.append(f"📝 Previous Chat: {summary[:200]}")
    
    tags = insights.get("tags", [])
    if tags:
        parts.append(f"🏷️ Tags: {', '.join(tags[:5])}")
    
    return "\n".join(parts)


def update_customer_preferences(prof: dict, extracted_prefs: dict):
    """Merge extracted preferences into customer profile."""
    if not extracted_prefs:
        return
    current = prof.get("ai_insights", {}).get("preferences", {})
    if not isinstance(current, dict):
        current = {}
    for key, value in extracted_prefs.items():
        if isinstance(value, list):
            existing = current.get(key, [])
            if not isinstance(existing, list):
                existing = []
            for v in value:
                if v not in existing:
                    existing.append(v)
            current[key] = existing[:10]
        elif isinstance(value, (str, int, float)):
            current[key] = value
    prof["ai_insights"]["preferences"] = current
