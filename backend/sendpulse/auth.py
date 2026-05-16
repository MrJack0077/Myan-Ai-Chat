"""
SendPulse: OAuth token management.
Get/refresh/cache SendPulse access tokens per shop.
"""
from config import r
from shared.http_client import robust_api_post


async def get_token(client_id: str, client_secret: str) -> str | None:
    """Fetch SendPulse OAuth token with Redis cache (auto-refresh)."""
    if not client_id or not client_secret:
        return None
    cache_key = f"sp:tok:{client_id}"
    if r:
        try:
            cached = await r.get(cache_key)
            if cached:
                return cached
        except Exception:
            pass

    try:
        url = "https://api.sendpulse.com/oauth/access_token"
        payload = {"grant_type": "client_credentials",
                   "client_id": client_id, "client_secret": client_secret}
        res = await robust_api_post(url, payload, "oauth")
        if res:
            data = res.json()
            token = data.get("access_token")
            if token and r:
                expires = int(data.get("expires_in", 3600)) - 60
                try:
                    await r.setex(cache_key, expires, token)
                except Exception:
                    pass
            return token
    except Exception:
        pass
    return None
