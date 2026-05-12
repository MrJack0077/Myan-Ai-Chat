from .config import r
import json
import asyncio
from .api_utils import bg_post

async def send_sendpulse_messages(acc_id, user_id, final_data, reply_text, token):
    send_url = f"https://api.sendpulse.com/chatbots/v2/bot/{acc_id}/messages/send"
    messages_payload = []
    
    extracted_data = final_data.get("extracted", {}) if isinstance(final_data, dict) else {}
    image_urls = extracted_data.get("images", [])
    
    for img_url in image_urls:
        if img_url:
            messages_payload.append({
                "type": "image",
                "image_url": img_url
            })

    buttons = extracted_data.get("buttons", [])
    if reply_text or buttons:
        msg_obj = {
            "type": "text",
            "text": reply_text or "..."
        }
        if buttons:
            msg_obj["replies"] = [{"id": str(i), "text": btn} for i, btn in enumerate(buttons)]
        
        messages_payload.append(msg_obj)

    if not messages_payload:
        messages_payload.append({"type": "text", "text": "OK"})

    # Quick reply buttons ARE enabled — agents generate them for better UX
    for msg in messages_payload:
        payload = {
            "bot_id": acc_id,
            "contact_id": user_id,
            "message": msg
        }
        
        fallback_payload = {
            "contact_id": user_id,
            "message": msg
        }
        
        messenger_payload = {
            "contact_id": user_id,
            "message": {
                "type": "RESPONSE",
                "content_type": "message",
                "text": msg.get("text", "")
            }
        }
        if msg.get("type") == "image":
            messenger_payload["message"]["content_type"] = "media_img"
            messenger_payload["message"]["img"] = msg.get("image_url", "")
            messenger_payload["message"].pop("text", None)
        elif "replies" in msg and len(msg["replies"]) > 0:
            messenger_payload["message"]["content_type"] = "template"
            messenger_payload["message"]["data"] = {
                "attachment": {
                    "type": "template",
                    "payload": {
                        "template_type": "generic",
                        "elements": [{
                            "title": msg.get("text", "Select an option:"),
                            "buttons": [{"type": "postback", "title": b["text"][:20], "payload": b["text"][:20]} for b in msg["replies"]]
                        }]
                    }
                }
            }
            messenger_payload["message"].pop("text", None)
        
        print(f"📤 Posting to SendPulse: {send_url} with payload type {msg.get('type')} for contact {user_id}", flush=True)
        try:
            resp = await bg_post(send_url, payload, token, timeout=5.0)
            print(f"📬 SendPulse Answer (v2): {resp.status_code if resp else 'No Resp'}", flush=True)
            if resp and resp.status_code == 404:
                # Smart fallback: detect Telegram users (ID starts with tg_) and try Telegram first
                is_telegram = user_id.startswith("tg_") if user_id else False
                
                if is_telegram:
                    # For Telegram bots, v2/v1 chatbot endpoints always 404 — go direct to Telegram
                    fallbacks = [
                        "https://api.sendpulse.com/telegram/contacts/send",
                    ]
                else:
                    # Try most common channels first (Messenger, Telegram)
                    fallbacks = [
                        "https://api.sendpulse.com/messenger/contacts/send",
                        "https://api.sendpulse.com/telegram/contacts/send",
                        f"https://api.sendpulse.com/chatbots/v1/bot/{acc_id}/messages/send",
                        "https://api.sendpulse.com/instagram/contacts/send",
                        "https://api.sendpulse.com/whatsapp/contacts/send",
                        "https://api.sendpulse.com/facebook/contacts/send",
                        "https://api.sendpulse.com/viber/contacts/send"
                    ]
                for alt_url in fallbacks:
                    print(f"⚠️ v2 endpoint 404. Trying fallback: {alt_url}", flush=True)
                    p = payload
                    if "messenger" in alt_url:
                        p = messenger_payload
                    elif "chatbots" not in alt_url:
                        p = fallback_payload
                        
                    resp = await bg_post(alt_url, p, token, timeout=5.0)
                    print(f"📬 Fallback Answer ({alt_url}): {resp.status_code if resp else 'No Resp'}", flush=True)
                    if resp and resp.status_code not in (404, 401, 422):
                        break
                    if resp and resp.status_code == 422:
                        print(f"❌ 422 Invalid Payload for {alt_url}: {resp.text}")
                        pass

            if resp:
                if resp.status_code >= 400:
                    print(f"❌ SendPulse Error [{resp.status_code}]: {resp.text}", flush=True)
            else:
                print("❌ SendPulse Error: No response received from bg_post", flush=True)
        except Exception as api_e:
            print(f"❌ SendPulse API Exception: {api_e}", flush=True)
