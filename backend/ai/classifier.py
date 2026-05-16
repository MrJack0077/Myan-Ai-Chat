"""
AI: Fast intent classification.
Keyword-based fast classifier + AI-based classifier for ambiguous messages.
"""
from typing import Optional

KEYWORD_INTENTS = {
    "GREETING": ["hello", "hi", "hey", "good morning", "good evening", "မင်္ဂလာပါ",
                  "ဟဲလို", "ဟိုင်း", "နေကောင်းလား", "ထမင်းစားပြီးပြီလား"],
    "PRODUCT_INQUIRY": ["price", "how much", "available", "color", "size", "stock",
                         "camera", "phone", "iphone", "samsung", "xiaomi", "oppo", "vivo",
                         "ဈေး", "ဘယ်လောက်", "ရလား", "ရှိလား", "ရတာလား",
                         "ပဲရှိလား", "ပဲရလား", "ပဲရှိတာလား", "ပဲရတာလား",
                         "အရောင်", "ဆိုဒ်", "ပစ္စည်း", "ဖုန်း"],
    "START_ORDER": ["order", "buy", "want", "take", "purchase",
                     "ယူမယ်", "ဝယ်မယ်", "မှာမယ်", "လိုချင်တယ်", "အော်ဒါ"],
    "DELIVERY": ["delivery", "shipping", "deliver", "how long",
                  "ပို့", "ရောက်ချိန်", "ပို့ဆောင်ခ", "မြို့"],
    "PAYMENT": ["payment", "pay", "kpay", "kbz", "wave pay", "cod",
                 "ငွေပေးချေ", "ငွေလွှဲ", "ဘေလ်လေး"],
    "POLICY_FAQ": ["return", "refund", "warranty", "exchange",
                    "ပြန်", "လဲ", "အာမခံ"],
}


def fast_intent_classify(text: str) -> Optional[str]:
    """
    Rule-based fast intent classification.
    Returns intent string or None if ambiguous.
    """
    if not text:
        return None

    text_lower = text.lower().strip()
    if len(text_lower) <= 2:
        return "GREETING" if text_lower in ("hi", "ok", "yes", "no", "ဟုတ်") else None

    scored = {}
    for intent, keywords in KEYWORD_INTENTS.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        if score > 0:
            scored[intent] = score

    if not scored:
        # Fallback: short unknown message → likely greeting
        return "GREETING" if len(text_lower.split()) <= 3 else None

    best = max(scored, key=scored.get)
    if scored[best] >= 2 or len(scored) == 1:
        return best

    return None  # ambiguous — let AI decide
