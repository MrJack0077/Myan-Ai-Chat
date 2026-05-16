"""
Pipeline Stage 3: Load customer profile, segment, update state.
"""
from datetime import datetime, timezone


async def load_and_update_profile(prof: dict, shop_doc_id: str,
                                  user_id: str, user_msg: str) -> tuple:
    """
    Load + update customer profile.
    - Segment customer (new/returning/vip)
    - Expire stale order state
    - Increment message count
    - Auto-extract phone from message
    Returns (prof, order_state).
    """
    from customers.profile import save_profile, segment_customer, expire_order_state

    # Segment
    segment_customer(prof)

    # ID enrichment
    ident = prof.get("identification", {})
    if not ident.get("messenger_id") and "ps_" in user_id:
        ident["messenger_id"] = user_id
    elif not ident.get("telegram_id") and "tg_" in user_id:
        ident["telegram_id"] = user_id

    # Order state
    order_state = prof.get("dynamics", {}).get("order_state", "NONE")
    if order_state == "HUMAN_HANDOVER":
        return prof, "HUMAN_HANDOVER"

    order_state = await expire_order_state(prof, shop_doc_id, user_id)

    # Update dynamics
    dynamics = prof.setdefault("dynamics", {})
    dynamics["message_count"] = dynamics.get("message_count", 0) + 1
    dynamics["last_interaction"] = datetime.now(timezone.utc).isoformat()

    # Auto-extract phone
    _auto_extract_phone(user_msg, prof)

    return prof, order_state


def _auto_extract_phone(text: str, prof: dict) -> None:
    """Auto-detect Myanmar phone number and save to profile."""
    import re
    match = re.search(r'(09\d{7,10}|\+?959\d{7,9})', text)
    if match:
        phone = match.group(1)
        current = prof.get("identification", {}).get("phone", "")
        if phone != current:
            prof.setdefault("identification", {})["phone"] = phone
            print(f"📱 Phone auto-extracted: {phone}", flush=True)
