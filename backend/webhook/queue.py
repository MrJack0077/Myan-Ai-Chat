"""
Webhook: Queue operations — push tasks to Redis queue for workers.
Memory queue removed — Redis is mandatory. No event loop issues.
"""
import json
import asyncio
from config import r

QUEUE_KEY = "sendpulse_task_queue"


async def push_to_queue(payload: dict) -> bool:
    """Push a webhook task to the Redis worker queue."""
    data_str = json.dumps(payload, default=str)
    if r:
        try:
            await r.lpush(QUEUE_KEY, data_str)
            return True
        except Exception as e:
            print(f"⚠️ Redis lpush failed: {e}", flush=True)
    print("❌ Redis unavailable — cannot queue message", flush=True)
    return False


async def pop_from_queue(timeout: float = 5.0) -> dict | None:
    """
    Blocking pop from Redis queue.
    Returns parsed dict or None on timeout/empty.
    """
    if not r:
        await asyncio.sleep(timeout)
        return None
    try:
        result = await r.brpop(QUEUE_KEY, timeout=int(timeout))
        if result:
            return json.loads(result[1])
    except Exception as e:
        print(f"⚠️ Redis brpop failed: {e}", flush=True)
    return None
