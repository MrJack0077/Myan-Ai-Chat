from .config import r, db, BASE_MODEL_NAME
import json
import asyncio
from datetime import datetime, timezone


async def handover_to_admin(acc_id, conv_id, token, admin_id=None, labels=None):
    """
    Real handover: creates a Firestore notification for admin dashboard.
    Admin can pick up the conversation from their panel.
    """
    if labels is None:
        labels = ["Human Requested"]
    
    from utils.config import db
    from datetime import datetime, timezone
    
    if not db:
        print(f"🔄 Handover to admin triggered for {acc_id}. Labels: {labels} (no DB)", flush=True)
        return
    
    shop_id = None
    try:
        # Find shop by acc_id
        from google.cloud.firestore_v1.base_query import FieldFilter
        shops = db.collection("shops").where(
            filter=FieldFilter("sendpulseBotIds", "array_contains", acc_id)
        ).limit(1).get()
        if shops:
            shop_id = shops[0].id
    except Exception:
        pass
    
    if shop_id:
        try:
            note = f"🔔 Customer requested human assistance.\nLabels: {', '.join(labels)}\nConversation: {conv_id}"
            db.collection("shops").document(shop_id).collection("notifications").add({
                "type": "handover_request",
                "title": "Customer requesting human agent",
                "body": note,
                "acc_id": acc_id,
                "conv_id": conv_id,
                "labels": labels,
                "is_read": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            print(f"🔔 Handover notification saved for shop {shop_id}, conv {conv_id}", flush=True)
        except Exception as e:
            print(f"⚠️ Handover notification save error: {e}", flush=True)
    else:
        print(f"🔄 Handover to admin triggered for {acc_id}. Labels: {labels}", flush=True)


async def summarize_chat_history(shop_id, conv_id, user_id, history_text, prof, base_model_name=None):
    """
    [DEPRECATED — use conversation_memory.generate_conversation_summary instead]
    
    Old: summarized only Customer messages → user preferences.
    Kept for backward compatibility only.
    """
    from core.conversation_memory import generate_conversation_summary

    # Use the new two-tier summarization (full conversation context)
    old_summary = prof.get("ai_insights", {}).get("conversation_summary", "")
    new_summary = await generate_conversation_summary(old_summary, history_text, prof, base_model_name)

    if new_summary:
        if "ai_insights" not in prof:
            prof["ai_insights"] = {}
        prof["ai_insights"]["conversation_summary"] = new_summary
        prof["last_updated"] = datetime.now(timezone.utc).isoformat()

        # Save to Redis
        if r:
            try:
                await r.set(f"prof:{shop_id}:{user_id}", json.dumps(prof))
            except Exception:
                pass

        # Save to Firestore
        def save_db():
            try:
                db.collection("shops").document(shop_id).collection("customers").document(user_id).set(prof)
            except Exception:
                pass

        await asyncio.to_thread(save_db)
        print(f"✅ Conversation summarized for {user_id} (new tier-2 memory)", flush=True)

