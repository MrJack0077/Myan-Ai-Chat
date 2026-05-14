"""Shared base utilities for all AI agents — model calling + error handling."""
import json
import re
import asyncio
import google.generativeai as genai


async def call_agent_model(base_model_name, sys_inst, contents, response_schema, temperature=0.2):
    """Call Gemini model with 12s timeout. Falls back to hardcoded on timeout."""
    model = genai.GenerativeModel(base_model_name, system_instruction=sys_inst)

    try:
        gen_config = genai.GenerationConfig(
            response_mime_type="application/json",
            response_schema=response_schema,
            temperature=temperature,
        )
        res = await asyncio.wait_for(
            model.generate_content_async(contents=contents, generation_config=gen_config),
            timeout=12.0
        )
    except asyncio.TimeoutError:
        print(f"⏰ AI call timed out after 12s — using fallback", flush=True)
        raise TimeoutError("AI call exceeded 12s timeout")
    except Exception as e:
        print(f"⚠️ AI model error: {e} — using fallback", flush=True)
        raise

    # Parse JSON response
    clean_json = re.sub(r'```json\n|\n```|```', '', res.text).strip()
    data = json.loads(clean_json)

    tokens = {
        "prompt_tokens": res.usage_metadata.prompt_token_count,
        "candidate_tokens": res.usage_metadata.candidates_token_count,
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
