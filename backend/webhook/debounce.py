"""
Webhook: Message debounce buffer.
Merges rapid-fire messages from the same user on the same topic,
or splits them into sequential payloads for the worker queue.
"""
import json
import time
from typing import Optional
from config import r

BUFFER_TTL = 4  # seconds — how long to hold messages for merging
DEBOUNCE_KEY_PREFIX = "debounce:"


async def debounce_push(user_id: str, payload: dict) -> Optional[dict]:
    """
    Handle message debounce per user.
    - If same topic as last buffered msg → merge (return None — skip push)
    - If different topic → return old buffered + buffer new (return old dict)
    - If first msg → buffer it (return None, wait for timeout or next msg)
    """
    if not r:
        return payload  # no Redis → no debounce, just pass through

    key = f"{DEBOUNCE_KEY_PREFIX}{user_id}"
    now = time.time()

    try:
        existing_raw = await r.get(key)
        if not existing_raw:
            # First message — store and wait
            await r.setex(key, BUFFER_TTL, json.dumps(payload))
            return None  # buffered

        existing = json.loads(existing_raw)
        if _is_same_topic(existing, payload):
            # Merge: append text, keep latest attachments
            merged = _merge_payloads(existing, payload)
            await r.setex(key, BUFFER_TTL, json.dumps(merged))
            return None  # merged, still waiting

        # Different topic → flush old, buffer new
        await r.setex(key, BUFFER_TTL, json.dumps(payload))
        return existing  # process the old one now

    except Exception:
        return payload  # error → pass through


async def debounce_flush(user_id: str) -> Optional[dict]:
    """Flush any buffered message for a user (called on timeout or new topic)."""
    if not r:
        return None
    try:
        key = f"{DEBOUNCE_KEY_PREFIX}{user_id}"
        raw = await r.get(key)
        if raw:
            await r.delete(key)
            return json.loads(raw)
    except Exception:
        pass
    return None


def _is_same_topic(a: dict, b: dict) -> bool:
    """Check if two payloads belong to the same conversational topic."""
    a_text = (a.get("text", "") or "").strip().lower().rstrip(".!?")
    b_text = (b.get("text", "") or "").strip().lower().rstrip(".!?")
    # Same exact text → same topic
    if a_text == b_text:
        return True
    # Very short messages (1-3 chars) → likely same topic
    if len(a_text) <= 3 and len(b_text) <= 3:
        return True
    # One is a continuation of the other
    shorter = a_text if len(a_text) <= len(b_text) else b_text
    longer = b_text if len(a_text) <= len(b_text) else a_text
    if len(shorter) >= 4 and shorter in longer:
        return True
    return False


def _merge_payloads(old: dict, new: dict) -> dict:
    """Merge two same-topic payloads: concatenate text, use latest meta."""
    merged = {**old, **new}
    old_text = (old.get("text", "") or "").strip()
    new_text = (new.get("text", "") or "").strip()
    if old_text and new_text and old_text != new_text:
        merged["text"] = f"{old_text}\n{new_text}"
    elif not old_text and new_text:
        merged["text"] = new_text
    return merged
