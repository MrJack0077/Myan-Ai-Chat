"""Shared base utilities for all AI agents — Vertex AI only."""
import json
import re
import asyncio

# Vertex AI is mandatory
from vertexai.generative_models import GenerativeModel, GenerationConfig

# CachedContent is optional (only available in newer SDK versions)
try:
    from vertexai.cached_content import CachedContent
    _CACHE_AVAILABLE = True
except ImportError:
    try:
        from vertexai.generative_models import CachedContent as _CachedContent
        CachedContent = _CachedContent
        _CACHE_AVAILABLE = True
    except ImportError:
        CachedContent = None
        _CACHE_AVAILABLE = False
        print("⚠️ CachedContent not available — Vertex AI Context Cache disabled", flush=True)


async def call_agent_model(base_model_name, sys_inst, contents, response_schema, temperature=0.2, shop_doc_id=None, config_version=None):
    """Call Vertex AI with optional Context Cache for 50-75% token savings.
    
    If shop_doc_id and config_version are provided, uses Vertex AI Context Cache
    to store the system instruction prefix.
    """
    
    # ── Vertex AI Context Cache ──
    cached_content_id = None
    if shop_doc_id and config_version:
        try:
            from core.prompt_cache import get_cached_content_id, set_cached_content_id
            cached_content_id = await get_cached_content_id(shop_doc_id, config_version)
            if cached_content_id:
                print(f"🎯 Cache HIT for shop {shop_doc_id}: {cached_content_id[:20]}...", flush=True)
        except Exception as e:
            print(f"⚠️ Cache lookup error (non-critical): {e}", flush=True)
    
    # ── Vertex AI direct call ──
    model_kwargs = {}
    if cached_content_id:
        try:
            model_kwargs['cached_content'] = CachedContent(cached_content_id)
            print(f"🔗 Using cached content: {cached_content_id[:20]}...", flush=True)
        except Exception:
            cached_content_id = None  # Stale cache — will recreate
    
    model = GenerativeModel(base_model_name, system_instruction=sys_inst, **model_kwargs)
    
    try:
        gen_config = GenerationConfig(
            response_mime_type="application/json",
            response_schema=response_schema,
            temperature=temperature,
        )
    except Exception:
        gen_config = GenerationConfig(
            response_mime_type="application/json",
            temperature=temperature,
        )
    
    try:
        res = await asyncio.wait_for(
            model.generate_content_async(contents=contents, generation_config=gen_config),
            timeout=20.0
        )
    except asyncio.TimeoutError:
        raise TimeoutError("Vertex AI call exceeded 20s timeout")

    clean_json = re.sub(r'```json\n|\n```|```', '', str(res.text)).strip()
    data = json.loads(clean_json) if clean_json else {}
    um = res.usage_metadata
    tokens = {
        "prompt_tokens": um.prompt_token_count if um else 0,
        "candidate_tokens": um.candidates_token_count if um else 0,
    }
    
    # ── Create cache for next call if we didn't have one ──
    if not cached_content_id and shop_doc_id and config_version:
        try:
            from core.prompt_cache import set_cached_content_id
            cached = CachedContent.create(
                model_name=base_model_name,
                system_instruction=sys_inst,
                contents=contents[:1] if contents else [],
                ttl="7200s",
            )
            await set_cached_content_id(shop_doc_id, config_version, cached.name)
            print(f"💾 Cache CREATED for shop {shop_doc_id}: {cached.name[:20]}...", flush=True)
        except Exception as ce:
            print(f"⚠️ Cache create error (non-critical): {ce}", flush=True)
    
    return data, tokens


def call_agent_model_sync(base_model_name, sys_inst, contents, response_schema, temperature=0.2):
    """Synchronous Vertex AI call (for simple use cases like embedding/greeting)."""
    model = GenerativeModel(base_model_name, system_instruction=sys_inst)
    try:
        gen_config = GenerationConfig(
            response_mime_type="application/json",
            response_schema=response_schema,
            temperature=temperature,
        )
    except Exception:
        gen_config = GenerationConfig(
            response_mime_type="application/json",
            temperature=temperature,
        )
    
    res = model.generate_content(contents=contents, generation_config=gen_config)
    clean_json = re.sub(r'```json\n|\n```|```', '', str(res.text)).strip()
    data = json.loads(clean_json) if clean_json else {}
    um = res.usage_metadata
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
