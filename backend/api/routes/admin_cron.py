"""
API Route: Admin cron endpoints — followup triggers for abandoned orders.
"""
import asyncio
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter
from config import db, r
from shared.http_client import get_sendpulse_token, bg_post

router = APIRouter()


@router.get("/api/cron/followup")
async def cron_followup():
    """
    Follow-up cron: find customers with stalled order states
    and send a gentle reminder message.
    """
    if not db:
        return {"ok": False, "reason": "Firestore unavailable"}

    try:
        # Query Firestore for customers with COLLECTING state > 30 min
        cutoff = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
        customers_ref = db.collection("customer_profiles")
        query = (customers_ref
                 .where("dynamics.order_state", "==", "COLLECTING")
                 .where("dynamics.last_interaction", "<=", cutoff)
                 .limit(10))

        docs = await asyncio.to_thread(query.stream)
        followed_up = 0
        for doc in docs:
            data = doc.to_dict() if callable(doc.to_dict) else {}
            user_id = data.get("user_id") or doc.id
            shop_id = data.get("shop_doc_id", "")
            acc_id = data.get("acc_id", "")
            if not shop_id or not acc_id:
                continue

            # Get shop token
            shop_doc = await asyncio.to_thread(
                db.collection("shops").document(shop_id).get
            )
            if not shop_doc.exists:
                continue
            shop_data = shop_doc.to_dict() if callable(shop_doc.to_dict) else {}
            token = await get_sendpulse_token(
                shop_data.get("client_id", ""),
                shop_data.get("client_secret", ""),
            )
            if not token:
                continue

            # Send followup message
            followup_text = "အော်ဒါလေး ဆက်တင်ချင်သေးလားရှင့်။ တစ်ခုခုကူညီပေးရမလား။"
            payload = {
                "bot_id": acc_id,
                "contact_id": user_id,
                "message": {"type": "text", "text": followup_text},
            }
            await bg_post(
                f"https://api.sendpulse.com/chatbots/v2/bot/{acc_id}/messages/send",
                payload, token,
            )
            followed_up += 1

        return {"ok": True, "followed_up": followed_up, "cutoff": cutoff}
    except Exception as e:
        return {"ok": False, "error": str(e)}
