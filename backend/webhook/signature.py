"""
Webhook: SendPulse signature verification.
Extracted from API layer so it can be reused/tested independently.
"""
import hmac
import hashlib


def verify_signature(payload_body: bytes, signature_header: str,
                     webhook_token: str) -> bool:
    """Verify SendPulse webhook signature using HMAC-SHA256."""
    if not webhook_token or not signature_header:
        return False
    try:
        expected = hmac.new(
            webhook_token.encode('utf-8'),
            payload_body,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature_header)
    except Exception as e:
        print(f"⚠️ Signature verification error: {e}", flush=True)
        return False
