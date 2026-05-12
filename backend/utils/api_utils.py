import httpx
from tenacity import retry, wait_exponential, stop_after_attempt
from .config import r


def verify_sendpulse_signature(payload_body: bytes, signature_header: str, webhook_token: str) -> bool:
    """Verify SendPulse webhook signature using HMAC-SHA256."""
    import hmac
    import hashlib

    if not webhook_token or not signature_header:
        return False

    try:
        expected_signature = hmac.new(
            webhook_token.encode('utf-8'),
            payload_body,
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected_signature, signature_header)
    except Exception as e:
        print(f"⚠️ Signature verification error: {e}")
        return False


@retry(wait=wait_exponential(multiplier=1, min=1, max=10), stop=stop_after_attempt(2))
async def robust_api_post(url, json_data, token, timeout=7.0):
    """POST to an API with retry logic. Uses Bearer token auth."""
    if not token:
        return None
    token = str(token).strip()

    async with httpx.AsyncClient() as client:
        headers = {"Content-Type": "application/json"}
        if token != "oauth":
            headers.update({
                "api_access_token": token,
                "api-access-token": token,
                "Authorization": f"Bearer {token}",
            })
        res = await client.post(url, json=json_data, headers=headers, timeout=timeout)
        if res.status_code >= 400 and res.status_code != 404:
            res.raise_for_status()
        return res


async def get_sendpulse_token(client_id, client_secret):
    """Fetch and cache SendPulse OAuth token."""
    if not client_id or not client_secret:
        return None
    cache_key = f"sendpulse_token:{client_id}"
    if r:
        try:
            cached = await r.get(cache_key)
            if cached:
                return cached
        except Exception:
            pass

    try:
        url = "https://api.sendpulse.com/oauth/access_token"
        payload = {"grant_type": "client_credentials", "client_id": client_id, "client_secret": client_secret}
        res = await robust_api_post(url, payload, "oauth")
        if res:
            data = res.json()
            if "access_token" in data:
                token = data["access_token"]
                if r:
                    expires_in = int(data.get("expires_in", 3600)) - 60
                    try:
                        await r.setex(cache_key, expires_in, token)
                    except Exception:
                        pass
                return token
    except Exception:
        pass
    return None


async def bg_post(url, json_data, token, timeout=7.0):
    """Post to API, swallowing errors. For background/typing tasks."""
    try:
        return await robust_api_post(url, json_data, token, timeout=timeout)
    except Exception:
        return None