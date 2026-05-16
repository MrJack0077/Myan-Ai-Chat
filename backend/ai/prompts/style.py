"""
AI Prompt: Communication style presets and dynamic rules.
Maps shop aiConfig fields to prompt instructions.
"""
from typing import Optional

STYLE_PRESETS = {
    "casual": {
        "label": "Casual / ရင်းရင်းနှီးနှီး",
        "formality": "အစ်မ/ညီမ လေသံ၊ 'ရှင့်' 'နော်' သုံး",
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

DEFAULT_STYLE = {
    "preset": "friendly",
    "max_sentences": 3,
    "emoji": True,
    "greeting_mode": "once_per_session",
    "use_address_terms": True,
    "ask_followup": True,
    "show_empathy": True,
    "upsell_enabled": True,
}

INTENT_GUIDELINES = {
    "GREETING": {"max_sentences": 1, "rule": "တစ်ကြောင်းတည်းနဲ့ ကြိုဆို။ ဘာကူညီပေးရမလဲ မေး။"},
    "PRODUCT_INQUIRY": {"max_sentences": 20, "rule": "ဈေး+feature ပြောပြီး 'အရောင်လေးရော ကြိုက်လား' မေး။ LIST မလုပ်နဲ့။"},
    "START_ORDER": {"max_sentences": 0, "rule": "စာမပြန်နဲ့ — intent ကို START_ORDER လို့ပဲ set လုပ်။"},
    "ORDER": {"max_sentences": 4, "rule": "လိုအပ်တဲ့ info တစ်ခုချင်းမေး။"},
    "DELIVERY": {"max_sentences": 2, "rule": "ပို့ဆောင်ချိန်/ဈေး အတိအကျဖြေ။"},
    "PAYMENT": {"max_sentences": 2, "rule": "ရတဲ့နည်းလမ်းတွေပြော။ ဘယ်လိုပေးချေချင်လဲမေး။"},
    "POLICY_FAQ": {"max_sentences": 5, "rule": "policy အတိုင်း ရှင်းရှင်းလင်းလင်းဖြေ။"},
    "COMPLAINT_OR_HUMAN": {"max_sentences": 2, "rule": "တောင်းပန်စကားပြော၊ human နဲ့ချိတ်ပေးမယ်။"},
    "OUT_OF_DOMAIN": {"max_sentences": 1, "rule": "ယဉ်ကျေးစွာငြင်း၊ ဆိုင်အကြောင်းပဲဖြေနိုင်ကြောင်းပြော။"},
    "DEFAULT": {"max_sentences": 20, "rule": "သဘာဝကျကျ အတိုချုပ်ဖြေ။"},
}


def resolve_style(ai_config: dict) -> dict:
    """Merge preset + shop granular overrides into final style dict."""
    style = dict(DEFAULT_STYLE)
    preset_name = ai_config.get("formalityLevel",
                                ai_config.get("communicationStyle", {}).get("preset", style["preset"]))
    preset = STYLE_PRESETS.get(preset_name, STYLE_PRESETS["friendly"])
    style["_preset"] = preset

    mapping = {
        "maxSentencesPerReply": "max_sentences",
        "emojiUsage": "emoji",
        "greetingMode": "greeting_mode",
        "responseLength": "response_length",
    }
    for fs_key, style_key in mapping.items():
        if fs_key in ai_config:
            val = ai_config[fs_key]
            if style_key == "emoji" and isinstance(val, str):
                style[style_key] = (val.lower() not in ("none", "false"))
            else:
                style[style_key] = val

    shop_style = ai_config.get("communicationStyle", {})
    for key in ["max_sentences", "emoji", "greeting_mode", "use_address_terms",
                "ask_followup", "show_empathy", "upsell_enabled"]:
        if key in shop_style:
            style[key] = shop_style[key]

    return style


def _address_term(ai_config: dict, style: dict) -> str:
    """Derive address term from language and style."""
    if not style.get("use_address_terms", True):
        return ""
    lang = ai_config.get("responseLanguage", "Myanmar").lower()
    if lang in ("myanmar", "burmese", "mm"):
        return ai_config.get("personalSignOff", "ရှင့်")
    return ""


def build_communication_rules(ai_config: dict, intent: Optional[str] = None) -> str:
    """Build dynamic communication rules block for the system prompt."""
    style = resolve_style(ai_config)
    lang = ai_config.get("responseLanguage", "Myanmar")
    preset = style.get("_preset", {})

    intent_cfg = INTENT_GUIDELINES.get(intent, INTENT_GUIDELINES["DEFAULT"])
    max_sent = ai_config.get("maxSentencesPerReply",
                             style.get("max_sentences", intent_cfg.get("max_sentences", 3)))
    resp_len = ai_config.get("responseLength", "detailed")
    strictness = ai_config.get("strictness", "moderate")
    spell_check = ai_config.get("spellCheck", "moderate")

    rules = [f"[စကားပြောနည်း စည်းမျဉ်းများ]"]
    rules.append(f"1. ဘာသာစကား: {lang} လိုပဲ အမြဲပြန်ဖြေ။ တခြားဘာသာမသုံးရ။")
    rules.append("2. လူလိုပြော: မင်းက တကယ့်ဆိုင်ဝန်ထမ်း။ AI, bot ဆိုတဲ့စကား လုံးဝမသုံးရ။")
    rules.append("3. သဘာဝကျကျ: ဖုန်းမှာစာရိုက်နေသူလို ပြော။")

    if resp_len == "detailed":
        rules.append(f"4. စာကြောင်းရေ: အချက်အလက်စုံလင်စွာ ပြော။ စုစုပေါင်း {max_sent} ကြောင်းအထိ။")
    else:
        rules.append(f"4. စာကြောင်းရေ: အတိုချုပ်။ {max_sent} ကြောင်းထက်မပိုရ။")

    if style.get("emoji"):
        rules.append(f"5. Emoji: {preset.get('emoji', 'သင့်တော်သလောက်သုံး')}")
    else:
        rules.append("5. Emoji: လုံးဝမသုံးရ။")

    if strictness == "high":
        rules.append("6. တိကျမှု: ဆိုင်အချက်အလက်ကလွဲပြီး တခြားအကြောင်း လုံးဝမဖြေရ။")

    if spell_check == "high":
        rules.append("7. စာလုံးပေါင်း: မြန်မာစာလုံးပေါင်း သတ်ပုံကျမ်းအတိုင်း တိကျစွာရေး။")

    return "\n".join(rules)
