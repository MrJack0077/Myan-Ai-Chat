"""
API Route: POST /webhook — Receive SendPulse webhooks, verify, debounce, enqueue.
Thin HTTP layer — all logic delegated to webhook/ and shared/ modules.
"""
import json
from datetime import datetime
from fastapi import APIRouter, Request, HTTPException
from config import r
from shared.http_client import verify_sendpulse_signature
from webhook.queue import push_to_queue

router = APIRouter(tags=["Webhook"])

# In-memory log for debugging (cleared on restart)
webhook_logs = []


async def _verify_webhook(request: Request, body: bytes) -> bool:
    """Verify webhook signature if WEBHOOK_TOKEN is configured."""
    import os
    webhook_token = os.getenv("SENDPULSE_WEBHOOK_TOKEN", "").strip().strip('"').strip("'")
    if not webhook_token:
        return True  # No token configured → allow all
    signature = request.headers.get("X-Sendpulse-Signature", "")
    return verify_sendpulse_signature(body, signature, webhook_token)


@router.post("/webhook")
async def sendpulse_webhook(request: Request):
    """Handle incoming SendPulse webhook events."""
    log_entry = {
        "time": datetime.now().isoformat(),
        "method": request.method,
        "path": str(request.url.path),
        "headers": dict(request.headers),
        "data": None,
        "error": None,
    }

    raw_body = await request.body()

    # Verify signature
    if not await _verify_webhook(request, raw_body):
        log_entry["error"] = "Invalid signature"
        webhook_logs.insert(0, log_entry)
        webhook_logs[:] = webhook_logs[:50]
        raise HTTPException(status_code=403, detail="Invalid signature")

    # Parse payload
    data = None
    try:
        data = json.loads(raw_body)
    except Exception:
        try:
            form_data = await request.form()
            if form_data:
                data = dict(form_data)
        except Exception:
            pass

    log_entry["data"] = data
    webhook_logs.insert(0, log_entry)
    webhook_logs[:] = webhook_logs[:50]

    if not data:
        return {"status": "success", "message": "No data but acknowledged"}

    # Batch or single event
    events = data if isinstance(data, list) else [data]
    print(f"🔢 Processing {len(events)} events", flush=True)
    for event in events:
        await push_to_queue(event)

    return {"status": "success", "message": "Webhook received"}


@router.get("/webhook/logs")
async def get_webhook_logs():
    """Return recent webhook activity logs."""
    return {"logs": webhook_logs}


@router.get("/webhook")
async def test_webhook():
    """Health check / test endpoint for webhook."""
    return {
        "status": "ok",
        "message": "Webhook endpoint is active. Use POST to send data.",
        "recent_logs_count": len(webhook_logs),
    }
