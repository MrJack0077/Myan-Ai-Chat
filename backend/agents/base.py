"""Shared base utilities for all AI agents — model calling + error handling."""
import json
import re
import asyncio
import google.generativeai as genai

# Try Vertex AI for better rate limits
_use_vertex = False
try:
    from utils.config import _vertex_available
    _use_vertex = _vertex_available
except Exception:
    pass


async def call_agent_model(base_model_name, sys_inst, contents, response_schema, temperature=0.2, shop_doc_id=None, config_version=None):
    """Call Vertex AI first, fallback to genai AI Studio.
    
    If shop_doc_id and config_version are provided, uses Vertex AI Context Cache
    to store the system instruction prefix for 50-70% token savings on subsequent calls.
    """
    
    # ── Vertex AI Context Cache ──
    cached_content_id = None
    if _use_vertex and shop_doc_id and config_version:
        try:
            from core.prompt_cache import get_cached_content_id, set_cached_content_id
            cached_content_id = await get_cached_content_id(shop_doc_id, config_version)
            if cached_content_id:
                print(f"🎯 Cache HIT for shop {shop_doc_id}: {cached_content_id[:20]}...", flush=True)
        except Exception as e:
            print(f"⚠️ Cache lookup error (non-critical): {e}", flush=True)
    
    # ── Try Vertex AI ──
    _vertex_models = {'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash-001', 'gemini-2.0-flash-lite-001'}
    if _use_vertex and base_model_name in _vertex_models:
        try:
            from vertexai.generative_models import GenerativeModel, GenerationConfig, CachedContent
            
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
            res = await asyncio.wait_for(
                model.generate_content_async(contents=contents, generation_config=gen_config),
                timeout=20.0
            )
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
                    # Create a cached content from this response
                    cached = CachedContent.create(
                        model_name=base_model_name,
                        system_instruction=sys_inst,
                        contents=contents[:1] if contents else [],  # First message as prefix
                        ttl="7200s",  # 2 hours
                    )
                    await set_cached_content_id(shop_doc_id, config_version, cached.name)
                    print(f"💾 Cache CREATED for shop {shop_doc_id}: {cached.name[:20]}...", flush=True)
                except Exception as ce:
                    print(f"⚠️ Cache create error (non-critical): {ce}", flush=True)
            
            return data, tokens
        except asyncio.TimeoutError:
            print(f"⏰ Vertex AI timeout — falling back to AI Studio", flush=True)
        except Exception as e:
            print(f"⚠️ Vertex AI error: {e} — falling back to AI Studio", flush=True)
    
    # Fallback: AI Studio
    model = genai.GenerativeModel(base_model_name, system_instruction=sys_inst)
    try:
        gen_config = genai.GenerationConfig(
            response_mime_type="application/json",
            response_schema=response_schema,
            temperature=temperature,
        )
        res = await asyncio.wait_for(
            model.generate_content_async(contents=contents, generation_config=gen_config),
            timeout=20.0
        )
    except asyncio.TimeoutError:
        print(f"⏰ AI call timed out after 20s — using fallback", flush=True)
        raise TimeoutError("AI call exceeded 20s timeout")
    except Exception as e:
        print(f"⚠️ AI model error: {e} — using fallback", flush=True)
        raise

    clean_json = re.sub(r'```json\n|\n```|```', '', res.text).strip()
    data = json.loads(clean_json)
    tokens = {
        "prompt_tokens": res.usage_metadata.prompt_token_count if res.usage_metadata else 0,
        "candidate_tokens": res.usage_metadata.candidates_token_count if res.usage_metadata else 0,
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
