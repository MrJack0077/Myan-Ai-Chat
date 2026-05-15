from .config import r
import json
import asyncio
from .api_utils import bg_post

async def send_sendpulse_messages(acc_id, user_id, final_data, reply_text, token, channel=""):
    """Send messages via SendPulse. Uses channel hint for direct routing (no 404 loops)."""
    # Build payloads
    messages_payload = []
    
    extracted_data = final_data.get("extracted", {}) if isinstance(final_data, dict) else {}
    image_urls = extracted_data.get("images", [])
    
    for img_url in image_urls:
        if img_url:
            messages_payload.append({"type": "image", "image_url": img_url})

    buttons = extracted_data.get("buttons", [])
    if reply_text or buttons:
        msg_obj = {"type": "text", "text": reply_text or "..."}
        if buttons:
            msg_obj["replies"] = [{"id": str(i), "text": btn} for i, btn in enumerate(buttons)]
        messages_payload.append(msg_obj)

    if not messages_payload:
        messages_payload.append({"type": "text", "text": "OK"})

    # ── Direct channel routing (no 404 loops) ──
    channel_lower = (channel or "").lower()
    
    for msg in messages_payload:
        # Build base payload
        payload = {"bot_id": acc_id, "contact_id": user_id, "message": msg}
        
        # Determine primary URL by channel
        if channel_lower == "telegram" or user_id.startswith("tg_"):
            primary_url = "https://api.sendpulse.com/telegram/contacts/send"
            fallback_payload = {"contact_id": user_id, "message": msg}
            primary_payload = fallback_payload
        elif channel_lower == "messenger" or channel_lower == "facebook":
            primary_url = "https://api.sendpulse.com/messenger/contacts/send"
            primary_payload = build_messenger_payload(user_id, msg)
        else:
            # Unknown channel → try v2 first, fallback to general
            primary_url = f"https://api.sendpulse.com/chatbots/v2/bot/{acc_id}/messages/send"
            primary_payload = payload
        
        print(f"📤 SendPulse → {primary_url} (channel={channel_lower}) | type={msg.get('type')}", flush=True)
        
        try:
            resp = await bg_post(primary_url, primary_payload, token, timeout=3.0)
            status = resp.status_code if resp else 'No Resp'
            print(f"📬 SendPulse: {status}", flush=True)
            
            if resp and resp.status_code == 404:
                # Only fallback if primary fails
                fallback_url = f"https://api.sendpulse.com/chatbots/v1/bot/{acc_id}/messages/send"
                print(f"⚠️ 404 → Trying v1: {fallback_url}", flush=True)
                resp = await bg_post(fallback_url, payload, token, timeout=3.0)
                print(f"📬 v1: {resp.status_code if resp else 'No Resp'}", flush=True)
            
            if resp and resp.status_code >= 400:
                print(f"❌ SendPulse Error [{resp.status_code}]: {resp.text}", flush=True)
        except Exception as api_e:
            print(f"❌ SendPulse Exception: {api_e}", flush=True)


def build_messenger_payload(user_id, msg):
    """Build Messenger-specific payload with quick replies support."""
    base = {"contact_id": user_id, "message": {"type": "RESPONSE", "content_type": "message", "text": msg.get("text", "")}}
    
    if msg.get("type") == "image":
        base["message"]["content_type"] = "media_img"
        base["message"]["img"] = msg.get("image_url", "")
        base["message"].pop("text", None)
    elif "replies" in msg and len(msg["replies"]) > 0:
        base["message"]["content_type"] = "template"
        base["message"]["data"] = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "generic",
                    "elements": [{
                        "title": msg.get("text", "Select:"),
                        "buttons": [{"type": "postback", "title": b["text"][:20], "payload": b["text"][:20]} for b in msg["replies"]]
                    }]
                }
            }
        }
        base["message"].pop("text", None)
    
    return base
