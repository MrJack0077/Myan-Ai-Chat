"""Shared base utilities for all AI agents — google-genai SDK (Vertex AI backend)."""
import json
import re
import asyncio

# Migrated from deprecated vertexai SDK to google-genai SDK
from google import genai
from utils.config import genai_client

# Context Caching is always available in google-genai SDK
_CACHE_AVAILABLE = True


async def call_agent_model(base_model_name, sys_inst, contents, response_schema, temperature=0.2, shop_doc_id=None, config_version=None):
    """Call Vertex AI via google-genai SDK with optional Context Cache.
    
    If shop_doc_id and config_version are provided, uses Vertex AI Context Cache
    to store the system instruction prefix (50-75% token savings).
    """
    
    # ── Context Cache Lookup ──
    cached_content_name = None
    if shop_doc_id and config_version:
        try:
            from core.prompt_cache import get_cached_content_id, set_cached_content_id
            cached_content_name = await get_cached_content_id(shop_doc_id, config_version)
            if cached_content_name:
                print(f"🎯 Cache HIT for shop {shop_doc_id}: {cached_content_name[:20]}...", flush=True)
        except Exception as e:
            print(f"⚠️ Cache lookup error (non-critical): {e}", flush=True)
    
    # ── Build GenerateContentConfig ──
    config_dict = {
        "response_mime_type": "application/json",
        "temperature": temperature,
        "system_instruction": sys_inst,
    }
    
    if response_schema:
        config_dict["response_json_schema"] = response_schema
    
    if cached_content_name:
        config_dict["cached_content"] = cached_content_name
        print(f"🔗 Using cached content: {cached_content_name[:20]}...", flush=True)
    
    generate_config = genai.types.GenerateContentConfig(**config_dict)
    
    # ── Call Vertex AI (async) ──
    try:
        response = await asyncio.wait_for(
            genai_client.aio.models.generate_content(
                model=base_model_name,
                contents=contents,
                config=generate_config,
            ),
            timeout=15.0  # ⚡ 15s max — don't keep customer waiting
        )
    except asyncio.TimeoutError:
        print(f"⏰ AI timeout ({base_model_name}) — using fallback", flush=True)
        return make_fallback_response("ခဏစောင့်ပေးပါရှင့်။ ပြန်ကြိုးစားပါမယ်။"), {"prompt_tokens": 0, "candidate_tokens": 0}

    # ── Parse response ──
    clean_json = re.sub(r'```json\n|\n```|```', '', str(response.text)).strip()
    data = json.loads(clean_json) if clean_json else {}
    um = response.usage_metadata
    tokens = {
        "prompt_tokens": um.prompt_token_count if um else 0,
        "candidate_tokens": um.candidates_token_count if um else 0,
    }
    
    # ── Create cache for next call if we didn't have one ──
    if not cached_content_name and shop_doc_id and config_version:
        try:
            from core.prompt_cache import set_cached_content_id
            cache_create_config = genai.types.CreateCachedContentConfig(
                system_instruction=sys_inst,
                contents=contents[:1] if contents else [],
                ttl="7200s",
            )
            cached = genai_client.caches.create(
                model=base_model_name,
                config=cache_create_config,
            )
            await set_cached_content_id(shop_doc_id, config_version, cached.name)
            print(f"💾 Cache CREATED for shop {shop_doc_id}: {cached.name[:20]}...", flush=True)
        except Exception as ce:
            print(f"⚠️ Cache create error (non-critical): {ce}", flush=True)
    
    return data, tokens


def call_agent_model_sync(base_model_name, sys_inst, contents, response_schema, temperature=0.2):
    """Synchronous Vertex AI call via google-genai SDK."""
    
    config_dict = {
        "response_mime_type": "application/json",
        "temperature": temperature,
        "system_instruction": sys_inst,
    }
    
    if response_schema:
        config_dict["response_json_schema"] = response_schema
    
    generate_config = genai.types.GenerateContentConfig(**config_dict)
    
    response = genai_client.models.generate_content(
        model=base_model_name,
        contents=contents,
        config=generate_config,
    )
    
    clean_json = re.sub(r'```json\n|\n```|```', '', str(response.text)).strip()
    data = json.loads(clean_json) if clean_json else {}
    um = response.usage_metadata
    tokens = {
        "prompt_tokens": um.prompt_token_count if um else 0,
        "candidate_tokens": um.candidates_token_count if um else 0,
    }
    return data, tokens


def merge_tokens(data, tokens):
    """Merge token counts into response dict."""
    data.update(tokens)
    return data


def make_fallback_response(fallback_message="Connecting to human agent..."):
    """Standard fallback when agent fails completely."""
    return {
        "is_complex": True,
        "intent": "OTHER",
        "extracted": {},
        "reply": fallback_message,
        "prompt_tokens": 0,
        "candidate_tokens": 0,
    }


def merge_tokens(data, tokens):
    """Merge token counts into response dict."""
    data.update(tokens)
    return data


def make_fallback_response(fallback_message="Connecting to human agent..."):
    """Standard fallback when agent fails completely."""
    return {
        "is_complex": True,
        "intent": "OTHER",
        "extracted": {},
        "reply": fallback_message,
        "prompt_tokens": 0,
        "candidate_tokens": 0,
    }
