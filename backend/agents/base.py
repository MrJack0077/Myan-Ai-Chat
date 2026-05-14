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


async def call_agent_model(base_model_name, sys_inst, contents, response_schema, temperature=0.2):
    """Call Vertex AI first (better limits), fallback to genai AI Studio."""
    
    # Try Vertex AI first
    if _use_vertex:
        try:
            from vertexai.generative_models import GenerativeModel, GenerationConfig
            model = GenerativeModel(base_model_name, system_instruction=sys_inst)
            gen_config = GenerationConfig(
                response_mime_type="application/json",
                response_schema=response_schema,
                temperature=temperature,
            )
            res = await asyncio.wait_for(
                model.generate_content_async(contents=contents, generation_config=gen_config),
                timeout=20.0
            )
            clean_json = re.sub(r'```json\n|\n```|```', '', res.text).strip()
            data = json.loads(clean_json)
            tokens = {
                "prompt_tokens": res.usage_metadata.prompt_token_count if res.usage_metadata else 0,
                "candidate_tokens": res.usage_metadata.candidates_token_count if res.usage_metadata else 0,
            }
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
