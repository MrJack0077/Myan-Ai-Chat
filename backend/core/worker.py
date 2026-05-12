import asyncio
import json
from datetime import datetime, timezone
from utils import r

# A global memory queue for fallback
task_queue = asyncio.Queue()

DEAD_LETTER_PREFIX = "dead_letter:"


async def _push_to_dead_letter(data_str, worker_id, error_msg):
    """Save failed task to dead-letter queue for later inspection."""
    dl_entry = {
        "failed_at": datetime.now(timezone.utc).isoformat(),
        "worker_id": worker_id,
        "error": str(error_msg),
        "raw_payload": data_str,
    }
    try:
        if r:
            # Push to Redis dead-letter list
            await r.lpush(f"{DEAD_LETTER_PREFIX}list", json.dumps(dl_entry))
            # Also save individually for inspection
            dl_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S%f")
            await r.setex(f"{DEAD_LETTER_PREFIX}{dl_id}", 86400 * 7, json.dumps(dl_entry))
        else:
            print(f"💀 [DLQ] Redis not available, dead-letter lost: {error_msg[:100]}", flush=True)
    except Exception as dlq_e:
        print(f"💀 [DLQ] Failed to save dead-letter: {dlq_e}", flush=True)


async def worker_process(worker_id):
    from core.processor import process_core_logic
    from utils import r as redis_client # Ensure we use the latest
    
    # Try to get redis info for debugging
    redis_info = "Unknown"
    if redis_client:
        try:
            conn_info = redis_client.connection_pool.connection_kwargs
            redis_info = f"{conn_info.get('host')}:{conn_info.get('port')}/{conn_info.get('db')}"
        except: pass

    print(f"🚀 Worker {worker_id} started. Redis: {redis_info}", flush=True)
    loop_count = 0
    while True:
        loop_count += 1
        try:
            if redis_client:
                # Use brpop for blocking wait - it's more efficient than polling
                result = await redis_client.brpop("sendpulse_task_queue", timeout=5)
                
                if result:
                    _, data_str = result
                    print(f"👷 Worker {worker_id} picked up task via Redis: {data_str[:100]}...", flush=True)
                    try:
                        data = json.loads(data_str)
                        if isinstance(data, dict):
                            await process_core_logic(data)
                        else:
                            print(f"⚠️ Worker {worker_id}: Invalid JSON data type: {type(data)}", flush=True)
                    except Exception as pe:
                        print(f"❌ Worker {worker_id} Processing Error: {pe}", flush=True)
                        await _push_to_dead_letter(data_str, worker_id, pe)
                else:
                    if loop_count % 10 == 0:
                        # Extra debug: check all keys if we keep timing out
                        all_keys = await redis_client.keys("*")
                        q_len = await redis_client.llen("sendpulse_task_queue")
                        print(f"💤 Worker {worker_id} idle. Queue len: {q_len}. Total Keys: {len(all_keys)}", flush=True)
                        if q_len > 0:
                            print(f"🧐 Worker {worker_id} detected non-zero queue! {q_len} items exist.", flush=True)
            else:
                print(f"⚠️ Worker {worker_id} failing back to Memory Queue because Redis is None", flush=True)
                data = await task_queue.get()
                print(f"👷 Worker {worker_id} picked up task via Memory Queue", flush=True)
                try:
                    await process_core_logic(data)
                except Exception as e:
                    print(f"💥 Worker {worker_id} Error: {e}", flush=True)
                    await _push_to_dead_letter(json.dumps(data) if isinstance(data, dict) else str(data), worker_id, e)
                finally:
                    task_queue.task_done()
        except Exception as e:
            print(f"💥 Worker {worker_id} Loop Error: {e}", flush=True)
            await asyncio.sleep(2)
        
        await asyncio.sleep(0.05) # Very brief sleep
