"""
Pipeline Stage 2: Validate request — rate limit, plan check, user lock, token.
Returns (shop, shop_doc_id, token, profile) or raises/returns None.
"""
import json
from config import r
from shared.redis import check_rate_limit
from shared.http_client import get_sendpulse_token
from shared.exceptions import ShopNotFoundError, RateLimitError, TokenError
from shops.service import get_shop_data
from customers.profile import get_profile
from webhook.queue import push_to_queue


async def validate_request(acc_id: str, user_id: str, data: dict) -> tuple | None:
    """
    Validate the incoming request:
    1. Per-user lock for sequential processing
    2. Load shop data from Firestore
    3. Check rate limit
    4. Fetch SendPulse token
    5. Load user profile
    """
    # ── Per-user sequential lock ──
    if not await _acquire_lock(user_id):
        print(f"⏳ User {user_id[:20]}... locked, re-queuing", flush=True)
        await push_to_queue(data)
        return None

    # ── Load shop ──
    shop = await get_shop_data(acc_id)
    if not shop:
        print(f"❌ Shop not found for bot_id: '{acc_id}'. Tried sendpulseBotIds + acc_id + full scan.", flush=True)
        await _release_lock(user_id)
        return None
    shop_doc_id = shop["shop_doc_id"]
    print(f"✅ Shop found: {shop.get('name', shop_doc_id)} (id={shop_doc_id})", flush=True)

    # ── Rate limit check ──
    if not await check_rate_limit(shop_doc_id):
        print(f"⚠️ Rate limit: {shop_doc_id}", flush=True)
        from shops.analytics import log_analytics
        await log_analytics(shop_doc_id, "rate_limit_exceeded", {"user_id": user_id})
        await _release_lock(user_id)
        return None

    # ── Fetch token + profile in parallel ──
    import asyncio
    token, prof = await asyncio.gather(
        get_sendpulse_token(
            shop.get("sendpulseClientId") or shop.get("client_id"),
            shop.get("sendpulseClientSecret") or shop.get("client_secret"),
        ),
        get_profile(shop_doc_id, user_id),
    )

    if not token:
        print(f"❌ Token failed for bot: '{acc_id}'. Shop may not have SendPulse credentials.", flush=True)
        await _release_lock(user_id)
        return None

    return (shop, shop_doc_id, token, prof)


USER_LOCK_TTL = 30


async def _acquire_lock(user_id: str) -> bool:
    """Try to acquire a per-user processing lock."""
    if not r:
        return True
    try:
        return bool(await r.set(f"user_lock:{user_id}", "1", nx=True, ex=USER_LOCK_TTL))
    except Exception:
        return True


async def _release_lock(user_id: str):
    """Release the per-user processing lock."""
    if not r:
        return
    try:
        await r.delete(f"user_lock:{user_id}")
    except Exception:
        pass
