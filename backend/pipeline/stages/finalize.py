"""
Pipeline Stage 8: Finalize — analytics, conversation summary, semantic cache.
Background tasks that don't block the main pipeline.
"""
import asyncio
from datetime import datetime, timezone
from config import db, r
from ai.memory import needs_summarization, generate_conversation_summary
from customers.history import get_history
from customers.profile import save_profile
from shops.analytics import increment_tokens, log_analytics


async def finalize_pipeline(
    unified_result: dict, shop_doc_id: str, acc_id: str,
    conv_id: str, user_id: str, prof: dict,
    msg_emb: list, user_msg: str,
) -> None:
    """
    Post-pipeline cleanup and analytics (non-blocking).
    - Update token counters
    - Save semantic cache
    - Trigger conversation summary
    - Update profile
    """
    total_tokens = unified_result.get("prompt_tokens", 0) + unified_result.get("candidate_tokens", 0)
    intent_type = unified_result.get("intent", "")
    is_complex = unified_result.get("is_complex", False)
    reply_text = unified_result.get("reply", "")

    # ── Increment shop tokens ──
    if total_tokens > 0:
        asyncio.create_task(increment_tokens(acc_id, total_tokens))

    # ── Analytics (background) ──
    asyncio.create_task(_track_analytics(shop_doc_id, acc_id, total_tokens))

    # ── Semantic cache ──
    if msg_emb and not is_complex and not _is_order_state(prof):
        asyncio.create_task(_save_semantic_cache(
            shop_doc_id, user_msg, reply_text, msg_emb, intent_type, unified_result,
        ))

    # ── Conversation summary ──
    history = await get_history(shop_doc_id, conv_id)
    if needs_summarization(history or ""):
        asyncio.create_task(_summarize_and_save(shop_doc_id, conv_id, user_id, history, prof))


async def _track_analytics(shop_doc_id: str, acc_id: str, total_tokens: int) -> None:
    """Background: update Firestore analytics counters."""
    if not db:
        return
    try:
        import google.cloud.firestore as fs
        import asyncio as aio
        updates = {"ai_tokens_used": fs.Increment(total_tokens)}
        if acc_id:
            updates[f"channel_msg_count.{acc_id}"] = fs.Increment(1)
            updates[f"channel_last_used.{acc_id}"] = datetime.now(timezone.utc).isoformat()
        await aio.to_thread(db.collection("shops").document(shop_doc_id).update, updates)
    except Exception:
        pass


async def _summarize_and_save(shop_doc_id: str, conv_id: str,
                              user_id: str, history: str, prof: dict) -> None:
    """Background: generate conversation summary and save to profile."""
    try:
        old_summary = prof.get("ai_insights", {}).get("conversation_summary", "")
        new_summary = await generate_conversation_summary(old_summary, history, prof)
        if new_summary:
            prof.setdefault("ai_insights", {})["conversation_summary"] = new_summary
            await save_profile(shop_doc_id, user_id, prof)
    except Exception as e:
        print(f"⚠️ Summary error: {e}", flush=True)


async def _save_semantic_cache(shop_doc_id: str, query: str, reply: str,
                                embedding: list, intent: str, data: dict) -> None:
    """Background: save Q&A pair to semantic cache."""
    if not db or not embedding:
        return
    try:
        import asyncio as aio
        ref = db.collection("shops").document(shop_doc_id).collection("semantic_cache")
        await aio.to_thread(ref.add, document_data={
            "query": query,
            "reply": reply,
            "embedding": embedding,
            "intent": intent,
            "data": data,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass


def _is_order_state(prof: dict) -> bool:
    """Check if user is currently in an order flow."""
    state = prof.get("dynamics", {}).get("order_state", "NONE")
    return state not in ("NONE", "")
