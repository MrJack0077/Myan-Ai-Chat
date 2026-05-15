import json
import asyncio
import os
from datetime import datetime
from fastapi import APIRouter, Request, HTTPException
from utils import r, verify_sendpulse_signature
from core.worker import task_queue

router = APIRouter(tags=["Webhook"])

# In-memory log for debugging (Will be cleared on restart)
webhook_logs = []

WEBHOOK_TOKEN = os.getenv("SENDPULSE_WEBHOOK_TOKEN", "").strip().strip('"').strip("'")


async def _verify_webhook(request: Request, body: bytes) -> bool:
    """Verify webhook signature if WEBHOOK_TOKEN is configured."""
    if not WEBHOOK_TOKEN:
        # If no token is configured, log a warning but allow (backward compatibility)
        print("⚠️ WEBHOOK_TOKEN not set — skipping signature verification", flush=True)
        return True
    signature = request.headers.get("X-Sendpulse-Signature", "")
    return verify_sendpulse_signature(body, signature, WEBHOOK_TOKEN)


@router.post("/webhook")
async def sendpulse_webhook(request: Request):
    data = None
    log_entry = {
        "time": datetime.now().isoformat(),
        "method": request.method,
        "path": request.url.path,
        "headers": dict(request.headers),
        "data": None,
        "error": None
    }
    print(f"📡 Webhook Hit: {request.method} {request.url.path}", flush=True)
    
    # Read raw body for signature verification
    raw_body = await request.body()
    
    # Verify webhook signature
    if not await _verify_webhook(request, raw_body):
        log_entry["error"] = "Invalid signature"
        webhook_logs.insert(0, log_entry)
        webhook_logs[:] = webhook_logs[:50]
        print("❌ Webhook signature verification FAILED", flush=True)
        raise HTTPException(status_code=403, detail="Invalid signature")
    
    try:
        # Try JSON first
        data = json.loads(raw_body)
        log_entry["data"] = data
    except Exception as e:
        # Fallback to form data
        try:
            form_data = await request.form()
            if form_data:
                data = dict(form_data)
                log_entry["data"] = data
            else:
                raw_text = raw_body.decode('utf-8', errors='ignore')
                log_entry["data"] = f"Raw: {raw_text}"
                print(f"⚠️ Webhook body not JSON or Form. Raw body: {raw_text}", flush=True)
                if not raw_text:
                     log_entry["error"] = "Empty body"
                     webhook_logs.insert(0, log_entry)
                     webhook_logs[:] = webhook_logs[:50]
                     return {"status": "success", "message": "Ping received"}
        except Exception as e2:
            raw_text = raw_body.decode('utf-8', errors='ignore')
            log_entry["error"] = str(e2)
            log_entry["data"] = f"Raw: {raw_text}"
            print(f"⚠️ Webhook body error: {e2}. Raw body: {raw_text}")
    
    webhook_logs.insert(0, log_entry)
    # Keep only last 50
    webhook_logs[:] = webhook_logs[:50]
    
    if not data:
        return {"status": "success", "message": "No data but acknowledged"}

    # SendPulse webhooks often send a list of events
    if isinstance(data, list):
        print(f"🔢 Processing {len(data)} events in batch", flush=True)
        for event in data:
            await push_to_queue(event)
    else:
        print("📥 Processing single event", flush=True)
        await push_to_queue(data)

    return {"status": "success", "message": "Webhook received"}

@router.get("/webhook/logs")
async def get_webhook_logs():
    return {"logs": webhook_logs}

@router.get("/webhook")
async def test_webhook():
    return {"status": "ok", "message": "Webhook endpoint is active. Use POST to send data.", "recent_logs_count": len(webhook_logs)}

async def push_to_queue(payload):
    """Push task to queue with 4-second debouncing to group consecutive messages."""
    from core.data_extractor import extract_user_id, extract_text_deeply, extract_attachments
    
    user_id = extract_user_id(payload)
    if not user_id:
        # If no user_id, just push immediately
        await _do_push(payload)
        return

    buffer_key = f"debounce_buffer:{user_id}"
    active_key = f"debounce_active:{user_id}"
    
    if r:
        try:
            # Append this payload to the buffer
            await r.rpush(buffer_key, json.dumps(payload))
            
            # Check if a debounce task is already active for this user using setnx (atomic)
            # This prevents multiple debounce tasks for the same user
            was_set = await r.set(active_key, "1", nx=True, ex=10)
            if was_set:
                # Mark as active and start a task to wait and then process the buffer
                asyncio.create_task(debounced_process_buffer(user_id))
            else:
                print(f"⏳ Debouncing: Message from {user_id} added to existing buffer.", flush=True)
            return
        except Exception as e:
            print(f"❌ Redis Debounce Error: {e}", flush=True)
            await _do_push(payload)
    else:
        # Fallback to immediate push if Redis is missing
        await _do_push(payload)

async def debounced_process_buffer(user_id):
    """Wait 2 seconds for burst messages, then merge + push."""
    await asyncio.sleep(2)
    
    buffer_key = f"debounce_buffer:{user_id}"
    active_key = f"debounce_active:{user_id}"
    
    if not r:
        return

    try:
        # Get all payloads from buffer
        payloads_str = await r.lrange(buffer_key, 0, -1)
        if not payloads_str:
            await r.delete(active_key)
            return
            
        payloads = [json.loads(p) for p in payloads_str]
        
        # Smart Grouping: same topic → merge, different topics → split for sequential replies
        if len(payloads) == 1:
            final_payloads = [payloads[0]]
        else:
            print(f"📦 Debouncing: Processing {len(payloads)} messages for {user_id}", flush=True)
            from core.data_extractor import extract_text_deeply, extract_attachments
            
            all_texts = []
            all_attachments = []
            for p in payloads:
                txt = extract_text_deeply(p)
                if txt:
                    if txt not in all_texts:
                        all_texts.append(txt)
                
                attachments = extract_attachments(p)
                if attachments:
                    for att_url in attachments:
                        if att_url not in all_attachments:
                            all_attachments.append(att_url)
            
            # Smart grouping: check if messages are about the SAME topic
            if _are_same_topic(all_texts):
                # Same topic → merge into one payload (one AI reply covers all)
                print(f"   🔗 Same topic: merging {len(all_texts)} msgs → 1 task", flush=True)
                final_payload = payloads[0].copy()
                final_payload["text"] = "\n".join(all_texts) if all_texts else ""
                final_payload["attachments"] = all_attachments
                final_payloads = [final_payload]
            else:
                # Different topics → split into separate payloads (sequential replies)
                print(f"   ✂️ Different topics: splitting {len(all_texts)} msgs → {len(all_texts)} tasks", flush=True)
                final_payloads = []
                for i, p in enumerate(payloads):
                    txt = extract_text_deeply(p)
                    if txt:
                        p_copy = p.copy()
                        p_copy["text"] = txt
                        final_payloads.append(p_copy)
                if not final_payloads:
                    final_payloads = [payloads[0]]

        # Cleanup Redis
        await r.delete(buffer_key)
        await r.delete(active_key)
        
        # Push all payloads to queue (1 merged or N split)
        for fp in final_payloads:
            await _do_push(fp)
        
    except Exception as e:
        print(f"❌ Error in debounced_process_buffer: {e}", flush=True)
        # Try to cleanup so we don't get stuck
        await r.delete(buffer_key)
        await r.delete(active_key)

async def _do_push(payload):
    """Internal push to the actual processing queue."""
    print(f"🚀 Pushing task to queue for Bot ID: {payload.get('bot', {}).get('id', 'Unknown')}", flush=True)
    if r:
        try:
            await r.lpush("sendpulse_task_queue", json.dumps(payload))
            q_len = await r.llen("sendpulse_task_queue")
            print(f"✅ Successfully pushed to Redis queue. Current length: {q_len}", flush=True)
        except Exception as e:
            print(f"❌ Redis queue push error: {e}", flush=True)
            await task_queue.put(payload)
    else:
        print("⚠️ Redis not available, using in-memory queue", flush=True)
        await task_queue.put(payload)


def _are_same_topic(texts: list[str]) -> bool:
    """
    Smart grouping: detect if multiple messages are about the SAME topic.
    
    Uses keyword-based intent classification.
    Returns True if messages should be merged (same topic).
    Returns False if messages should be split (different topics → sequential replies).
    """
    if not texts or len(texts) <= 1:
        return True  # single message, nothing to split
    
    try:
        from core.intent_classifier import fast_intent_classify
    except ImportError:
        return True  # fallback: merge if classifier unavailable
    
    intents = []
    for txt in texts:
        if txt and txt.strip():
            intent, _ = fast_intent_classify(txt.strip(), "NONE")
            if intent:
                intents.append(intent)
    
    # If all messages have the SAME intent → same topic → merge
    if len(set(intents)) <= 1:
        return True
    
    # If intents are related (all shopping-related) → still same topic
    shopping_intents = {"PRODUCT_INQUIRY", "DELIVERY", "PAYMENT", "START_ORDER", "POLICY_FAQ"}
    non_shopping = [i for i in intents if i not in shopping_intents]
    
    # If there's a mix of shopping + non-shopping (e.g., PRODUCT_INQUIRY + OUT_OF_DOMAIN) → split
    if non_shopping and len(non_shopping) < len(intents):
        return False
    
    # If all are shopping intents but DIFFERENT (e.g., PRODUCT_INQUIRY + START_ORDER) → split
    if len(set(intents)) >= 2:
        return False
    
    return True  # default: merge
