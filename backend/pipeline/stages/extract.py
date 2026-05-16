"""
Pipeline Stage 1: Extract text, bot_id, user_id, and attachments from raw payload.
Pure data extraction — no side effects.
"""
from typing import Optional


def extract_payload_data(data: dict) -> Optional[tuple]:
    """
    Extract core fields from the raw webhook payload.
    Returns (user_msg, acc_id, user_id, attachments) or None if invalid.
    """
    # DEBUG: print raw payload to see format
    import json as _json
    raw_str = _json.dumps(data, default=str, ensure_ascii=False)[:300]
    print(f"📋 Payload: {raw_str}...", flush=True)

    # Handle list/batch — should already be split by webhook handler
    if isinstance(data, list):
        if data:
            data = data[0]
        else:
            return None

    # Extract text deeply from nested structures
    user_msg = _extract_text_deeply(data)
    acc_id = _extract_bot_id(data)
    user_id = _extract_user_id(data)
    attachments = _extract_attachments(data)

    # Fallback: try top-level text field
    if not user_msg and not attachments and data.get("text"):
        user_msg = data.get("text", "").strip()

    # Nothing to process
    if not user_msg and not attachments:
        print(f"⚠️ No text/attachments found in payload. Keys: {list(data.keys())[:10]}", flush=True)
        return None

    if not acc_id or not user_id:
        print(f"❌ Missing IDs: Bot='{acc_id}', User='{user_id}'", flush=True)
        return None

    return (user_msg, acc_id, user_id, attachments)


def _extract_text_deeply(data: dict) -> str:
    """Extract message text from various payload shapes (SendPulse formats)."""
    # Direct text
    if "text" in data and data["text"]:
        return str(data["text"]).strip()

    # Nested data.message
    if isinstance(data.get("data"), dict):
        return _extract_text_deeply(data["data"])

    # Nested message.text
    if isinstance(data.get("message"), dict):
        return str(data["message"].get("text", "")).strip()

    # Raw payload text
    if isinstance(data.get("raw"), dict):
        raw_text = _extract_text_deeply(data["raw"])
        if raw_text:
            return raw_text

    return ""


def _extract_bot_id(data: dict) -> str:
    """Extract bot/account ID from payload."""
    for key in ("bot_id", "acc_id", "account_id"):
        if data.get(key):
            return str(data[key])
    if isinstance(data.get("data"), dict):
        return _extract_bot_id(data["data"])
    return ""


def _extract_user_id(data: dict) -> str:
    """Extract user/contact ID from payload."""
    for key in ("user_id", "contact_id", "conversation_id"):
        if data.get(key):
            return str(data[key])
    if isinstance(data.get("contact"), dict):
        return str(data["contact"].get("id", ""))
    if isinstance(data.get("data"), dict):
        return _extract_user_id(data["data"])
    return ""


def _extract_attachments(data: dict) -> list:
    """Extract media attachments from payload."""
    for key in ("attachments", "media", "files"):
        if data.get(key):
            return data[key] if isinstance(data[key], list) else [data[key]]
    if isinstance(data.get("data"), dict):
        return _extract_attachments(data["data"])
    if isinstance(data.get("message"), dict):
        return _extract_attachments(data["message"])
    return []
