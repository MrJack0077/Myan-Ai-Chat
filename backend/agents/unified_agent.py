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
    
    # Build compact context
    pmt_str = ", ".join(p.get('type', '') for p in (payment_info or [])) or "Cash"
    
    extra_ctx = [
        f"[CUSTOMER] Name={ident.get('name','?')} | State={order_state} | Phone={ident.get('phone','?')}",
        f"[ORDER] Items={', '.join(dynamics.get('items',[]))} | Total={dynamics.get('total_price',0)} {currency} | Payment={dynamics.get('payment_method','?')}",
        f"[PAYMENT METHODS] {pmt_str}, COD",
        f"[CURRENCY] {currency}",
        f"[DATABASE INFO]\n{tool_info if tool_info else 'No products in database.'}",
        INTENT_GUIDE,
    ]
    
    if photo_context:
        extra_ctx.append(f"[PHOTO CONTEXT]\n{photo_context}")

    sys_inst = await assemble_system_prompt(
        ai_config, intent=None,
        extra_context=extra_ctx,
        shop_doc_id=shop_doc_id,
    )
    
    model = GenerativeModel(BASE_MODEL_NAME, system_instruction=sys_inst)
    
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
        data = json.loads(clean) if clean else {}
        
        # ⚡ Normalize: AI sometimes returns "response" instead of "reply"
        if "response" in data and not data.get("reply"):
            data["reply"] = data.pop("response")
        if "question" in data and not data.get("reply"):
            data["reply"] = data.pop("question")
        
        um = res.usage_metadata
        tokens = {
            "prompt_tokens": um.prompt_token_count if um else 0,
            "candidate_tokens": um.candidates_token_count if um else 0,
        }
        print(f"⏱️  Unified Agent: {(time.time()-t_start):.2f}s | intent={data.get('intent','?')} | prompt_tokens={tokens['prompt_tokens']}", flush=True)
        
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
