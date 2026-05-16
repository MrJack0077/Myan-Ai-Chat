"""
Shared: Firestore client helpers.
Central place for Firestore DB reference and common error handling.
"""
import asyncio
import traceback
from config import db


def handle_firestore_error(operation: str, context: dict, error: Exception) -> None:
    """Log Firestore error with structured context for debugging."""
    ctx_str = {k: str(v)[:200] for k, v in (context or {}).items()}
    print(f"🔥 Firestore Error [{operation}] | context={ctx_str}", flush=True)
    traceback.print_exc()
    # Future: push to error monitoring service


async def firestore_get(doc_ref, default=None):
    """Async wrapper for Firestore get with error handling."""
    try:
        snap = await asyncio.to_thread(doc_ref.get)
        return snap if snap.exists else default
    except Exception as e:
        handle_firestore_error("get", {"path": str(doc_ref.path)}, e)
        return default


async def firestore_set(doc_ref, data: dict, merge: bool = True):
    """Async wrapper for Firestore set with error handling."""
    try:
        await asyncio.to_thread(doc_ref.set, data, merge=merge)
    except Exception as e:
        handle_firestore_error("set", {"path": str(doc_ref.path)}, e)
        raise


async def firestore_update(doc_ref, data: dict):
    """Async wrapper for Firestore update with error handling."""
    try:
        await asyncio.to_thread(doc_ref.update, data)
    except Exception as e:
        handle_firestore_error("update", {"path": str(doc_ref.path)}, e)
        raise


async def firestore_add(collection_ref, data: dict):
    """Async wrapper for Firestore add (auto-ID) with error handling."""
    try:
        doc_ref = await asyncio.to_thread(collection_ref.add, document_data=data)
        return doc_ref
    except Exception as e:
        handle_firestore_error("add", {"path": str(collection_ref.path)}, e)
        raise
