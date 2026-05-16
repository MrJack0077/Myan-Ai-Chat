"""
AI: Unified Agent — ONE AI call replaces intent classification + reply generation + data extraction.
Replaces: Greeting Router + all separate agents (product/order/media/service).
"""
import asyncio
import json
import re
import time
import typing_extensions
from google import genai
from config import genai_client, BASE_MODEL_NAME
from .prompts.assembler import assemble_system_prompt
from .memory import build_conversation_context, count_customer_messages


# ── Structured output types ──
class ExtractedData(typing_extensions.TypedDict, total=False):
    name: str
    phone: str
    address: str
    items: list[str]
    payment_method: str
    total_price: int
    buttons: list[str]
    images: list[str]


class UnifiedAgentResponse(typing_extensions.TypedDict):
    reasoning: str
    reply: str
    intent: str
    is_complex: bool
    extracted: ExtractedData


# ── Compact intent guide (injected into system prompt) ──
INTENT_GUIDE = """INTENTS (pick one):
GREETING — hello/thanks/mingalarbar | reply warmly 1-2 sentences
PRODUCT_INQUIRY — items/prices/colors/sizes | reply from DB, never invent
START_ORDER — want to buy/order. Myanmar trigger words: ယူမယ်, ဝယ်မယ်, မှာမယ်, အော်ဒါတင်, လိုချင်တယ်, ကြိုက်တယ်. Reply: natural transition 'အော်ဒါတင်ဖို့ နာမည်လေးပေးပါရှင့်' | SET intent=START_ORDER, extracted.items=what they want
ORDER — in order flow collecting info | ask 1 missing piece at a time
ORDER_CONFIRMED — customer confirms ALL details correct | is_complex=TRUE, reply: warm thank-you + full order summary
DELIVERY — shipping/times/ပို့ခ/ရောက်ချိန် | reply from delivery info
PAYMENT — methods/KPay/COD/ငွေပေးချေ | reply from payment info
SLIP_UPLOAD — payment screenshot | reply empty
POLICY_FAQ — refunds/returns/warranty | reply from policy
COMPLAINT_OR_HUMAN — upset/complex/want human | is_complex=TRUE, reply empathy
OUT_OF_DOMAIN — unrelated | polite redirect
SERVICE — service booking | collect name+phone+service+time

RULES:
- NEVER say AI/bot/virtual. Use ပါရှင့်/နော်/ရှင့် naturally.
- Only use DATABASE INFO for products. Never invent items/prices.
- If DB has no match: say "မရှိပါရှင့်" not "I think maybe..."
- Extract name/phone/address/items naturally from conversation.
- buttons: max 3 quick-reply options.
- COMPLAINT only: is_complex=TRUE. Everything else: false.
- START_ORDER: ONLY set when customer clearly wants to buy. 'ယူမယ်', 'ဝယ်မယ်', 'မှာမယ်' = START_ORDER. Do NOT set START_ORDER for just browsing or asking prices."""


async def run_unified_agent(
    user_msg: str,
    chat_history: str = "",
    profile: dict = None,
    ai_config: dict = None,
    tool_info: str = "",
    order_state: str = "NONE",
    media_parts: list = None,
    photo_context: str = "",
    shop_doc_id: str = None,
    delivery_info: list = None,
    payment_info: list = None,
    currency: str = "MMK",
) -> dict:
    """
    ONE AI call for intent + reply + extraction + complexity detection.
    Returns {intent, reply, is_complex, extracted, prompt_tokens, candidate_tokens}.
    """
    profile = profile or {}
    ai_config = ai_config or {}
    ident = profile.get("identification", {})
    dynamics = profile.get("dynamics", {})

    # Payment methods string
    pmt_str = ", ".join(p.get('type', '') for p in (payment_info or [])) or "Cash"

    extra_ctx = [
        f"[CUSTOMER & ORDER CONTEXT]",
        f"Name={ident.get('name','?')} | Phone={ident.get('phone','?')} | Address={ident.get('address','?')}",
        f"Order State={order_state} | Items={', '.join(profile.get('current_order',{}).get('items',[]))} | Total={profile.get('current_order',{}).get('total_price',0)} {currency}",
        f"Segment={profile.get('identification',{}).get('segment','new')} | Message #{profile.get('dynamics',{}).get('message_count',0)}",
    ]
    
    # ⚡ ORDER STATE AWARENESS — critical for keeping context
    if order_state == "COLLECTING":
        extra_ctx.append(f"⚡ ORDER STATE: You are COLLECTING order info.")
        extra_ctx.append(f"   IMPORTANT: Extract name, phone, address, items from EVERY message.")
        extra_ctx.append(f"   If customer gives info → update extracted fields, thank them, ask NEXT missing field.")
        extra_ctx.append(f"   If customer says 'yes/ok/confirm/ဟုတ်ကဲ့/မှန်ပါတယ်/အိုကေ' → intent=ORDER_CONFIRMED, is_complex=TRUE.")
        extra_ctx.append(f"   DO NOT greet again. Stay in order flow!")
        extra_ctx.append(f"   DO NOT set intent=GREETING when customer confirms — use ORDER_CONFIRMED.")
    elif order_state == "CONFIRMING":
        extra_ctx.append(f"⚡ ORDER STATE: Customer CONFIRMING. Show full order summary + payment method.")
        extra_ctx.append(f"   Ask: 'မှန်ကန်ပါသလားရှင့်' — if yes → intent=ORDER_CONFIRMED.")
    elif order_state == "COMPLETED":
        extra_ctx.append(f"⚡ ORDER STATE: Order completed. Thank customer and suggest related products.")
    
    extra_ctx += [
        f"[PAYMENT METHODS] {pmt_str}, COD",
        f"[CURRENCY] {currency}",
    ]

    # ⚡ DELIVERY INFO — always include so AI doesn't invent prices
    if delivery_info:
        deli_lines = []
        for d in delivery_info:
            city = d.get("city", "?")
            price = d.get("price", "?")
            days = d.get("days", "?")
            deli_lines.append(f"  {city}: {price} MMK ({days})")
        extra_ctx.append(f"[DELIVERY INFO — USE THESE EXACT PRICES]\n" + "\n".join(deli_lines))
        extra_ctx.append(f"  ⚡ Always quote delivery from this list. If city not listed, say 'မြို့ပေါ်မူတည်ပါတယ်'.")
    else:
        extra_ctx.append(f"[DELIVERY INFO] Not configured. Never invent delivery prices — say 'အော်ဒါတင်ပြီးမှ အတိအကျပြောပေးပါမယ်ရှင့်'.")

    extra_ctx.append(f"[DATABASE INFO]\n{tool_info if tool_info else 'No products in database.'}")
    extra_ctx.append(INTENT_GUIDE)

    # AI Training Page data → prompt
    constraints = ai_config.get("constraints", [])
    if constraints:
        extra_ctx.append(f"[SHOP CONSTRAINTS]\n" + "\n".join(f"- {c}" for c in constraints))
    faqs = ai_config.get("faqs", [])
    if faqs:
        faq_lines = [f"Q: {f.get('question','')}\nA: {f.get('answer','')}"
                     for f in faqs[:5] if f.get('isActive', True)]
        if faq_lines:
            extra_ctx.append(f"[SHOP FAQs]\n" + "\n".join(faq_lines))
    templates = ai_config.get("replyTemplates", {})
    if templates:
        tmpl_lines = [f"{k}: {v}" for k, v in templates.items()]
        if tmpl_lines:
            extra_ctx.append(f"[REPLY TEMPLATES]\n" + "\n".join(tmpl_lines))
    handoff = ai_config.get("humanHandoff", {})
    if handoff:
        extra_ctx.append(f"[HUMAN HANDOFF] Keywords: {', '.join(handoff.get('triggerKeywords',[]))}")
    rules = ai_config.get("automationRules", [])
    if rules:
        active_rules = [r for r in rules if r.get('isActive', True)]
        if active_rules:
            extra_ctx.append(f"[AUTOMATION RULES]\n" + json.dumps(active_rules, indent=2))
    if photo_context:
        extra_ctx.append(f"[PHOTO CONTEXT]\n{photo_context}")

    # Assemble system prompt
    sys_inst = await assemble_system_prompt(
        ai_config, intent=None, extra_context=extra_ctx, shop_doc_id=shop_doc_id,
    )

    # Vertex AI context cache (disabled - causes Invalid CachedContent errors)
    cached_content_name = None
    # if shop_doc_id:
    #     try:
    #         from .prompts.cache import get_cached_prompt, set_cached_prompt
    #         config_hash = await _get_config_hash(shop_doc_id, ai_config)
    #         if config_hash:
    #             cached_content_name = await get_cached_prompt(shop_doc_id, config_hash)
    #     except Exception as e:
    #         print(f\"⚠️ Vertex Cache lookup error: {e}\", flush=True)

    model_config = {
        "response_mime_type": "application/json",
        "temperature": 0.2,
        "system_instruction": sys_inst,
    }
    if cached_content_name:
        model_config["cached_content"] = cached_content_name

    gen_config = genai.types.GenerateContentConfig(**model_config)

    # Build contents — include proper conversation context
    contents = []
    if chat_history:
        # Take last 8 messages for memory context
        lines = chat_history.strip().split("\n")
        recent = lines[-16:] if len(lines) > 16 else lines  # 8 exchanges = 16 lines
        contents.append(f"[RECENT CONVERSATION — LAST 8 MESSAGES]\n" + "\n".join(recent) + "\n---")
    if media_parts:
        for part in media_parts:
            if isinstance(part, dict) and part.get("mime_type") and part.get("data"):
                contents.append(part)
    contents.append(f"Customer: {user_msg}")

    t_start = time.time()
    last_error_msg = ""
    
    for attempt in range(2):  # ⚡ 2 attempts max
        try:
            res = await asyncio.wait_for(
                genai_client.aio.models.generate_content(
                    model=BASE_MODEL_NAME, contents=contents, config=gen_config,
                ),
                timeout=8.0,
            )
            break  # Success — exit retry loop
        except asyncio.TimeoutError:
            if attempt == 0:
                print(f"⚠️ AI timeout, retrying... (attempt {attempt+1}/2)", flush=True)
                await asyncio.sleep(0.5)
                continue
            # Both attempts timed out — return fallback
            print(f"❌ AI timed out after 2 attempts", flush=True)
            return _safe_fallback()
        except Exception as e:
            error_str = str(e)
            last_error_msg = error_str[:200]
            if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                if attempt == 0:
                    wait = 1.5
                    print(f"⚠️ AI rate limited (429), retrying in {wait}s...", flush=True)
                    await asyncio.sleep(wait)
                    continue
                print(f"❌ AI rate limited after 2 attempts", flush=True)
                return _safe_fallback()
            # Non-retriable error
            print(f"🔥 AI call failed: {error_str[:200]}", flush=True)
            return _safe_fallback()
        clean = re.sub(r'```json\n|\n```|```', '', str(res.text)).strip()

        # Parse JSON response
        data = {}
        try:
            data = json.loads(clean)
        except json.JSONDecodeError:
            reply_match = re.search(r'"reply"\s*:\s*"([^"]*)"', clean)
            intent_match = re.search(r'"intent"\s*:\s*"([^"]*)"', clean)
            if reply_match:
                data["reply"] = reply_match.group(1)
            if intent_match:
                data["intent"] = intent_match.group(1)
            if not data:
                print("⚠️ JSON parse completely failed", flush=True)

        # Normalize various AI output formats
        from .agent_normalizer import normalize_ai_output
        data = normalize_ai_output(data)

        # Token counts
        um = res.usage_metadata
        tokens = {
            "prompt_tokens": um.prompt_token_count if um else 0,
            "candidate_tokens": um.candidates_token_count if um else 0,
        }

        # Create Vertex cache for next call (disabled - causes issues)
        # if not cached_content_name and shop_doc_id:
        #     asyncio.create_task(_create_vertex_cache(sys_inst, contents, shop_doc_id, ai_config))
        pass

        # Set defaults
        data.setdefault("intent", "PRODUCT_INQUIRY")
        data.setdefault("reply", "")
        data.setdefault("is_complex", False)
        data.setdefault("extracted", {})
        data["prompt_tokens"] = tokens["prompt_tokens"]
        data["candidate_tokens"] = tokens["candidate_tokens"]

        return data


def _safe_fallback() -> dict:
    """Safe fallback reply when AI is completely unavailable (429/timeout)."""
    return {
        "reasoning": "AI unavailable",
        "reply": "ခဏစောင့်ပေးပါရှင့်။ ပြန်ကြိုးစားပါမယ်။",
        "intent": "PRODUCT_INQUIRY",
        "is_complex": False,
        "extracted": {},
        "prompt_tokens": 0,
        "candidate_tokens": 0,
    }
            "intent": "PRODUCT_INQUIRY",
            "is_complex": False,
            "extracted": {},
            "prompt_tokens": 0,
            "candidate_tokens": 0,
        }

def _unified_fallback(error: Exception) -> dict:
    """Safe fallback — never escalate unless truly needed."""
    err_msg = str(error)[:200]
    is_model_issue = "404" in err_msg or "not found" in err_msg.lower()
    return {
        "reasoning": f"Fallback: {err_msg}",
        "reply": "ခဏစောင့်ပေးပါရှင့်။ ပြန်ကြိုးစားပါမယ်။" if is_model_issue else "",
        "intent": "",
        "is_complex": False,
        "extracted": {},
        "prompt_tokens": 0,
        "candidate_tokens": 0,
    }


async def _get_config_hash(shop_doc_id: str, ai_config: dict) -> str | None:
    """Get shop config version hash for Vertex cache key."""
    import hashlib
    try:
        from config import r
        if r:
            ver = await r.get(f"shop_config_ver:{shop_doc_id}")
            if ver:
                return hashlib.sha256((ver + str(ai_config)).encode()).hexdigest()[:16]
    except Exception:
        pass
    return hashlib.sha256(str(ai_config).encode()).hexdigest()[:16]


async def _create_vertex_cache(sys_inst: str, contents: list, shop_doc_id: str,
                                ai_config: dict) -> None:
    """Background task: create Vertex AI context cache for next call."""
    try:
        from .prompts.cache import set_cached_prompt
        from config import genai_client, BASE_MODEL_NAME

        cache_config = genai.types.CreateCachedContentConfig(
            system_instruction=sys_inst,
            contents=contents[:1] if contents else [],
            ttl="7200s",
        )
        new_cache = genai_client.caches.create(
            model=BASE_MODEL_NAME, config=cache_config,
        )
        config_hash = await _get_config_hash(shop_doc_id, ai_config)
        if config_hash:
            await set_cached_prompt(shop_doc_id, config_hash, new_cache.name)
        print(f"💾 Vertex Cache CREATED: shop={shop_doc_id}", flush=True)
    except Exception as e:
        print(f"⚠️ Vertex Cache create error: {e}", flush=True)
