"""
Config-driven prompt assembly for multi-tenant AI chatbot.
Each shop's aiConfig controls identity, tone, length, emoji, greeting, and examples.
No hardcoded communication rules — everything flows from shop config + presets.
"""
import json
import hashlib

# ---------------------------------------------------------------------------
#  Preset Styles — shops pick one, or customize granularly
# ---------------------------------------------------------------------------

STYLE_PRESETS = {
    "casual": {
        "label": "Casual / ရင်းရင်းနှီးနှီး",
        "formality": "အစ်မ/ညီမ လေသံ၊ 'ရှင့်' 'နော်' 'ရှင့်ရှင့်' သုံး",
        "sentence_style": "တိုတိုလေးတွေ၊ မေးခွန်းပြန်မေး",
        "max_sentences": 3,
        "emoji": "😊 ✨ 💕 👌 — ၁-၂ ခုထည့်",
        "greeting": "တစ်ခါပဲ နှုတ်ဆက်၊ နောက်ပိုင်း တိုက်ရိုက်ဖြေ",
        "tone_description": "အားပါးတရ၊ ရင်းနှီးစွာ၊ ကူညီချင်စိတ်ရှိ",
    },
    "friendly": {
        "label": "Friendly / ဖော်ဖော်ရွေရွေ",
        "formality": "ယဉ်ယဉ်ကျေးကျေး၊ 'ပါရှင့်' 'ပါခင်ဗျ' သုံး",
        "sentence_style": "သဘာဝကျကျ စီးဆင်း၊ ၂-၃ ကြောင်း",
        "max_sentences": 3,
        "emoji": "🙂 👍 — တစ်ခါတစ်ရံ",
        "greeting": "session တစ်ခုမှာ တစ်ခါပဲ",
        "tone_description": "ဖော်ရွေစွာ၊ ယဉ်ကျေးစွာ၊ ပျော်ပျော်ရွှင်ရွှင်",
    },
    "professional": {
        "label": "Professional / ကျွမ်းကျင်ပုံစံ",
        "formality": "တရားဝင်ဆန်ဆန်၊ 'ခင်ဗျား' 'ရှင်' သုံး",
        "sentence_style": "ရှင်းလင်းပြတ်သား၊ အချက်ကျကျ",
        "max_sentences": 4,
        "emoji": "မသုံးရ — text only",
        "greeting": "အမြဲ ယဉ်ယဉ်ကျေးကျေးဖြေ၊ နှုတ်ဆက်စရာမလို",
        "tone_description": "ယုံကြည်စိတ်ချရသော၊ တိကျသော၊ ကျွမ်းကျင်သော",
    },
    "minimal": {
        "label": "Minimal / အတိုချုပ်",
        "formality": "တိုတောင်း၊ 'ပါ' 'ရပါတယ်' လောက်ပဲ",
        "sentence_style": "၁-၂ ကြောင်း၊ အဓိကအချက်ပဲ",
        "max_sentences": 2,
        "emoji": "လုံးဝမသုံး",
        "greeting": "မနှုတ်ဆက်ဘူး၊ တန်းဖြေ",
        "tone_description": "မြန်ဆန်၊ ရှင်းလင်း၊ တိုတောင်း",
    },
}

# Merged from shop config overrides
DEFAULT_STYLE = {
    "preset": "friendly",
    "max_sentences": 3,
    "emoji": True,
    "greeting_mode": "once_per_session",  # once_per_session | never | contextual
    "use_address_terms": True,            # "ရှင့်" "ခင်ဗျ" "နော်"
    "ask_followup": True,                 # တစ်ခုမေးပြီးရင် question ပြန်မေး
    "show_empathy": True,                 # "စိတ်မကောင်းပါဘူး" type
    "upsell_enabled": True,               # out of stock ဆို alternative ပြ
}


# ---------------------------------------------------------------------------
#  Intent-specific reply rules (light guidelines, shop can override)
# ---------------------------------------------------------------------------

INTENT_GUIDELINES = {
    "GREETING": {
        "max_sentences": 1,
        "rule": "တစ်ကြောင်းတည်းနဲ့ ကြိုဆိုပါ။ ဘာကူညီပေးရမလဲလို့ မေးပါ။",
    },
    "PRODUCT_INQUIRY": {
        "max_sentences": 20,
        "rule": "ဈေး+feature တစ်ခု ပြောပြီး 'အရောင်လေးရော ကြိုက်လား' type မေးခွန်းပြန်မေး။ LIST မလုပ်နဲ့။",
    },
    "START_ORDER": {
        "max_sentences": 0,
        "rule": "စာမပြန်နဲ့ — intent ကို START_ORDER လို့ပဲ set လုပ်။",
    },
    "ORDER": {
        "max_sentences": 4,
        "rule": "လိုအပ်တဲ့ info (ဖုန်း/လိပ်စာ/ငွေပေးချေမှု) တစ်ခုချင်းစီမေး။ အလုံးစုံမမေးနဲ့။",
    },
    "DELIVERY": {
        "max_sentences": 2,
        "rule": "ပို့ဆောင်ချိန်/ဈေးကို အတိအကျဖြေ။ 'အဆင်ပြေလား' မေးခွန်းပြန်မေး။",
    },
    "PAYMENT": {
        "max_sentences": 2,
        "rule": "ရတဲ့နည်းလမ်းတွေပြော။ 'ဘယ်လိုပေးချေချင်လဲ' မေး။",
    },
    "POLICY_FAQ": {
        "max_sentences": 5,
        "rule": "policy အတိုင်း ရှင်းရှင်းလင်းလင်းဖြေ။",
    },
    "COMPLAINT_OR_HUMAN": {
        "max_sentences": 2,
        "rule": "တောင်းပန်စကားပြော၊ human နဲ့ချိတ်ပေးမယ်လို့ပြော။ အကြောင်းပြချက်မရှည်နဲ့။",
    },
    "OUT_OF_DOMAIN": {
        "max_sentences": 1,
        "rule": "ယဉ်ယဉ်ကျေးကျေးငြင်း၊ ဆိုင်ရဲ့အကြောင်းပဲဖြေနိုင်ကြောင်းပြော။",
    },
    "MEDIA": {
        "max_sentences": 2,
        "rule": "ပုံကိုကြည့်ပြီး အတိအကျဖြေ။ မသေချာရင် 'ဒီပစ္စည်းလား' လို့ confirm မေး။",
    },
    "SERVICE": {
        "max_sentences": 20,
        "rule": "ဝန်ဆောင်မှုအကြောင်းရှင်းပြ၊ booking details တစ်ခုချင်းမေး။",
    },
    "DEFAULT": {
        "max_sentences": 20,
        "rule": "သဘာဝကျကျ အတိုချုပ်ဖြေ။ မေးခွန်းတစ်ခုပြန်မေး။",
    },
}


# ---------------------------------------------------------------------------
#  Default reply templates (shop can override via aiConfig.replyTemplates)
# ---------------------------------------------------------------------------

DEFAULT_TEMPLATES = {
    "out_of_stock_mm": "စိတ်မကောင်းပါဘူး{{address_term}}။ {{item_name}} လောလောဆယ်ကုန်နေပါတယ်။ {{alternative}} လေးတော့ရှိပါသေးတယ်နော်။",
    "order_confirm_mm": "အော်ဒါလေး confirm လုပ်ပေးလို့ ကျေးဇူးပါ{{address_term}}။ {{delivery_estimate}} အတွင်းပို့ပေးပါမယ်နော်။",
    "ask_name_mm": "နာမည်လေးပြောပေးပါဦး{{address_term}}။",
    "ask_phone_mm": "ဖုန်းနံပါတ်လေးပေးပါဦး{{address_term}}။",
    "ask_address_mm": "ပို့ပေးရမယ့်လိပ်စာလေးပြောပေးပါဦး{{address_term}}။",
    "ask_payment_mm": "ဘယ်လိုငွေပေးချေချင်ပါလဲ{{address_term}}။ {{payment_options}} ရပါတယ်နော်။",
    "slip_received_mm": "ငွေလွှဲစာရွက်လေးရပါပြီ{{address_term}}။ အော်ဒါလေးကို အတည်ပြုပေးဖို့ အောက်ကအချက်အလက်တွေ ပြန်စစ်ပေးပါဦးနော်။",
    "fallback_mm": "စိတ်မကောင်းပါဘူး{{address_term}}။ ဒီအကြောင်းကို admin နဲ့ချိတ်ဆက်ပေးလိုက်ပါမယ်။ ခဏစောင့်ပေးပါနော်။",
}


# ---------------------------------------------------------------------------
#  Main Prompt Assembly
# ---------------------------------------------------------------------------

def resolve_style(ai_config):
    """Merge preset + shop granular overrides into final style dict."""
    style = dict(DEFAULT_STYLE)
    
    # 1. Try to get style from preset
    preset_name = ai_config.get("formalityLevel", ai_config.get("communicationStyle", {}).get("preset", style["preset"]))
    preset = STYLE_PRESETS.get(preset_name, STYLE_PRESETS["friendly"])
    style["_preset"] = preset

    # 2. Map top-level aiConfig fields to style dict
    # Firestore names vs code names
    mapping = {
        "maxSentencesPerReply": "max_sentences",
        "emojiUsage": "emoji",
        "greetingMode": "greeting_mode",
        "responseLength": "response_length",
    }
    
    for fs_key, style_key in mapping.items():
        if fs_key in ai_config:
            val = ai_config[fs_key]
            # Handle string to bool for emoji
            if style_key == "emoji" and isinstance(val, str):
                style[style_key] = (val.lower() != "none" and val.lower() != "false")
            else:
                style[style_key] = val

    # Backwards compatibility / Nested check
    shop_style = ai_config.get("communicationStyle", {})
    for key in ["max_sentences", "emoji", "greeting_mode", "use_address_terms",
                "ask_followup", "show_empathy", "upsell_enabled"]:
        if key in shop_style:
            style[key] = shop_style[key]

    return style


def _address_term(ai_config, style):
    """Derive address term from language and style."""
    if not style.get("use_address_terms", True):
        return ""
    lang = ai_config.get("responseLanguage", "Myanmar").lower()
    if lang in ("myanmar", "burmese", "mm"):
        # Look for custom address term or use default
        return ai_config.get("personalSignOff", "ရှင့်")
    return ""


def build_identity(ai_config):
    """Build the core identity block."""
    style = resolve_style(ai_config)
    bot_name = ai_config.get("botName", "Assistant")
    sys_prompt = ai_config.get("systemPrompt", "").strip()
    personal_style = ai_config.get("personalStyle", "").strip()

    preset = style.get("_preset", {})

    identity = f"မင်းက \"{bot_name}\" ပါ။ ဒီဆိုင်ရဲ့ sales ဝန်ထမ်းပါ။"
    identity += f"\nစကားပြောပုံ: {ai_config.get('formalityLevel', preset.get('formality', 'သဘာဝကျကျ'))}"
    identity += f"\nလေသံ: {preset.get('tone_description', 'ဖော်ရွေစွာ၊ ကူညီချင်စိတ်ရှိ')}"
    
    if personal_style:
        identity += f"\nကိုယ်ပိုင်ဟန်: {personal_style}"

    if sys_prompt:
        identity += f"\n\n[ဆိုင်မှ ညွှန်ကြားချက်/သတ်မှတ်ချက်]\n{sys_prompt}"

    return identity

def build_communication_rules(ai_config, intent=None):
    """Build dynamic communication rules from shop config."""
    style = resolve_style(ai_config)
    lang = ai_config.get("responseLanguage", "Myanmar")
    preset = style.get("_preset", {})
    addr = _address_term(ai_config, style)
    
    # New: Database constraints
    constraints = ai_config.get("constraints", [])
    reply_guidelines = ai_config.get("replyGuidelines", {})
    strictness = ai_config.get("strictness", "moderate")
    spell_check = ai_config.get("spellCheck", "moderate")

    # Intent-specific guidelines
    intent_cfg = INTENT_GUIDELINES.get(intent, INTENT_GUIDELINES["DEFAULT"])
    
    # Priority: Database maxSentencesPerReply > Intent Default
    max_sent = ai_config.get("maxSentencesPerReply", style.get("max_sentences", intent_cfg.get("max_sentences", 3)))
    resp_len = ai_config.get("responseLength", "detailed") # "detailed" or "concise"

    rules = []
    rules.append(f"[စကားပြောနည်း စည်းမျဉ်းများ]")
    rules.append(f"1. ဘာသာစကား: {lang} လိုပဲ အမြဲပြန်ဖြေပါ။ တခြားဘာသာမသုံးရ။")
    rules.append(f"2. လူလိုပြောပါ: မင်းက တကယ့်ဆိုင်ဝန်ထမ်းပါ။ AI, bot, virtual assistant စတဲ့စကားလုံးတွေ လုံးဝမသုံးရ။")
    rules.append(f"3. သဘာဝကျကျ: ဖုန်းမှာစာရိုက်နေတဲ့လူတစ်ယောက်လို ပြောပါ။ တရားဝင်စာတမ်းလို မပြောရ။")
    
    if resp_len == "detailed":
        rules.append(f"4. စာကြောင်းရေ: အချက်အလက်စုံလင်စွာ ပြောပြပါ။ စုစုပေါင်း စာကြောင်း {max_sent} ကြောင်းအထိ အသုံးချနိုင်ပါတယ်။ သေချာရှင်းပြပေးပါ။")
    else:
        rules.append(f"4. စာကြောင်းရေ: အတိုချုပ်ပဲ ဖြေပါ။ {max_sent} ကြောင်းထက် လုံးဝ မပိုစေရ။")

    if style.get("emoji"):
        emoji_pref = ai_config.get("emojiUsage", preset.get('emoji', 'သင့်တော်သလောက်သုံး'))
        rules.append(f"5. Emoji: {emoji_pref} ပုံစံမျိုး သုံးပေးပါ။")
    else:
        rules.append("5. Emoji: လုံးဝမသုံးရ။")

    if strictness == "high":
        rules.append("6. တိကျမှု (Strictness): ဆိုင်ရဲ့ အချက်အလက်တွေကလွဲပြီး တခြားအပြင်အကြောင်းအရာတွေကို လုံးဝမဖြေပါနဲ့။ အချက်အလက်ကိုပဲ အခြေခံပါ။")
    
    if spell_check == "high":
        rules.append("7. စာလုံးပေါင်း: စာလုံးပေါင်း သတ်ပုံကို အထူးဂရုစိုက်ပါ။ မြန်မာစာအရေးအသား မှန်ကန်ပါစေ။")

    if style.get("greeting_mode") == "never":
        rules.append("8. နှုတ်ဆက်စကား: မည်သည့်အခါမျှ မပြောရ။ တန်းဖြေ။")
    elif style.get("greeting_mode") == "once_per_session":
        rules.append("8. နှုတ်ဆက်စကား: တစ်ခါပဲ နှုတ်ဆက်။ နောက်ပိုင်း တိုက်ရိုက်ဖြေ။ 'မင်္ဂလာပါ' ထပ်မပြောရ။")
    
    if reply_guidelines.get("greeting"):
        rules.append(f"   - နှုတ်ဆက်တဲ့အခါ ဒီစကားလုံးသုံးပါ: {reply_guidelines['greeting']}")

    if style.get("ask_followup"):
        rules.append(f"9. မေးခွန်းပြန်မေး: ဖြေပြီးတိုင်း ဆက်စပ်မေးခွန်းတစ်ခု မေးပါ။")
    else:
        rules.append("9. မေးခွန်းပြန်မေး: အချက်အလက်လိုမှသာ မေးပါ။")

    if style.get("show_empathy"):
        rules.append("10. စာနာမှု: customer စိတ်ဆိုး/မပျော်ရင် 'စိတ်မကောင်းပါဘူး' ပြောပါ။")

    if style.get("upsell_enabled"):
        rules.append("11. Upsell: ပစ္စည်းကုန်ရင် အနီးစပ်ဆုံး alternative ပြောပြပါ။")

    if style.get("use_address_terms") and addr:
        rules.append(f"12. အာလုပ်သံ: '{addr}' '{addr}' လို ယဉ်ကျေးတဲ့အသုံးအနှုံးတွေ သင့်တော်သလိုထည့်ပါ။")

    rules.append(f"13. List မလုပ်ရ: customer က menu/help တောင်းမှသာ စာရင်းပြုစုပါ။")

    if reply_guidelines.get("endMessage"):
        rules.append(f"14. စကားအဆုံးသတ်: {reply_guidelines['endMessage']} လို့ အမြဲနှုတ်ဆက်ပါ။")

    if constraints:
        rules.append("\n[အထူး ကန့်သတ်ချက်များ (Constraints)]")
        for idx, con in enumerate(constraints, 1):
            rules.append(f"- {con}")

    if intent_cfg.get("rule"):
        rules.append(f"\n[ဒီ intent အတွက် အထူးညွှန်ကြားချက်]\n{intent_cfg['rule']}")

    return "\n".join(rules)

def build_faqs_block(ai_config):
    """Build FAQ list from database, limit to top 5 to save tokens."""
    faqs = ai_config.get("faqs", [])
    if not faqs:
        return ""
    
    # Only use top 5 FAQs to keep prompt slim
    limit = 5
    lines = ["[မကြာခဏမေးလေ့ရှိသော မေးခွန်းများ (FAQs)]"]
    for faq in faqs[:limit]:
        q = faq.get("question", "")
        a = faq.get("answer", "")
        if q and a:
            lines.append(f"Q: {q}\nA: {a}")
    return "\n".join(lines)

def build_knowledge_base_block(ai_config):
    """Build knowledge base block, truncate if too long."""
    kb = ai_config.get("knowledgeBase", "")
    if not kb:
        return ""
    
    # Truncate KB at 1000 chars for system prompt efficiency
    if len(kb) > 1000:
        kb = kb[:1000] + "... [truncated]"
    
    return f"[ဆိုင်၏ ဗဟုသုတ အချက်အလက်များ (Knowledge Base)]\n{kb}"

def build_fewshot_examples(ai_config, intent=None):
    """Build few-shot examples from shop config or defaults."""
    shop_examples = ai_config.get("fewShotExamples", [])
    if shop_examples:
        lines = ["[စကားပြောနမူနာများ — ဒီပုံစံအတိုင်းပြောပါ]"]
        for i, ex in enumerate(shop_examples[:5], 1):
            lines.append(f"{i}. User: {ex.get('user', '')}")
            lines.append(f"   Assistant: {ex.get('assistant', '')}")
        return "\n".join(lines)

    # Fallback: build from preset
    style = resolve_style(ai_config)
    lang = ai_config.get("responseLanguage", "Myanmar").lower()
    addr = _address_term(ai_config, style)

    examples_mm = [
        ("ဒီအင်္ကျီဘယ်လောက်လဲ", f"၂၅၀၀၀ပါ{addr}။ အရောင်လေးတွေလည်း အနီ၊အပြာရှိလို့ ကြိုက်တာလေးပြောပေးပါနော်။"),
        ("ဘယ်နှစ်ရက်ကြာလဲ", f"ရန်ကုန်ထဲဆို ၂ရက်ပါ{addr}။ နယ်ဆို ၃-၄ရက်လောက်စောင့်ရပါမယ်။"),
        ("ငွေဘယ်လိုပေးရမလဲ", f"KPay, Wave Pay နဲ့ အိမ်ရောက်ငွေချေ ရပါတယ်{addr}။ ဘယ်လိုပေးချေချင်ပါလဲ။"),
    ]
    examples_en = [
        ("How much is this shirt?", "It's 25,000 kyats. We have it in red and blue — which color do you prefer?"),
        ("How long for delivery?", "2 days within Yangon, and 3-4 days for other regions."),
        ("How can I pay?", "We accept KPay, Wave Pay, and cash on delivery. Which would you prefer?"),
    ]

    examples = examples_mm if lang in ("myanmar", "burmese", "mm") else examples_en

    lines = ["[စကားပြောနမူနာများ — ဒီပုံစံအတိုင်းပြောပါ]"]
    for i, (user, assistant) in enumerate(examples, 1):
        lines.append(f"{i}. User: {user}")
        lines.append(f"   Assistant: {assistant}")
    return "\n".join(lines)

def build_templates_block(ai_config):
    """Build reply templates section from shop config with fallback to defaults."""
    shop_templates = ai_config.get("replyTemplates", {})
    merged = {**DEFAULT_TEMPLATES, **shop_templates}

    lines = ["[ဖြေကြားပုံစံများ — အောက်ပါအခြေအနေတွေမှာ ဒီပုံစံအတိုင်းသုံးပါ]"]
    label_map = {
        "out_of_stock_mm": "ပစ္စည်းကုန်သွားရင်",
        "order_confirm_mm": "အော်ဒါ confirm ဖြစ်သွားရင်",
        "ask_name_mm": "နာမည်မေးရင်",
        "ask_phone_mm": "ဖုန်းနံပါတ်မေးရင်",
        "ask_address_mm": "လိပ်စာမေးရင်",
        "ask_payment_mm": "ငွေပေးချေမှုမေးရင်",
        "slip_received_mm": "ငွေလွှဲစာရွက်ရရင်",
        "fallback_mm": "ဘာမှမဖြေနိုင်ရင်",
    }
    for key, template in merged.items():
        label = label_map.get(key, key)
        lines.append(f"- {label}: \"{template}\"")
    return "\n".join(lines)


def build_shop_context(policies=None, delivery_info=None, payment_info=None):
    """Build dynamic context blocks from database values."""
    blocks = []
    
    if policies:
        policy_lines = ["[ဆိုင်၏ စည်းမျဉ်းများ (Policies)]"]
        if isinstance(policies, dict):
            for k, v in policies.items():
                policy_lines.append(f"- {k}: {v}")
        else:
            policy_lines.append(str(policies))
        blocks.append("\n".join(policy_lines))
        
    if delivery_info:
        deli_lines = ["[ပို့ဆောင်ရေး အချက်အလက် (Delivery)]"]
        if isinstance(delivery_info, list):
            for d in delivery_info:
                area = d.get('area', d.get('region', 'Unknown'))
                price = d.get('price', d.get('fee', 0))
                time_est = d.get('duration', d.get('time', ''))
                deli_lines.append(f"- {area}: {price} MMK ({time_est})")
        else:
            deli_lines.append(str(delivery_info))
        blocks.append("\n".join(deli_lines))
        
    if payment_info:
        pay_lines = ["[ငွေပေးချေမှု အချက်အလက် (Payment)]"]
        if isinstance(payment_info, list):
            for p in payment_info:
                p_type = p.get('type', 'Unknown')
                p_acc = p.get('accountName', p.get('name', ''))
                p_num = p.get('accountNumber', p.get('number', ''))
                pay_lines.append(f"- {p_type}: {p_acc} ({p_num})")
        else:
            pay_lines.append(str(payment_info))
        blocks.append("\n".join(pay_lines))
        
    return blocks


# ---------------------------------------------------------------------------
#  Top-level assembly (with optional Redis caching)
# ---------------------------------------------------------------------------

SYSTEM_PROMPT_CACHE_TTL = 600  # 10 minutes

# Lazy import to avoid circular dependency
def _get_redis():
    try:
        from utils.config import r
        return r
    except Exception:
        return None


def _hash_config(ai_config, intent, extra_context, shop_context):
    """Create an MD5 hash from config parts for cache key."""
    hasher = hashlib.md5()
    hasher.update(json.dumps(ai_config, sort_keys=True, default=str).encode())
    hasher.update(str(intent).encode())
    if extra_context:
        hasher.update(json.dumps(extra_context, sort_keys=True, default=str).encode())
    if shop_context:
        hasher.update(json.dumps(shop_context, sort_keys=True, default=str).encode())
    return hasher.hexdigest()


async def _cached_assemble(shop_doc_id, config_hash, ai_config, intent, extra_context, shop_context):
    """Try Redis cache first, build if miss, cache result."""
    r = _get_redis()
    cache_key = f"sys_prompt:{shop_doc_id}:{config_hash}"
    
    if r:
        try:
            cached = await r.get(cache_key)
            if cached:
                return cached
        except Exception:
            pass
    
    # Build fresh
    blocks = [
        build_identity(ai_config),
        "",
        build_communication_rules(ai_config, intent),
        "",
        build_fewshot_examples(ai_config, intent),
        "",
        build_faqs_block(ai_config),
        "",
        build_knowledge_base_block(ai_config),
        "",
        build_templates_block(ai_config),
    ]
    blocks = [b for b in blocks if b]
    
    if shop_context:
        ctx_blocks = build_shop_context(
            policies=shop_context.get('policies'),
            delivery_info=shop_context.get('delivery_info'),
            payment_info=shop_context.get('payment_info')
        )
        if ctx_blocks:
            blocks.append("")
            blocks.extend(ctx_blocks)
    
    if extra_context:
        blocks.append("")
        blocks.extend(extra_context)
    
    result = "\n".join(blocks)
    
    # Cache in Redis
    if r and result:
        try:
            await r.setex(cache_key, SYSTEM_PROMPT_CACHE_TTL, result)
            # Track for cleanup
            await r.sadd(f"sys_prompt_keys:{shop_doc_id}", cache_key)
            await r.expire(f"sys_prompt_keys:{shop_doc_id}", SYSTEM_PROMPT_CACHE_TTL + 300)
        except Exception:
            pass
    
    return result


async def assemble_system_prompt(ai_config, intent=None, extra_context=None, shop_context=None, shop_doc_id=None):
    """
    Build the full system prompt for any agent (async — always await).
    
    If shop_doc_id is provided, result is cached in Redis (TTL 10 min)
    using an MD5 hash of the input configs as cache key.
    """
    if shop_doc_id:
        config_hash = _hash_config(ai_config, intent, extra_context, shop_context)
        return await _cached_assemble(shop_doc_id, config_hash, ai_config, intent, extra_context, shop_context)
    
    # No caching — build fresh
    return _build_system_prompt_sync(ai_config, intent, extra_context, shop_context)


def _build_system_prompt_sync(ai_config, intent=None, extra_context=None, shop_context=None):
    """Synchronous prompt builder (used when no Redis/async available)."""
    blocks = [
        build_identity(ai_config),
        "",
        build_communication_rules(ai_config, intent),
        "",
        build_fewshot_examples(ai_config, intent),
        "",
        build_faqs_block(ai_config),
        "",
        build_knowledge_base_block(ai_config),
        "",
        build_templates_block(ai_config),
    ]
    blocks = [b for b in blocks if b]
    
    if shop_context:
        ctx_blocks = build_shop_context(
            policies=shop_context.get('policies'),
            delivery_info=shop_context.get('delivery_info'),
            payment_info=shop_context.get('payment_info')
        )
        if ctx_blocks:
            blocks.append("")
            blocks.extend(ctx_blocks)
    
    if extra_context:
        blocks.append("")
        blocks.extend(extra_context)
    
    return "\n".join(blocks)


def build_user_prompt(user_msg, profile=None, chat_history=None, tool_info=None):
    """
    Build the user-facing prompt (contents list for Gemini).
    
    Uses Two-Tier Memory:
    - Tier 1: Recent raw messages (last N)
    - Tier 2: Compressed summary of earlier conversation
    """
    from .conversation_memory import build_conversation_context

    parts = []

    if profile:
        ident = profile.get("identification", {})
        dynamics = profile.get("dynamics", {})
        sales = profile.get("sales_data", {})
        insights = profile.get("ai_insights", {})
        curr_order = profile.get("current_order", {})

        name = ident.get('name', '').strip()
        name_str = f" | Name: {name}" if name else ""
        segment = sales.get('segment', 'NEW')
        segment_note = ""
        if segment == "VIP":
            segment_note = " (VIP customer — treat with extra warmth and priority)"
        elif segment == "RETURNING":
            segment_note = " (Returning customer — welcome back warmly)"

        prof_str = (
            f"[Customer Profile]\n"
            f"IDENTIFICATION: Name: {name or 'Unknown'}{name_str} | Phone: {ident.get('phone', '')} | Lang: {ident.get('language', 'my')}{segment_note}\n"
            f"DYNAMICS: Intent: {dynamics.get('current_intent', 'DEFAULT')} | Order State: {dynamics.get('order_state', 'NONE')} | Msg Count: {dynamics.get('message_count', 0)}\n"
            f"SALES: Segment: {segment} | Total Spent: {sales.get('total_spent', 0)} | Total Orders: {sales.get('total_orders', 0)}\n"
            f"CURRENT SESSION: Address: {curr_order.get('address', '')} | Deli Charge: {curr_order.get('deli_charge', 0)}"
        )
        parts.append(prof_str)

    # Two-Tier Memory: Recent messages + Conversation Summary
    if chat_history:
        # Limit to last 4 lines to keep prompt size reasonable
        lines = chat_history.strip().split('\n')
        if len(lines) > 4:
            chat_history = '\n'.join(lines[-4:])
        conv_ctx = build_conversation_context(chat_history, profile or {})
        if conv_ctx:
            parts.append(conv_ctx)

    if tool_info:
        # Trim tool_info to reduce prompt size (max 1000 chars)
        trimmed_tool = tool_info[:1000] + ("..." if len(tool_info) > 1000 else "")
        parts.append(f"[Product Database]\n{trimmed_tool}")

    parts.append(f"Customer Message: {user_msg}")
    return "\n\n".join(parts)
