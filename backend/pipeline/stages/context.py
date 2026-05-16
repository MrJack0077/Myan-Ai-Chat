"""
Pipeline Stage 4: Build conversation context — history, media, typing indicator.
"""
import asyncio
from customers.history import add_to_history, get_history
from sendpulse.actions import send_typing


async def build_context(
    shop_doc_id: str, conv_id: str, user_msg: str,
    attachments: list, ai_config: dict, acc_id: str, token: str,
) -> tuple:
    """
    Build conversation context:
    - Send typing indicator
    - Download media attachments
    - Save message to chat history
    - Detect photo context
    Returns (chat_history, media_parts, photo_context).
    """
    # ── Send typing indicator (fire-and-forget) ──
    asyncio.create_task(send_typing(acc_id, conv_id, token))

    # ── Download media ──
    media_parts = await _download_media(attachments)
    photo_context = _detect_photo_context(user_msg, attachments, media_parts)

    # ── Save to history ──
    hist_msg = user_msg if user_msg else _media_label(media_parts)
    await add_to_history(shop_doc_id, conv_id, "Customer", hist_msg, max_len=10)
    chat_history = await get_history(shop_doc_id, conv_id)

    return chat_history, media_parts, photo_context


async def _download_media(attachments: list) -> list:
    """Download media attachments for Gemini processing."""
    if not attachments:
        return []

    import httpx
    parts = []
    for att in attachments:
        url = att.get("url") or att.get("file_url") or ""
        mime = att.get("mime_type") or att.get("type") or "image/jpeg"
        if not url:
            continue
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, timeout=5.0)
                if resp.status_code == 200:
                    parts.append({
                        "mime_type": mime,
                        "data": resp.content,
                    })
        except Exception as e:
            print(f"⚠️ Media download failed: {url[:60]}... {e}", flush=True)

    return parts


def _detect_photo_context(user_msg: str, attachments: list, media_parts: list) -> str:
    """Detect what kind of photo was sent (payment slip, product, etc.)."""
    if not attachments and not media_parts:
        # Check for image URLs in text
        if user_msg and any(p in user_msg for p in [".jpg", ".png", ".jpeg", "img="]):
            return "🔗 Customer sent a link to an image."

    if attachments or media_parts:
        return "📸 Customer sent an image. Analyze it naturally with the message."

    return ""


def _media_label(media_parts: list) -> str:
    """Generate a label for media-only messages."""
    if not media_parts:
        return "[Message]"
    has_audio = any("audio" in p.get("mime_type", "") for p in media_parts)
    return "[Voice Message]" if has_audio else "[Photo]"
