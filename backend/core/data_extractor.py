"""Webhook data extraction: text, IDs, attachments, media download."""
import base64
import httpx


def extract_text_deeply(obj):
    """Deep-extract text from nested SendPulse payload structures."""
    if not obj:
        return ""
    if isinstance(obj, str):
        return obj
    if not isinstance(obj, dict):
        return ""

    # Priority 0: Top-level text (used in merged/debounced payloads)
    if isinstance(obj, dict) and obj.get("text"):
        return obj.get("text").strip()

    # Priority 1: Direct text fields
    pts = [
        obj.get("text"),
        obj.get("message", {}).get("text") if isinstance(obj.get("message"), dict) else None,
        obj.get("last_message"),
        None,
        None,
    ]
    # Deep nested paths
    try:
        pts[3] = obj.get("info", {}).get("message", {}).get("channel_data", {}).get("message", {}).get("text")
    except Exception:
        pass
    try:
        pts[4] = obj.get("last_message_data", {}).get("message", {}).get("text")
    except Exception:
        pass

    for p in pts:
        if p and isinstance(p, str) and p.strip():
            return p.strip()

    # Priority 2: Recursive search
    for val in obj.values():
        if isinstance(val, dict):
            res = extract_text_deeply(val)
            if res:
                return res
    return ""


def extract_bot_id(data):
    """Extract bot/account ID from webhook payload."""
    # Priority 1: Direct fields
    acc_id = str(data.get("bot_id") or data.get("acc_id") or "").strip()
    
    if not acc_id:
        # Check deep structure
        bot = data.get("bot") or {}
        acc_id = str(
            bot.get("id") 
            or bot.get("external_id")
            or data.get("bot_id") 
            or data.get("info", {}).get("bot_id")
            or data.get("recipient_id")
            or data.get("last_message_data", {}).get("recipient_id")
            or data.get("info", {}).get("message", {}).get("channel_id")
            or data.get("info", {}).get("message", {}).get("channel_data", {}).get("bot_id")
            or ""
        )
    return acc_id


def extract_user_id(data):
    """Extract user/contact ID from webhook payload."""
    # 1. Direct fields
    user_id = str(data.get("contact_id") or data.get("sender_id") or data.get("user_id") or "").strip()
    
    if not user_id:
        # 2. Extract from contact object
        contact = data.get("contact") or {}
        user_id = str(contact.get("external_id") or contact.get("id") or "").strip()

    if not user_id:
        # 3. Deep info blocks common in SendPulse
        info_msg = data.get("info", {}).get("message", {})
        if isinstance(info_msg, dict):
            chan_data = info_msg.get("channel_data", {})
            if isinstance(chan_data, dict):
                user_id = str(chan_data.get("contact_id") or chan_data.get("sender_id") or "").strip()

    if not user_id:
        # 4. Final fallbacks
        user_id = str(
            data.get("last_message_data", {}).get("sender_id")
            or ""
        )
        
    return user_id


def extract_attachments(data):
    """Extract attachment URLs from webhook payload."""
    attachments = []
    
    # Priority 0: Top-level attachments (from our debouncer)
    top_atts = data.get("attachments")
    if top_atts and isinstance(top_atts, list):
        for att in top_atts:
            if isinstance(att, str):
                attachments.append(att)
            elif isinstance(att, dict) and att.get("url"):
                attachments.append(att["url"])
    
    msg_data = data.get("message") or {}
    
    # SendPulse standard format
    attachment_data = msg_data.get("attachment")
    if attachment_data:
        file_info = attachment_data.get("file", {})
        att_url = file_info.get("url")
        if att_url:
            attachments.append(att_url)

    # Fallback flat attachments list
    if "attachments" in msg_data and isinstance(msg_data["attachments"], list):
        for att in msg_data["attachments"]:
            if isinstance(att, dict) and "url" in att:
                attachments.append(att["url"])

    return attachments


async def download_media_parts(attachment_urls):
    """Download attachments and convert to base64 media parts for Gemini."""
    media_parts = []
    if not attachment_urls:
        return media_parts

    # Audio/voice MIME types that Gemini can process
    AUDIO_MIME_TYPES = {
        "audio/mpeg", "audio/mp3", "audio/wav", "audio/wave",
        "audio/ogg", "audio/opus", "audio/webm", "audio/aac",
        "audio/m4a", "audio/mp4", "audio/x-m4a",
        "audio/amr",  # common voice note format in messengers
    }
    VIDEO_MIME_TYPES = {
        "video/mp4", "video/webm", "video/mpeg", "video/quicktime",
    }
    IMAGE_MIME_TYPES = {
        "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/bmp",
    }

    for att_url in attachment_urls:
        try:
            print(f"📥 Downloading attachment: {att_url[:80]}...")
            async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
                att_resp = await client.get(att_url)
                att_resp.raise_for_status()
                
                mime_type = att_resp.headers.get("Content-Type", "").lower().split(";")[0].strip()
                
                # Try detecting MIME from URL extension if header is generic
                if not mime_type or mime_type in ("application/octet-stream", "binary/octet-stream"):
                    mime_type = _guess_mime_from_url(att_url)

                is_image = mime_type in IMAGE_MIME_TYPES or mime_type.startswith("image/")
                is_audio = mime_type in AUDIO_MIME_TYPES or mime_type.startswith("audio/")
                is_video = mime_type in VIDEO_MIME_TYPES or mime_type.startswith("video/")

                if is_image or is_audio or is_video:
                    b64_data = base64.b64encode(att_resp.content).decode("utf-8")
                    media_parts.append({"mime_type": mime_type, "data": b64_data})
                    emoji = "🖼️" if is_image else ("🎤" if is_audio else "🎬")
                    print(f"   {emoji} Downloaded: {mime_type} ({len(att_resp.content)} bytes)")
                else:
                    print(f"   ⚠️ Skipping unsupported MIME: {mime_type}")

        except httpx.HTTPStatusError as e:
            print(f"❌ HTTP error downloading attachment {att_url[:80]}: {e.response.status_code}")
        except httpx.TimeoutException:
            print(f"❌ Timeout downloading attachment {att_url[:80]}")
        except Exception as e:
            print(f"❌ Error downloading attachment {att_url[:80]}: {e}")

    return media_parts


def _guess_mime_from_url(url: str) -> str:
    """Guess MIME type from URL file extension."""
    url_lower = url.lower().split("?")[0]  # remove query params
    if url_lower.endswith(('.mp3',)):
        return 'audio/mpeg'
    if url_lower.endswith(('.wav', '.wave')):
        return 'audio/wav'
    if url_lower.endswith(('.ogg', '.opus')):
        return 'audio/ogg'
    if url_lower.endswith(('.m4a',)):
        return 'audio/mp4'
    if url_lower.endswith(('.aac',)):
        return 'audio/aac'
    if url_lower.endswith(('.amr',)):
        return 'audio/amr'
    if url_lower.endswith(('.webm',)):
        return 'audio/webm'
    if url_lower.endswith(('.mp4', '.mpeg', '.mpg')):
        return 'video/mp4'
    if url_lower.endswith(('.jpg', '.jpeg')):
        return 'image/jpeg'
    if url_lower.endswith(('.png',)):
        return 'image/png'
    if url_lower.endswith(('.gif',)):
        return 'image/gif'
    if url_lower.endswith(('.webp',)):
        return 'image/webp'
    return 'application/octet-stream'


def update_nested_profile(prof, updates):
    """Update nested profile structure based on flat keys from AI extraction."""
    if not updates or not isinstance(updates, dict):
        return
    
    # Ensure nested groups exist
    for grp in ["identification", "dynamics", "current_order", "ai_insights", "sales_data"]:
        if grp not in prof: prof[grp] = {}

    # Identification
    if "name" in updates: prof["identification"]["name"] = updates["name"]
    if "phone" in updates: prof["identification"]["phone"] = updates["phone"]
    if "language" in updates: prof["identification"]["language"] = updates["language"]
    
    # Current Order
    if "address" in updates: prof["current_order"]["address"] = updates["address"]
    if "payment_method" in updates: prof["current_order"]["payment_method"] = updates["payment_method"]
    if "items" in updates: 
        if isinstance(updates["items"], list):
            prof["current_order"]["items"] = updates["items"]
    
    # Dynamics
    if "current_intent" in updates: prof["dynamics"]["current_intent"] = updates["current_intent"]
    if "order_state" in updates: prof["dynamics"]["order_state"] = updates["order_state"]

    # Top level / Other
    # If there are other keys like service_type, add to top level if appropriate
    for k, v in updates.items():
        if k not in ["name", "phone", "language", "address", "payment_method", "items", "current_intent", "order_state"]:
             prof[k] = v
