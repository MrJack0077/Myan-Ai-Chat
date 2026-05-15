"""
Single-Pass Unified Agent — ONE AI call for intent + reply + extraction.

Replaces: Greeting Router + Automation Agent + Product/Order/Media/Service agents.
Reduces AI calls from 2-4 to 1 per message.
Error points from 9 to 3.
"""
import asyncio
import asyncio
import json
import re
import time
import typing_extensions
from vertexai.generative_models import GenerativeModel, GenerationConfig
from core.prompt_builder import assemble_system_prompt
from utils import BASE_MODEL_NAME


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


# ── Compact intent + action guide (built into system prompt) ──
INTENT_GUIDE = """INTENTS (pick one):
GREETING — hello/thanks | reply warmly 1-2 sentences
PRODUCT_INQUIRY — items/prices/colors/sizes | reply from DB info only, never invent
START_ORDER — want to buy/order | reply empty, extracted.items=what they want
ORDER — in order flow collecting info | ask 1 missing piece at a time
DELIVERY — shipping/times | reply from delivery info
PAYMENT — methods/KPay/COD | reply from payment info
SLIP_UPLOAD — payment screenshot | reply empty
POLICY_FAQ — refunds/returns/warranty | reply from policy
COMPLAINT_OR_HUMAN — upset/complex/want human | is_complex=TRUE, reply empathy
OUT_OF_DOMAIN — unrelated topics | polite redirect
SERVICE — service booking | collect name+phone+service type+time

RULES:
- HUMAN_MODE: Never say AI/bot/virtual. Use ပါရှင့်/နော်/ရှင့် naturally.
- Only use DATABASE INFO for products. Never invent items/prices.
- If DB has no match: say "မရှိပါရှင့်" not "I think maybe..."
- Extract name/phone/address/items naturally from conversation.
- buttons: max 3 quick-reply options. images: matching product image URLs.
- COMPLAINT only: is_complex=TRUE. Everything else: false."""


async def run_unified_agent(
    user_msg: str,
    chat_history: str,
    profile: dict,
    ai_config: dict,
    tool_info: str,
    order_state: str,
    media_parts: list = None,
    photo_context: str = "",
    shop_doc_id: str = None,
    delivery_info: list = None,
    payment_info: list = None,
    currency: str = "MMK",
) -> dict:
    """
    ONE AI call that replaces EVERYTHING:
    - Greeting detection → handled by intent=GREETING
    - Intent classification → intent field
    - Reply generation → reply field
    - Order data extraction → extracted field
    - Preference extraction → extracted preferences
    - Complexity detection → is_complex field
    """
    ident = profile.get("identification", {})
    dynamics = profile.get("dynamics", {})
    
    # Build complete context from ALL aiConfig fields
    pmt_str = ", ".join(p.get('type', '') for p in (payment_info or [])) or "Cash"
    faqs = ai_config.get("faqs", [])
    kb = ai_config.get("knowledgeBase", [])
    templates = ai_config.get("replyTemplates", {})
    constraints = ai_config.get("constraints", [])
    handoff = ai_config.get("humanHandoff", {})
    rules = ai_config.get("automationRules", [])
    
    extra_ctx = [
        f"[CUSTOMER] Name={ident.get('name','?')} | State={order_state} | Phone={ident.get('phone','?')}",
        f"[ORDER] Items={', '.join(prof.get('current_order',{}).get('items',[]))} | Total={prof.get('current_order',{}).get('total_price',0)} {currency}",
        f"[PAYMENT METHODS] {pmt_str}, COD",
        f"[CURRENCY] {currency}",
        f"[DATABASE INFO]\n{tool_info if tool_info else 'No products in database.'}",
        INTENT_GUIDE,
    ]
    
    # ⚡ ALL AI Training Page data → prompt
    if constraints:
        extra_ctx.append(f"[SHOP CONSTRAINTS]\n" + "\n".join(f"- {c}" for c in constraints))
    if faqs:
        faq_lines = [f"Q: {f.get('question','')}\nA: {f.get('answer','')}" for f in faqs[:5] if f.get('isActive', True)]
        if faq_lines:
            extra_ctx.append(f"[SHOP FAQs]\n" + "\n".join(faq_lines))
    if templates:
        tmpl_lines = [f"{k}: {v}" for k, v in templates.items()]
        if tmpl_lines:
            extra_ctx.append(f"[REPLY TEMPLATES]\n" + "\n".join(tmpl_lines))
    if handoff:
        extra_ctx.append(f"[HUMAN HANDOFF RULES]\nKeywords: {', '.join(handoff.get('triggerKeywords',[]))}\nMin Price: {handoff.get('minPriceThreshold',0)}")
    if rules:
        active_rules = [r for r in rules if r.get('isActive', True)]
        if active_rules:
            extra_ctx.append(f"[AUTOMATION RULES]\n" + json.dumps(active_rules, indent=2))
    
    if photo_context:
        extra_ctx.append(f"[PHOTO CONTEXT]\n{photo_context}")

    sys_inst = await assemble_system_prompt(
        ai_config, intent=None,
        extra_context=extra_ctx,
        shop_doc_id=shop_doc_id,
    )
    
    # ⚡ VERTEX CONTEXT CACHE: Cache system prompt per shop (not product DB)
    # Saves 36% token cost on every subsequent message for this shop
    cached_content = None
    if shop_doc_id:
        try:
            from core.prompt_cache import get_cached_content_id, set_cached_content_id, get_shop_config_version
            config_ver = await get_shop_config_version(shop_doc_id)
            if config_ver:
                cache_id = await get_cached_content_id(shop_doc_id, config_ver)
                if cache_id:
                    try:
                        from vertexai.generative_models import CachedContent as CachedContentCls
                        cached_content = CachedContentCls(cache_id) if hasattr(CachedContentCls, '__init__') else None
                    except:
                        cached_content = cache_id  # pass ID if class not available
                    if cached_content:
                        print(f"🎯 Vertex Cache HIT: shop={shop_doc_id} (config_ver={config_ver[:8]})", flush=True)
        except Exception as e:
            print(f"⚠️ Vertex Cache lookup error (non-critical): {e}", flush=True)
    
    model_kwargs = {}
    if cached_content:
        model_kwargs['cached_content'] = cached_content
        print(f"🔗 Using Vertex cached content for shop {shop_doc_id}", flush=True)
    
    model = GenerativeModel(BASE_MODEL_NAME, system_instruction=sys_inst, **model_kwargs)
    
    contents = []
    if chat_history:
        contents.append(f"Recent Chat:\n{chat_history}\n---")
    if media_parts:
        for part in media_parts:
            if isinstance(part, dict) and part.get("mime_type") and part.get("data"):
                contents.append(part)
    contents.append(f"Customer: {user_msg}")

    t_start = time.time()
    try:
        res = await asyncio.wait_for(
            model.generate_content_async(
                contents=contents,
                generation_config=GenerationConfig(
                    response_mime_type="application/json",
                    # ⚡ response_schema removed — Vertex SDK has bugs with TypedDict
                    temperature=0.2,
                ),
            ),
            timeout=8.0  # ⚡ 8s timeout — don't keep customer waiting
        )
        clean = re.sub(r'```json\n|\n```|```', '', str(res.text)).strip()
        print(f"📋 Raw AI output ({len(clean)} chars): {clean[:200]}...", flush=True)
        
        # ⚡ JSON repair: if AI output is truncated/invalid, try to extract reply
        data = {}
        try:
            data = json.loads(clean)
        except json.JSONDecodeError:
            # Try to salvage: extract reply field with regex
            reply_match = re.search(r'"reply"\s*:\s*"([^"]*)"', clean)
            intent_match = re.search(r'"intent"\s*:\s*"([^"]*)"', clean)
            if reply_match:
                data["reply"] = reply_match.group(1)
                print(f"⚡ JSON salvage: extracted reply via regex", flush=True)
            if intent_match:
                data["intent"] = intent_match.group(1)
            if not data:
                print(f"⚠️ JSON parse failed completely — returning empty", flush=True)
        
        # ⚡ Normalize: AI sometimes returns nested structures or wrong field names
        if isinstance(data.get("response"), dict):
            # AI returned {response: {text: "...", ...}} → extract text
            inner = data["response"]
            data["reply"] = inner.get("text") or inner.get("reply") or ""
            if "intent" in inner and not data.get("intent"):
                data["intent"] = inner["intent"]
        elif isinstance(data.get("response"), str):
            data["reply"] = data.pop("response")
        
        if "question" in data and not data.get("reply"):
            data["reply"] = data.pop("question")
        if "answer" in data and not data.get("reply"):
            data["reply"] = data.pop("answer")
        if "message" in data and not data.get("reply"):
            data["reply"] = data.pop("message")
        
        um = res.usage_metadata
        tokens = {
            "prompt_tokens": um.prompt_token_count if um else 0,
            "candidate_tokens": um.candidates_token_count if um else 0,
        }
        print(f"⏱️  Unified Agent: {(time.time()-t_start):.2f}s | intent={data.get('intent','?')} | prompt_tokens={tokens['prompt_tokens']}", flush=True)
        
        # ⚡ VERTEX CACHE CREATION: After first successful call, create cache for next time
        if not cached_content and shop_doc_id:
            try:
                from core.prompt_cache import set_cached_content_id, get_shop_config_version
                config_ver = await get_shop_config_version(shop_doc_id)
                if config_ver:
                    from vertexai.generative_models import CachedContent as CachedContentCls
                    # Create cache from this response's context
                    new_cache = CachedContentCls.create(
                        model_name=BASE_MODEL_NAME,
                        system_instruction=sys_inst,
                        contents=contents[:1] if contents else [],
                        ttl="7200s"  # 2 hours
                    )
                    await set_cached_content_id(shop_doc_id, config_ver, new_cache.name)
                    print(f"💾 Vertex Cache CREATED: shop={shop_doc_id} (2hr TTL)", flush=True)
            except Exception as ce:
                print(f"⚠️ Vertex Cache create error (non-critical): {ce}", flush=True)
        
        # Validate outputs
        data.setdefault("intent", "PRODUCT_INQUIRY")
        data.setdefault("reply", "")
        data.setdefault("is_complex", False)
        data.setdefault("extracted", {})
        data["prompt_tokens"] = tokens["prompt_tokens"]
        data["candidate_tokens"] = tokens["candidate_tokens"]
        
        return data

    except Exception as e:
        import traceback
        print(f"🔥 Unified Agent Error: {e}", flush=True)
        print(f"📋 Traceback:\n{traceback.format_exc()}", flush=True)
        return _unified_fallback(e)


def _unified_fallback(error) -> dict:
    """Safe fallback — never escalate unless truly needed."""
    err_msg = str(error)[:200]
    is_model_issue = "404" in err_msg or "not found" in err_msg.lower()
    
    return {
        "reasoning": f"Fallback: {err_msg}",
        "reply": "ခဏစောင့်ပေးပါရှင့်။ ပြန်ကြိုးစားပါမယ်။" if is_model_issue else "",
        "intent": "",  # Empty → let keyword classifier decide
        "is_complex": False,  # Never auto-escalate on error
        "extracted": {},
        "prompt_tokens": 0,
        "candidate_tokens": 0,
    }
