"""
SendPulse: Message sending with channel-aware routing.
Handles Messenger, Telegram, and generic chatbot message delivery.
"""
import asyncio
from .client import call_with_fallback, fire_and_forget


async def send_message(
    acc_id: str, user_id: str, reply_text: str,
    extracted: dict, token: str, channel: str = "",
) -> None:
    """
    Send AI reply message(s) to user via SendPulse.
    Routes to correct channel endpoint (Messenger/Telegram/Viber/Chatbot).
    """
    messages_payload = _build_message_payloads(reply_text, extracted)
    if not messages_payload:
        messages_payload = [{"type": "text", "text": "OK"}]

    channel_lower = (channel or "").lower()

    for msg in messages_payload:
        payload = {"bot_id": acc_id, "contact_id": user_id, "message": msg}

        if channel_lower == "telegram" or user_id.startswith("tg_"):
            primary_url = "https://api.sendpulse.com/telegram/contacts/send"
            result = await fire_and_forget(primary_url, {"contact_id": user_id, "message": msg}, token)
            primary_url = primary_url  # unused further

        elif channel_lower in ("messenger", "facebook"):
            primary_url = "https://api.sendpulse.com/messenger/contacts/send"
            fb_payload = _build_messenger_payload(user_id, msg)
            await fire_and_forget(primary_url, fb_payload, token)

        else:
            v2_url = f"https://api.sendpulse.com/chatbots/v2/bot/{acc_id}/messages/send"
            v1_url = f"https://api.sendpulse.com/chatbots/v1/bot/{acc_id}/messages/send"
            result = await call_with_fallback(v2_url, v1_url, payload, token)
            if not result["ok"]:
                print(f"❌ SendPulse send failed: status={result['status']}", flush=True)


def _build_message_payloads(reply_text: str, extracted: dict) -> list[dict]:
    """Build ordered list of message payloads (images first, then text)."""
    payloads = []
    ext = extracted or {}

    for img_url in ext.get("images", []):
        if img_url:
            payloads.append({"type": "image", "image_url": img_url})

    buttons = ext.get("buttons", [])
    if reply_text or buttons:
        msg_obj = {"type": "text", "text": reply_text or "..."}
        if buttons:
            msg_obj["replies"] = [
                {"id": str(i), "text": btn} for i, btn in enumerate(buttons)
            ]
        payloads.append(msg_obj)

    return payloads


def _build_messenger_payload(user_id: str, msg: dict) -> dict:
    """Build Messenger-specific payload with quick-reply support."""
    base = {
        "contact_id": user_id,
        "message": {"type": "RESPONSE", "content_type": "message",
                     "text": msg.get("text", "")},
    }
    msg_type = msg.get("type")
    if msg_type == "image":
        base["message"]["content_type"] = "media_img"
        base["message"]["img"] = msg.get("image_url", "")
        base["message"].pop("text", None)
    elif msg.get("replies"):
        buttons = [
            {"type": "postback", "title": b["text"][:20], "payload": b["text"][:20]}
            for b in msg["replies"]
        ]
        base["message"]["content_type"] = "template"
        base["message"]["data"] = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "generic",
                    "elements": [{"title": msg.get("text", "Select:"), "buttons": buttons}],
                },
            }
        }
        base["message"].pop("text", None)
    return base
