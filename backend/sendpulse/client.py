"""
SendPulse: Low-level HTTP client with v2→v1 fallback.
All SendPulse HTTP calls go through this module.
"""
import httpx
from tenacity import retry, wait_exponential, stop_after_attempt


SENDPULSE_BASE_V2 = "https://api.sendpulse.com/chatbots/v2"
SENDPULSE_BASE_V1 = "https://api.sendpulse.com/chatbots/v1"


@retry(wait=wait_exponential(multiplier=1, min=1, max=10), stop=stop_after_attempt(2))
async def _post(url: str, json_data: dict, token: str, timeout: float = 7.0):
    """Internal: POST with retry and auth headers."""
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


async def call_with_fallback(
    v2_url: str, v1_url: str, payload: dict, token: str, timeout: float = 3.0
) -> dict:
    """
    Try v2 endpoint first. On 404 → fallback to v1.
    Returns {"ok": bool, "status": int, "body": str}.
    """
    # Try v2
    try:
        resp = await _post(v2_url, payload, token, timeout)
        if resp and resp.status_code != 404:
            return {"ok": resp.status_code < 400, "status": resp.status_code,
                    "body": resp.text}
        if resp and resp.status_code == 404:
            print(f"⚠️ v2 404 → falling back to v1: {v1_url}", flush=True)
    except Exception as e:
        print(f"⚠️ v2 exception: {e} → trying v1", flush=True)

    # Fallback v1
    try:
        resp = await _post(v1_url, payload, token, timeout)
        if resp:
            return {"ok": resp.status_code < 400, "status": resp.status_code,
                    "body": resp.text}
    except Exception as e:
        print(f"❌ v1 also failed: {e}", flush=True)

    return {"ok": False, "status": 0, "body": ""}


async def fire_and_forget(url: str, payload: dict, token: str, timeout: float = 3.0):
    """Post to SendPulse without waiting for response. For typing indicators."""
    try:
        await _post(url, payload, token, timeout)
    except Exception:
        pass  # Silent — typing failures shouldn't block
