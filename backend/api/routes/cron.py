import asyncio
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter
from utils import db, bg_post, get_sendpulse_token

router = APIRouter(prefix="/api/cron", tags=["Cron"])

SENDPULSE_MSG_URL = "https://api.sendpulse.com/chatbots/v2/bot/{acc_id}/messages/send"

@router.get("/followup")
async def cron_followup():
    """Check for abandoned carts and send follow-up messages"""
    if not db: return {"status": "error", "message": "No DB"}
    try:
        # Find customers who are in COLLECTING or WAITING_FOR_SLIP state
        # and haven't been updated in the last 2 hours
        two_hours_ago = datetime.now(timezone.utc) - timedelta(hours=2)
        
        shops_ref = db.collection("shops")
        shops = await asyncio.to_thread(lambda: list(shops_ref.stream()))
        
        followups_sent = 0
        for shop in shops:
            shop_data = shop.to_dict()
            shop_id = shop.id
            
            # FIX: Use sendpulseBotIds array instead of non-existent "acc_id" field
            bot_ids = shop_data.get("sendpulseBotIds", [])
            if not bot_ids:
                continue
            acc_id = str(bot_ids[0])
            
            # FIX: Get SendPulse OAuth token properly
            client_id = shop_data.get("sendpulseClientId")
            client_secret = shop_data.get("sendpulseClientSecret")
            if not client_id or not client_secret:
                continue
            token = await get_sendpulse_token(client_id, client_secret)
            if not token:
                continue
            
            customers_ref = db.collection("shops").document(shop_id).collection("customers")
            customers = await asyncio.to_thread(lambda: list(customers_ref.stream()))
            
            for cust in customers:
                prof = cust.to_dict()
                
                # FIX: Profile is nested — dynamics.order_state, not flat order_state
                dynamics = prof.get("dynamics", {})
                order_state = dynamics.get("order_state", "NONE")
                last_updated_str = prof.get("last_updated")
                followup_sent = prof.get("followup_sent", False)
                
                if order_state in ["COLLECTING", "WAITING_FOR_SLIP"] and last_updated_str and not followup_sent:
                    try:
                        last_dt = datetime.fromisoformat(last_updated_str)
                    except (ValueError, TypeError):
                        continue
                    
                    if last_dt < two_hours_ago:
                        conv_id = cust.id
                        lang = shop_data.get("aiConfig", {}).get("responseLanguage", "Myanmar")
                        if lang.lower() in ["myanmar", "burmese", "mm"]:
                            msg = "မင်္ဂလာပါရှင်၊ အစ်ကို/အစ်မ ပစ္စည်းလေး ယူဖြစ်မလားရှင့်။ အခက်အခဲတစ်စုံတစ်ရာရှိရင် ပြောပြပေးပါနော်။"
                        else:
                            msg = "Hello! Are you still interested in completing your order? Let us know if you need any help."
                        
                        # FIX: Use proper SendPulse API endpoint
                        send_url = SENDPULSE_MSG_URL.format(acc_id=acc_id)
                        payload = {
                            "bot_id": acc_id,
                            "contact_id": conv_id,
                            "message": {"type": "text", "text": msg}
                        }
                        await bg_post(send_url, payload, token, timeout=15.0)
                        
                        # Mark as sent in Firestore (with correct nested structure)
                        now_iso = datetime.now(timezone.utc).isoformat()
                        await asyncio.to_thread(
                            lambda: customers_ref.document(cust.id).update({
                                "followup_sent": True,
                                "last_updated": now_iso
                            })
                        )
                        followups_sent += 1
                        
        return {"status": "success", "followups_sent": followups_sent}
    except Exception as e:
        print(f"Cron followup error: {e}")
        return {"status": "error", "message": str(e)}
