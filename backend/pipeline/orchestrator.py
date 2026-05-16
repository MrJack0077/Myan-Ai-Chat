"""
Pipeline: Main orchestrator — process_core_logic().
Thin coordinator that runs pipeline stages in sequence.
Delegates all business logic to individual stage modules.
"""
import asyncio
import time
import json
from datetime import datetime, timezone
from typing import Optional

from config import r
from .stages.extract import extract_payload_data
from .stages.validate import validate_request
from .stages.profile import load_and_update_profile
from .stages.context import build_context
from .stages.research import run_research
from .stages.reason import generate_ai_reply
from .stages.respond import send_reply
from .stages.finalize import finalize_pipeline


async def process_core_logic(data: dict) -> None:
    """
    Main message processing pipeline.
    Orchestrates stages: Extract → Validate → Profile → Context → Research → Reason → Respond → Finalize.
    """
    t_start = time.time()

    # ── Admin feedback path ──
    if data.get("type") == "admin_feedback":
        return await _handle_admin_feedback(data)

    # ── Stage 1: Extract payload data ──
    extracted = extract_payload_data(data)
    if not extracted:
        print("⚠️ Pipeline: extract_payload_data returned None", flush=True)
        return
    user_msg, acc_id, user_id, attachments = extracted

    print(f"\n📩 Pipeline START for {user_id} | msg: '{user_msg[:60]}...'", flush=True)

    # ── Stage 2: Validate (rate limit, plan, lock) ──
    try:
        result = await validate_request(acc_id, user_id, data)
    except Exception as e:
        print(f"🔥 Pipeline: validate_request CRASH: {e}", flush=True)
        import traceback; traceback.print_exc()
        return
    if not result:
        print(f"⚠️ Pipeline: validate_request returned None for {user_id}", flush=True)
        return
    shop, shop_doc_id, token, prof = result

    # ── Stage 3: Load profile + update state ──
    try:
        prof, order_state = await load_and_update_profile(prof, shop_doc_id, user_id, user_msg)
    except Exception as e:
        print(f"🔥 Pipeline: load_and_update_profile CRASH: {e}", flush=True)
        import traceback; traceback.print_exc()
        return
    if order_state == "HUMAN_HANDOVER":
        return  # Admin is handling

    # ⚡ Refresh command
    if user_msg.strip().lower() == "/refresh":
        from customers.profile import save_profile
        await save_profile(shop_doc_id, user_id, prof)
        return

    # ── Stage 4: Build conversation context ──
    ai_config = shop.get("ai_config", {})
    conv_id = user_id
    chat_history, media_parts, photo_context = await build_context(
        shop_doc_id, conv_id, user_msg, attachments, ai_config, acc_id, token,
    )

    # ── Stage 5: Embedding research ──
    tool_info, msg_emb = await run_research(user_msg, shop_doc_id, chat_history)

    # ── Stage 6: AI reasoning ──
    shop_info = shop.get("shop_info", {})
    try:
        unified_result = await generate_ai_reply(
            user_msg=user_msg,
            chat_history=chat_history,
            profile=prof,
            ai_config=ai_config,
            tool_info=tool_info,
            order_state=order_state,
            media_parts=media_parts,
            photo_context=photo_context,
            shop_doc_id=shop_doc_id,
            delivery_info=shop_info.get("deliveryInfo", []),
            payment_info=shop_info.get("paymentInfo", []),
            currency=shop_info.get("currency", "MMK"),
        )
    except Exception as e:
        print(f"🔥 Pipeline: generate_ai_reply CRASH: {e}", flush=True)
        import traceback; traceback.print_exc()
        return

    # ── Stage 7: Send reply + handle order ──
    try:
        await send_reply(
            unified_result=unified_result,
            acc_id=acc_id,
            user_id=user_id,
            conv_id=conv_id,
            shop_doc_id=shop_doc_id,
            token=token,
            prof=prof,
            currency=shop_info.get("currency", "MMK"),
            channel=shop.get("channel", ""),
            agent_id=shop.get("agentId"),
            lang=ai_config.get("responseLanguage", "Myanmar"),
        )
    except Exception as e:
        print(f"🔥 Pipeline: send_reply CRASH: {e}", flush=True)
        import traceback; traceback.print_exc()

    # ── Stage 8: Finalize (analytics, summary, cache) ──
    await finalize_pipeline(
        unified_result=unified_result,
        shop_doc_id=shop_doc_id,
        acc_id=acc_id,
        conv_id=conv_id,
        user_id=user_id,
        prof=prof,
        msg_emb=msg_emb,
        user_msg=user_msg,
    )

    print(f"⏱️  Pipeline TOTAL: {(time.time() - t_start):.2f}s", flush=True)


async def _handle_admin_feedback(data: dict) -> None:
    """Process admin feedback events."""
    acc_id = data.get("acc_id") or data.get("bot_id")
    if not acc_id:
        return

    from shops.service import get_shop_data
    shop = await get_shop_data(acc_id)
    if not shop:
        return

    from shops.analytics import log_analytics
    await log_analytics(shop["shop_doc_id"], "ADMIN_FEEDBACK", {
        "feedback_type": data.get("feedback_type", "unknown"),
        "feedback_text": data.get("feedback_text", ""),
        "conv_id": data.get("conv_id", ""),
    })
