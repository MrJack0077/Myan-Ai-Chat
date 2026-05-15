"""
Main message processor — orchestrates the full pipeline:
  Data extraction → Profile → Greeting → Research → Unified Agent → Response → Cache
"""
import asyncio
import time
import json
from datetime import datetime, timezone

from utils import (
    db, r, get_shop_data, check_rate_limit, add_to_history, get_history,
    increment_shop_tokens, log_shop_analytics, send_sendpulse_messages,
    BASE_MODEL_NAME, FAST_MODEL_NAME,
    get_sendpulse_token,
)
from .profile_manager import get_user_profile, save_profile, segment_customer, expire_order_state
from .data_extractor import extract_text_deeply, extract_bot_id, extract_user_id, extract_attachments, download_media_parts
from .greeting_router import run_greeting_router
from .semantic_research import run_embedding_search, check_semantic_cache, save_to_semantic_cache_async
from .order_handler import send_typing, send_stop_typing, handle_escalation, handle_order_confirmation
from .intent_classifier import fast_intent_classify
from .cache_manager import invalidate_shop_caches
from .conversation_memory import (
    build_conversation_context, needs_summarization, count_customer_messages,
    MAX_RECENT_MESSAGES,
)
from .worker import task_queue


# Intent classifier and prompt cache extracted to separate modules:
#  - core/intent_classifier.py   → fast_intent_classify()
#  - core/prompt_cache.py        → get_cached_system_prompt(), invalidate_system_prompt_cache()


def clean_large_strings(data_input, max_len=3000):
    """Truncate large strings to avoid bloated prompts."""
    if isinstance(data_input, dict):
        return {k: clean_large_strings(v, max_len) for k, v in data_input.items()}
    if isinstance(data_input, list):
        return [clean_large_strings(i, max_len) for i in data_input]
    if isinstance(data_input, str) and len(data_input) > max_len:
        return "[Data Too Long - Removed]"
    return data_input


# ---------------------------------------------------------------------------
#  Per-User Sequential Processing Lock
# ---------------------------------------------------------------------------

USER_LOCK_TTL = 30  # max processing time before lock auto-expires

async def _acquire_user_lock(user_id: str) -> bool:
    """Try to acquire a per-user lock for sequential processing."""
    if not r:
        return True  # no Redis → allow concurrent (risk accepted)
    lock_key = f"user_lock:{user_id}"
    try:
        was_set = await r.set(lock_key, "1", nx=True, ex=USER_LOCK_TTL)
        return bool(was_set)
    except Exception:
        return True  # Redis error → allow to avoid blocking


async def _release_user_lock(user_id: str):
    """Release the per-user lock."""
    if not r:
        return
    try:
        await r.delete(f"user_lock:{user_id}")
    except Exception:
        pass


def _calculate_typing_delay(reply_text: str) -> float:
    """
    Minimal typing delay for perceived responsiveness.
    - Fast typer: ~40 chars/second (~300 CPM)
    - Cap at 0.2s max (don't make customer wait for "human-like" delay)
    - Streaming isn't supported by SendPulse, so minimal delay is the best UX
    """
    import random
    if not reply_text:
        return 0.0
    
    char_count = len(reply_text)
    # Base: 40 chars per second for Myanmar
    base_delay = char_count / 40.0
    # Minimal variation (±10%)
    variation = random.uniform(-0.1, 0.1) * base_delay
    delay = base_delay + variation
    
    # Apply cap: 0.05s min, 0.15s max (fast — no customer should wait for "typing")
    delay = max(0.05, min(delay, 0.15))
    return round(delay, 2)


# ---------------------------------------------------------------------------
#  Main Pipeline
# ---------------------------------------------------------------------------

async def process_core_logic(data):
    t_start = time.time()
    
    # ── Admin feedback path ──
    if data.get("type") == "admin_feedback":
        return await _handle_admin_feedback(data)

    # ── 1. Extract & Validate ──
    user_msg = extract_text_deeply(data)
    acc_id = extract_bot_id(data)
    user_id = extract_user_id(data)
    conv_id = user_id
    attachments = extract_attachments(data)

    if not user_msg and not attachments and data.get("text"):
        user_msg = data.get("text", "").strip()

    if not user_msg and not attachments:
        return  # Nothing to process

    if not acc_id or not user_id:
        print(f"❌ Missing IDs: Bot ID: '{acc_id}', User ID: '{user_id}'", flush=True)
        return

    print(f"\n📩 process_core_logic START for {user_id} | msg: '{user_msg[:60]}...'", flush=True)
    t1 = time.time()

    # ── Per-user sequential lock ──
    lock_acquired = await _acquire_user_lock(user_id)
    if not lock_acquired:
        print(f"⏳ User {user_id[:20]}... locked, re-queuing...", flush=True)
        if r:
            await r.lpush("sendpulse_task_queue", json.dumps(data))
        else:
            await task_queue.put(data)
        return

    # ── 2. Load Shop + Token ──
    shop = await get_shop_data(acc_id)
    if not shop:
        print(f"❌ Shop not found for bot: '{acc_id}'", flush=True)
        return
    shop_doc_id = shop['shop_doc_id']

    if not await check_rate_limit(shop_doc_id):
        print(f"⚠️ Rate limit exceeded for {shop_doc_id}", flush=True)
        await log_shop_analytics(shop_doc_id, "rate_limit_exceeded", {"user_id": user_id})
        return

    # ⚡ PARALLEL: Token + Profile load simultaneously (saves 1-3s)
    token_task = asyncio.create_task(get_sendpulse_token(shop.get('client_id'), shop.get('client_secret')))
    prof_task = asyncio.create_task(get_user_profile(shop_doc_id, user_id))
    
    token = await token_task
    prof = await prof_task
    
    if not token:
        print(f"❌ Token failed for bot: {acc_id}", flush=True)
        return
    print(f"⏱️  [1] Shop+Token+Profile loaded (parallel): {(time.time()-t1):.2f}s", flush=True)
    t2 = time.time()

    # ── 3. Segment Customer ──
    segment_customer(prof)
    
    past_purchases = prof.get("sales_data", {}).get("past_purchases", [])
    re_engage_note = ""
    if past_purchases and prof["dynamics"].get("message_count", 0) <= 2:
        last_purchase = past_purchases[-1] if isinstance(past_purchases, list) and past_purchases else None
        if last_purchase and isinstance(last_purchase, dict):
            items = last_purchase.get("items", [])
            total = last_purchase.get("total_price", 0)
            re_engage_note = f"Returning customer! Previously bought: {', '.join(items[:3])} for {total} MMK. Welcome them back warmly if they seem to be browsing again."
    
    if not prof["identification"].get("messenger_id") and "ps_" in user_id:
        prof["identification"]["messenger_id"] = user_id
    elif not prof["identification"].get("telegram_id") and "tg_" in user_id:
        prof["identification"]["telegram_id"] = user_id

    order_state = prof["dynamics"].get("order_state", "NONE")

    if order_state == "HUMAN_HANDOVER":
        print(f"⏸️ Handover active for {user_id}, skipping AI — admin is handling", flush=True)
        return

    order_state = await expire_order_state(prof, shop_doc_id, user_id)
    prof["dynamics"]["message_count"] = prof["dynamics"].get("message_count", 0) + 1
    prof["dynamics"]["last_interaction"] = datetime.now(timezone.utc).isoformat()
    print(f"⏱️  [2] Profile loaded: {(time.time()-t2):.2f}s", flush=True)
    t3 = time.time()

    # ── 4. Shop config ──
    ai_config = clean_large_strings(shop.get('ai_config', {}))
    policies = clean_large_strings(ai_config.get('policies', {}))
    shop_info_data = shop.get("shop_info", {})
    delivery_info = clean_large_strings(shop_info_data.get("deliveryInfo", []))
    payment_info = clean_large_strings(shop_info_data.get("paymentInfo", []))
    currency = shop_info_data.get("currency", "MMK")
    lang = ai_config.get('responseLanguage', 'Myanmar')
    agent_id = shop.get('agentId')

    if user_msg.strip().lower() == "/refresh":
        await _handle_refresh(acc_id, shop_doc_id)
        return

    photo_context = ""

    # ── Append photo context to user message ──
    if photo_context:
        user_msg = f"{user_msg}\n\n[PHOTO CONTEXT]\n{photo_context}"

    # ── 5. Typing indicator ──
    await send_typing(acc_id, user_id, token)

    # ── 6. Download media ──
    media_parts = await download_media_parts(attachments)
    
    # ⚡ SKIP separate AI Vision — unified agent handles images directly (multimodal)
    if attachments or media_parts:
        # Keyword quick check for payment slip (0ms)
        import re as _re
        slip_keywords = r'\b(slip|paid|payment|transfer|ငွေ|ပေးချေ|လွှဲ|ငွေလွှဲ|receipt|transaction)\b'
        if bool(_re.search(slip_keywords, user_msg, _re.IGNORECASE)):
            photo_context = "[PAYMENT SLIP DETECTED] Process as payment verification."
            print(f"⚡ Payment slip detected (keyword) — unified agent will verify image", flush=True)
        else:
            photo_context = "📸 Customer sent an image. Analyze it naturally with the message."
    
    # ── 7. Save to history ──
    hist_msg = user_msg if user_msg else ("[Voice Message]" if any("audio" in p.get("mime_type","") for p in media_parts) else ("[Photo]" if media_parts else "[Voice/Image/Payload]"))
    await add_to_history(shop_doc_id, conv_id, "Customer", hist_msg, max_len=10)
    chat_history = await get_history(shop_doc_id, conv_id)
    print(f"⏱️  [3] Config+Typing+History: {(time.time()-t3):.2f}s", flush=True)
    t4 = time.time()

    # ── 8. Keyword Intent Classify (0ms) ──
    kw_intent, _ = fast_intent_classify(user_msg, order_state)
    # ⚡ NO Greeting Router — all messages go to Unified Agent
    t5 = time.time()

    # ── 9. Embedding Research (only if needed) ──
    SKIP_EMBEDDING_INTENTS = {"GREETING", "COMPLAINT_OR_HUMAN", "OUT_OF_DOMAIN", 
                               "DELIVERY", "PAYMENT", "POLICY_FAQ", "SLIP_UPLOAD"}
    
    if kw_intent in SKIP_EMBEDDING_INTENTS:
        print(f"⚡ Embedding SKIP: intent={kw_intent} — 0ms", flush=True)
        tool_info, msg_emb = "No items needed", None
    else:
        t_research = time.time()
        research_result = await run_embedding_search(user_msg, shop_doc_id, currency)
        tool_info, msg_emb = research_result
        print(f"⏱️  Embedding Research: {(time.time()-t_research):.2f}s", flush=True)
    
    # ── 10. UNIFIED AGENT (ONE AI call replaces Greeting Router + Automation + Product/Order/Media) ──
    from agents.unified_agent import run_unified_agent
    
    print(f"⚡ Unified Agent: ONE AI call (kw={kw_intent}, state={order_state})...", flush=True)
    unified_result = await run_unified_agent(
        user_msg=user_msg,
        chat_history=chat_history,
        profile=prof,
        ai_config=ai_config,
        tool_info=tool_info,
        order_state=order_state,
        media_parts=media_parts,
        photo_context=photo_context,
        shop_doc_id=shop_doc_id,
        delivery_info=delivery_info,
        payment_info=payment_info,
        currency=currency,
    )
    
    intent_type = unified_result.get("intent") or kw_intent or "PRODUCT_INQUIRY"
    reply_text = unified_result.get("reply", "")
    # ⚡ Safety: ensure reply is string (AI sometimes returns dict)
    if isinstance(reply_text, dict):
        reply_text = reply_text.get("text") or reply_text.get("reply") or ""
    reply_text = str(reply_text) if reply_text else ""
    is_complex = unified_result.get("is_complex", False)
    extracted = unified_result.get("extracted", {})
    total_tokens = unified_result.get("prompt_tokens", 0) + unified_result.get("candidate_tokens", 0)
    
    # ⚡ Intent override: keyword classifier is more reliable for basic intents
    # AI tends to misclassify "hello" as PRODUCT_INQUIRY
    if kw_intent and intent_type != kw_intent:
        if kw_intent in ("GREETING",) and not reply_text:
            # Keyword says greeting but AI didn't give reply → use hardcoded
            from .greeting_router import _hardcoded_greeting_reply
            reply_text = _hardcoded_greeting_reply(lang)
            intent_type = "GREETING"
            print(f"⚡ Intent fix: AI={intent_type} → kw={kw_intent}", flush=True)
    
    print(f"⏱️  [5] Unified Agent done: {(time.time()-t5):.2f}s | intent={intent_type} | tokens={total_tokens}", flush=True)
    t6 = time.time()

    # ── 11. Semantic Cache ──
    cached_reply = await check_semantic_cache(shop_doc_id, user_msg, msg_emb, intent_type, order_state, acc_id)

    # ── 12. Preference Extraction ──
    if extracted:
        from .profile_manager import update_customer_preferences
        prefs = {k: v for k, v in extracted.items() if k not in ("buttons", "images", "items")}
        if prefs:
            update_customer_preferences(prof, prefs)
            prof["ai_insights"]["preferences"] = {**prof["ai_insights"].get("preferences", {}), **prefs}
            await save_profile(shop_doc_id, user_id, prof)
    
    # Build memory context for AI prompt
    from .profile_manager import build_memory_context
    memory_ctx = build_memory_context(prof)
    if memory_ctx:
        # Prepend memory context to user message so AI has context
        user_msg = f"[CUSTOMER MEMORY]\n{memory_ctx}\n\n{user_msg}"

    # ── 13. Escalation ──
    if is_complex or intent_type == "COMPLAINT_OR_HUMAN":
        ai_escalation_reply = reply_text
        reply_text = await handle_escalation(
            shop_doc_id, acc_id, conv_id, user_id, token, agent_id, intent_type, lang,
            ai_reply=ai_escalation_reply
        )
        await add_to_history(shop_doc_id, conv_id, "AI", reply_text, max_len=10)
        await send_sendpulse_messages(acc_id, user_id, extracted, reply_text, token)
        return

    # ── 14. Use Unified Agent Reply Directly (Skip separate agent routing) ──
    # The unified agent already generated the final reply. No need for product/order/media agent.
    final_data = {
        "reply": reply_text,
        "is_complex": is_complex,
        "intent": intent_type,
        "extracted": extracted,
        "prompt_tokens": unified_result.get("prompt_tokens", 0),
        "candidate_tokens": unified_result.get("candidate_tokens", 0),
    }
    
    # ⚡ EMPTY REPLY FALLBACK: If AI returned no reply, generate safe default
    if not reply_text.strip():
        if lang.lower() in ["myanmar", "burmese", "mm"]:
            if intent_type in ("PRODUCT_INQUIRY",):
                reply_text = "ရှာမတွေ့ပါဘူးရှင့်။ နာမည်အပြည့်အစုံလေး ပြောပေးပါဦးနော်။"
            elif intent_type == "DELIVERY":
                reply_text = "ပို့ဆောင်ရေးအကြောင်း ပြောပြပေးပါမယ်ရှင့်။ ဘယ်မြို့လဲပြောပေးပါဦး။"
            else:
                reply_text = "ဘာကူညီပေးရမလဲရှင့်။"
        else:
            if intent_type in ("PRODUCT_INQUIRY",):
                reply_text = "I couldn't find that. Could you share the exact product name?"
            elif intent_type == "DELIVERY":
                reply_text = "Let me share our delivery info. Which city are you in?"
            else:
                reply_text = "How can I help you today?"
        final_data["reply"] = reply_text
        print(f"⚠️ Empty AI reply → using fallback for intent={intent_type}", flush=True)
        print(f"⏱️  [6] Reply fallback: handled", flush=True)

    # ── 14. Response & Save ──
    await add_to_history(shop_doc_id, conv_id, "AI", reply_text, max_len=10)
    
    # ⚡ RELEASE LOCK NOW — don't wait for post-processing
    # If network error occurs during post-processing, user won't be blocked for 30s
    await _release_user_lock(user_id)
    
    # Background: Two-Tier Memory summary
    updated_history = await get_history(shop_doc_id, conv_id)
    if needs_summarization(updated_history):
        print(f"🧠 Two-Tier Memory: Summarizing conversation for {user_id}...", flush=True)
        asyncio.create_task(
            _summarize_and_save(shop_doc_id, conv_id, user_id, updated_history, prof)
        )
    
    await send_stop_typing(acc_id, user_id, token)
    
    # ── Human-like typing delay: simulate a real person typing ──
    typing_delay = _calculate_typing_delay(reply_text)
    if typing_delay > 0.5:
        await asyncio.sleep(typing_delay)
        print(f"⌨️ Typing delay: {typing_delay:.1f}s for {len(reply_text)} chars", flush=True)
    
    await send_sendpulse_messages(acc_id, user_id, final_data, reply_text, token, channel=shop.get('channel', ''))

    # ── 15. Order Confirmation ──
    order_intent = final_data.get("intent", "")
    print(f"🔍 ORDER DEBUG: intent={order_intent}, is_complex={is_complex}, order_state={order_state}", flush=True)
    print(f"🔍 ORDER DEBUG: prof.identification={prof.get('identification', {})}", flush=True)
    print(f"🔍 ORDER DEBUG: prof.current_order={prof.get('current_order', {})}", flush=True)
    
    if order_intent == "ORDER_CONFIRMED":
        print(f"🔔 Order confirmed! Saving to database...", flush=True)
        await handle_order_confirmation(shop_doc_id, acc_id, conv_id, user_id, token, agent_id, prof, currency, final_data)
    else:
        print(f"ℹ️ Order not confirmed yet (intent={order_intent})", flush=True)

    # ── 16. Save to Semantic Cache ──
    if msg_emb and not is_complex and not cached_reply and order_state == "NONE":
        save_to_semantic_cache_async(shop_doc_id, user_msg, reply_text, msg_emb, intent_type, final_data)

    await increment_shop_tokens(acc_id, total_tokens)
    
    # ── Track AI tokens + channel usage (background) ──
    asyncio.create_task(_track_analytics(shop_doc_id, acc_id, total_tokens))
    
    # Lock already released above — user can send next message immediately
    
    print(f"⏱️  [TOTAL] Pipeline complete: {(time.time()-t_start):.2f}s | reply: '{reply_text[:50]}...'", flush=True)


# ── End of process_core_logic pipeline ──
#  Internal helpers
# ---------------------------------------------------------------------------

async def _summarize_and_save(shop_doc_id, conv_id, user_id, history_text, prof):
    """Background task: generate conversation summary and save profile properly."""
    from .conversation_memory import generate_conversation_summary
    from .profile_manager import save_profile as _save_prof

    try:
        old_summary = prof.get("ai_insights", {}).get("conversation_summary", "")
        new_summary = await generate_conversation_summary(old_summary, history_text, prof)
        if new_summary:
            prof["ai_insights"]["conversation_summary"] = new_summary
            await _save_prof(shop_doc_id, user_id, prof)
            print(f"✅ Conversation summarized for {user_id} (two-tier memory)", flush=True)
    except Exception as e:
        print(f"⚠️ Summarize error for {user_id}: {e}", flush=True)


async def _handle_admin_feedback(data):
    """Process admin feedback events — log to Firestore analytics for later review."""
    acc_id = data.get("acc_id") or data.get("bot_id")
    if not acc_id:
        print("⚠️ Admin feedback missing acc_id", flush=True)
        return

    shop = await get_shop_data(acc_id)
    if not shop:
        print(f"⚠️ Admin feedback: shop not found for {acc_id}", flush=True)
        return

    shop_doc_id = shop['shop_doc_id']
    feedback_type = data.get("feedback_type", "unknown")
    feedback_text = data.get("feedback_text", "")
    conv_id = data.get("conv_id", "")

    # Log feedback to analytics
    await log_shop_analytics(shop_doc_id, "ADMIN_FEEDBACK", {
        "feedback_type": feedback_type,
        "feedback_text": feedback_text,
        "conv_id": conv_id,
    })

    # Save to Firestore feedback collection for dashboard review
    try:
        def _save_feedback():
            db.collection("shops").document(shop_doc_id).collection("feedback").add({
                "type": feedback_type,
                "text": feedback_text,
                "conv_id": conv_id,
                "acc_id": acc_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        await asyncio.to_thread(_save_feedback)
        print(f"📝 Admin feedback saved for shop {shop_doc_id}", flush=True)
    except Exception as e:
        print(f"⚠️ Admin feedback save error: {e}", flush=True)


async def _handle_refresh(acc_id, shop_doc_id):
    """Handle /refresh command — clear ALL caches via central manager."""
    await invalidate_shop_caches(shop_doc_id, acc_id=acc_id)


async def _track_analytics(shop_doc_id, acc_id, total_tokens):
    """Background task: update Firestore analytics (never blocks main pipeline)."""
    import google.cloud.firestore as firestore_module
    try:
        updates = {"ai_tokens_used": firestore_module.Increment(total_tokens)}
        if acc_id:
            updates[f"channel_msg_count.{acc_id}"] = firestore_module.Increment(1)
            updates[f"channel_last_used.{acc_id}"] = datetime.now(timezone.utc).isoformat()
        db.collection("shops").document(shop_doc_id).update(updates)
    except Exception:
        pass  # Silent — stats should never block the pipeline
