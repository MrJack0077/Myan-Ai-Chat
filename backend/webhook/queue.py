"""
Webhook: Queue operations — push tasks to Redis/memory queue for workers.
"""
import json
import asyncio
from config import r

QUEUE_KEY = "sendpulse_task_queue"
# In-memory fallback (asyncio.Queue) for when Redis is unavailable
_memory_queue: asyncio.Queue | None = None


def _get_memory_queue() -> asyncio.Queue:
    global _memory_queue
    if _memory_queue is None:
        _memory_queue = asyncio.Queue(maxsize=500)
    return _memory_queue


async def push_to_queue(payload: dict) -> bool:
    """Push a webhook task to the worker queue. Returns True on success."""
    data_str = json.dumps(payload, default=str)
    if r:
        try:
            await r.lpush(QUEUE_KEY, data_str)
            return True
        except Exception as e:
            print(f"⚠️ Redis lpush failed, using memory queue: {e}", flush=True)

    # Fallback to in-memory queue
    try:
        queue = _get_memory_queue()
        queue.put_nowait(data_str)
        return True
    except asyncio.QueueFull:
        print("❌ Memory queue full — dropping message", flush=True)
        return False


async def pop_from_queue(timeout: float = 5.0) -> dict | None:
    """
    Blocking pop from queue. Returns parsed dict or None on timeout/empty.
    Used by worker_process().
    """
    if r:
        try:
            result = await r.brpop(QUEUE_KEY, timeout=int(timeout))
            if result:
                return json.loads(result[1])
        except Exception as e:
            print(f"⚠️ Redis brpop failed, trying memory queue: {e}", flush=True)

    # Fallback to memory queue
    try:
        raw = await asyncio.wait_for(_get_memory_queue().get(), timeout=timeout)
        return json.loads(raw)
    except asyncio.TimeoutError:
        return None
