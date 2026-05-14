"""
Main message processor — orchestrates the full pipeline:
  Data extraction → Profile → Greeting router → Research → Agent → Response → Cache
"""
import asyncio
import json
import time
from datetime import datetime, timezone

from utils import (
    db, r, get_shop_data, check_rate_limit, add_to_history, get_history,
    increment_shop_tokens, log_shop_analytics, send_sendpulse_messages,
    BASE_MODEL_NAME, FAST_MODEL_NAME,
    get_sendpulse_token,
)
from agents.automation_agent import run_automation_agent

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
from .routing import route_to_agent


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
    Simulate human typing delay based on message length.
    - Fast typer: ~40 chars/second (~300 CPM)
    - Adds small random variation for natural feel
    - Caps at 3.0 seconds max (don't make customer wait too long)
    """
    import random
    if not reply_text:
        return 0.5  # minimum delay
    
    char_count = len(reply_text)
    # Base: 40 chars per second for Myanmar (slower due to complex script)
    # Plus 20% random variation
    base_delay = char_count / 40.0
    variation = random.uniform(-0.2, 0.3) * base_delay
    delay = base_delay + variation
    
    # Apply limits (1.5s max for fast replies)
    delay = max(0.5, min(delay, 1.5))
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

    token = await get_sendpulse_token(shop.get('client_id'), shop.get('client_secret'))
    if not token:
        print(f"❌ Token failed for bot: {acc_id}", flush=True)
        return
    print(f"⏱️  [1] Shop+Token loaded: {(time.time()-t1):.2f}s", flush=True)
    t2 = time.time()

    # ── 3. Load Profile + Segment ──
    prof = await get_user_profile(shop_doc_id, user_id)
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

    # ── Append photo context to user message ──
    if photo_context:
        user_msg = f"{user_msg}\n\n[PHOTO CONTEXT]\n{photo_context}"

    # ── 5. Typing indicator ──
    await send_typing(acc_id, user_id, token)

    # ── 6. Download media ──
    media_parts = await download_media_parts(attachments)
    
    # ── 6b. Smart Photo Analysis ──
    photo_context = ""
    if attachments or media_parts:
        try:
            from agents.photo_analyzer import analyze_photo_context
            photo_context = await analyze_photo_context(shop_doc_id, user_msg, order_state, len(attachments or []), media_parts)
            if photo_context:
                print(f"📸 Photo Analysis: {photo_context}", flush=True)
        except Exception as e:
            print(f"⚠️ Photo analyze error: {e}", flush=True)
    
    # ── 6b. Smart Photo Analysis ──
    photo_context = ""
    if attachments or media_parts:
        try:
            from agents.photo_analyzer import analyze_photo_context
            photo_context = await analyze_photo_context(shop_doc_id, user_msg, order_state, len(attachments or []), media_parts)
            if photo_context:
                print(f"📸 Photo Analysis: {photo_context[:80]}...", flush=True)
        except Exception as e:
            print(f"⚠️ Photo analysis skipped (import error): {e}", flush=True)
            photo_context = ""
    
    # ── 6c. URL Image Detection ──
    if not media_parts and not attachments:
        import re as _re
        urls = _re.findall(r'https?://[^\s]+', user_msg)
        if urls:
            for url in urls[:1]:  # Check first URL only
                if any(x in url.lower() for x in ['image', 'photo', 'img', 'jpg', 'png', 'jpeg', 'webp', 'file', 'api/tel', 'sendpulse']):
                    print(f"🔗 Detected image URL in message — analyzing...", flush=True)
                    try:
                        from agents.photo_analyzer import analyze_photo_context
                        # Treat URL as attachment — analyze
                        if not photo_context:
                            photo_context = "🔗 Customer sent an image link. Check if the image matches any shop product."
                            print(f"📸 URL Photo context: {photo_context}", flush=True)
                    except Exception:
                        pass
                    break
    
    # ── 7. Save to history ──
    hist_msg = user_msg if user_msg else ("[Voice Message]" if any("audio" in p.get("mime_type","") for p in media_parts) else ("[Photo]" if media_parts else "[Voice/Image/Payload]"))
    await add_to_history(shop_doc_id, conv_id, "Customer", hist_msg, max_len=10)
    chat_history = await get_history(shop_doc_id, conv_id)
    print(f"⏱️  [3] Config+Typing+History: {(time.time()-t3):.2f}s", flush=True)
    t4 = time.time()

    # ── 8. Fast Greeting Router ──
    is_likely_greeting = len(user_msg) <= 50 and not media_parts and not attachments
    
    if is_likely_greeting:
        # Start research in parallel — if not a greeting, results will be ready
        research_task = asyncio.create_task(run_embedding_search(user_msg, shop_doc_id, currency))
        
        greeting_context = chat_history
        if re_engage_note:
            greeting_context = f"[Context for AI]\n{re_engage_note}\n\n{chat_history}"
        t_greet = time.time()
        handled = await run_greeting_router(user_msg, greeting_context, ai_config, shop_doc_id, conv_id, acc_id, user_id, token, lang)
        print(f"⏱️  [4] Greeting Router AI call: {(time.time()-t_greet):.2f}s", flush=True)
        if handled:
            research_task.cancel()
            print(f"⏱️  [TOTAL] Pipeline: {(time.time()-t_start):.2f}s (greeting)", flush=True)
            return
    else:
        print(f"🚦 Greeting Router: SKIP (msg_len={len(user_msg)}, media={bool(media_parts)})", flush=True)

    chat_history = await get_history(shop_doc_id, conv_id)
    print(f"⏱️  [4] Greeting Router done: {(time.time()-t4):.2f}s", flush=True)
    t5 = time.time()

    # ── 9. Smart Intent Classify + Research ──
    fast_intent, skip_automation = fast_intent_classify(user_msg, order_state)
    
    if is_likely_greeting:
        try:
            research_result = await research_task
        except asyncio.CancelledError:
            return
        except Exception:
            research_result = ("No items", None)
    else:
        research_task = run_embedding_search(user_msg, shop_doc_id, currency)
        research_result = await research_task
    
    # SKIP Automation Agent entirely — keyword classifier handles intent (0ms)
    # Let the main agent (product/order/media) handle the actual reply generation
    # This saves 6-15s per message by eliminating 1 AI call
    if fast_intent and fast_intent not in ("COMPLAINT_OR_HUMAN",):
        print(f"⚡ SMART SKIP: fast_intent={fast_intent} — skipping Automation Agent", flush=True)
    else:
        # No keyword match → try Automation Agent with 5s timeout for better intent
        fast_intent = "PRODUCT_INQUIRY"
        print(f"⚡ SMART SKIP: no keyword → default={fast_intent} — skipping Automation Agent", flush=True)
    
    tool_info, msg_emb = research_result
    automation_data = {
        "intent": fast_intent,
        "is_complex": False,
        "reply": "",
        "extracted_preferences": {},
        "behavioral_tags": [],
        "prompt_tokens": 0,
        "candidate_tokens": 0,
    }

    intent_type = automation_data.get("intent", "PRODUCT_INQUIRY")
    is_complex = automation_data.get("is_complex", False)
    reply_text = automation_data.get("reply", "")
    print(f"⏱️  [5] Intent+Research+Automation: {(time.time()-t5):.2f}s | intent={intent_type}", flush=True)
    t6 = time.time()

    # ── 10. Semantic Cache ──
    cached_reply = await check_semantic_cache(shop_doc_id, user_msg, msg_emb, intent_type, order_state, acc_id)

    # ── Preference Extraction (from keyword classifier tags) ──
    extracted_prefs = automation_data.get("extracted_preferences", {})
    behavioral_tags = automation_data.get("behavioral_tags", [])
    if extracted_prefs or behavioral_tags:
        # Update structured preferences in profile
        from .profile_manager import update_customer_preferences
        if extracted_prefs:
            update_customer_preferences(prof, extracted_prefs)
        
        current_prefs = prof["ai_insights"].get("preferences", {})
        if isinstance(current_prefs, dict) and isinstance(extracted_prefs, dict):
            current_prefs.update(extracted_prefs)
            prof["ai_insights"]["preferences"] = current_prefs
        
        current_tags = prof["ai_insights"].get("tags", [])
        if isinstance(current_tags, list) and isinstance(behavioral_tags, list):
            for tag in behavioral_tags:
                if tag not in current_tags:
                    current_tags.append(tag)
            prof["ai_insights"]["tags"] = current_tags
            
        await save_profile(shop_doc_id, user_id, prof)
    
    # Build memory context for AI prompt
    from .profile_manager import build_memory_context
    memory_ctx = build_memory_context(prof)
    if memory_ctx:
        # Prepend memory context to user message so AI has context
        user_msg = f"[CUSTOMER MEMORY]\n{memory_ctx}\n\n{user_msg}"

    # ── 12. Escalation ──
    if is_complex or intent_type == "COMPLAINT_OR_HUMAN":
        # Use AI's empathetic reply if available, otherwise fallback to hardcoded
        ai_escalation_reply = automation_data.get("reply", "").strip()
        reply_text = await handle_escalation(
            shop_doc_id, acc_id, conv_id, user_id, token, agent_id, intent_type, lang,
            ai_reply=ai_escalation_reply
        )
        await add_to_history(shop_doc_id, conv_id, "AI", reply_text, max_len=10)
        await send_sendpulse_messages(acc_id, user_id, {}, reply_text, token)
        return

    # ── 13. Agent Routing ──
    should_bypass = intent_type in ["ORDER", "START_ORDER", "ORDER_CHECKOUT", "COMPLAINT_OR_HUMAN", "SLIP_UPLOAD"]

    if cached_reply and order_state == "NONE":
        # Only use cache when NOT in active order flow
        reply_text, is_complex = cached_reply, False
        final_data = {"reply": reply_text, "is_complex": False, "intent": "CACHED_FAQ"}
        total_tokens = 0
    elif cached_reply and order_state != "NONE":
        # In order flow — skip cache, let agent handle it
        print(f"⚠️ Cache skipped — order is active (state={order_state})", flush=True)
        cached_reply = None  # Reset so agent runs below
    elif reply_text and not is_complex and intent_type not in ["PRODUCT_INQUIRY", "ORDER", "START_ORDER", "ORDER_CHECKOUT", "SLIP_UPLOAD"] and not media_parts:
        final_data = {
            "reply": reply_text, "is_complex": False, "intent": intent_type,
            "prompt_tokens": automation_data.get("prompt_tokens", 0),
            "candidate_tokens": automation_data.get("candidate_tokens", 0),
        }
        total_tokens = final_data["prompt_tokens"] + final_data["candidate_tokens"]
    else:
        t_agent = time.time()
        final_data, total_tokens = await route_to_agent(
            order_state, prof, user_msg, ai_config, chat_history,
            media_parts, tool_info, currency, policies,
            delivery_info, payment_info, attachments,
            should_bypass, shop_doc_id, user_id, lang,
            intent_type, automation_reply=reply_text,
            photo_context=photo_context
        )
        reply_text = final_data.get("reply", "...")
        is_complex = final_data.get("is_complex", False)
        print(f"⏱️  [6] Agent Routing (product/order/media): {(time.time()-t_agent):.2f}s", flush=True)

    # ── 14. Response & Save ──
    await add_to_history(shop_doc_id, conv_id, "AI", reply_text, max_len=10)
    
    # ── 14b. Two-Tier Memory: Update conversation summary every N messages ──
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
    
    await send_sendpulse_messages(acc_id, user_id, final_data, reply_text, token)

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
    
    # ── Track AI tokens + channel usage (always active) ──
    import google.cloud.firestore as firestore_module
    try:
        updates = {"ai_tokens_used": firestore_module.Increment(total_tokens)}
        
        # Track channel usage by bot_id
        bot_id_for_tracking = acc_id
        if bot_id_for_tracking:
            channel_field = f"channel_msg_count.{bot_id_for_tracking}"
            updates[channel_field] = firestore_module.Increment(1)
            # Also mark last used timestamp
            updates[f"channel_last_used.{bot_id_for_tracking}"] = datetime.now(timezone.utc).isoformat()
        
        db.collection("shops").document(shop_doc_id).update(updates)
    except Exception as e:
        pass  # Silent — stats tracking should never block the pipeline
    
    # Release per-user sequential lock
    await _release_user_lock(user_id)
    
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
