"""
Worker: Background queue consumer — pops tasks from Redis queue and runs pipeline.
"""
import asyncio
import json
import traceback
from config import r
from webhook.queue import pop_from_queue, QUEUE_KEY


async def worker_process(worker_id: int) -> None:
    """
    Infinite loop: pop task from queue → process via pipeline orchestrator.
    Handles Redis disconnect gracefully, falls back to memory queue.
    """
    print(f"🚀 Worker {worker_id} started.", flush=True)

    while True:
        try:
            data = await pop_from_queue(timeout=5.0)
            if data is None:
                _print_idle(worker_id)
                continue

            # Process the message
            from pipeline.orchestrator import process_core_logic
            await process_core_logic(data)

        except asyncio.CancelledError:
            print(f"🛑 Worker {worker_id} cancelled.", flush=True)
            break
        except Exception as e:
            print(f"🔥 Worker {worker_id} error: {e}", flush=True)
            traceback.print_exc()
            await asyncio.sleep(1)


async def _print_idle(worker_id: int) -> None:
    """Print idle status with approximate queue length."""
    try:
        if r:
            length = await r.llen(QUEUE_KEY)
            keys = await r.dbsize()
            print(f"💤 Worker {worker_id} idle. Queue len: {length}. Total Keys: {keys}", flush=True)
        else:
            print(f"💤 Worker {worker_id} idle.", flush=True)
    except Exception:
        print(f"💤 Worker {worker_id} idle.", flush=True)
