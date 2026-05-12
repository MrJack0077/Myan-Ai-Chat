"""
Fast keyword-based intent classifier — rule-based, no AI call (~0ms).

Used by processor.py to decide whether to skip the Automation Agent.
"""
import re


# Keyword → (intent, skip_automation)
# skip_automation=True means the intent is clear enough to skip the AI classifier
KEYWORD_INTENTS = [
    # ── PRODUCT_INQUIRY ──
    (r'\b(ဈေး|ဘယ်လောက်|စျေး|ဘယ်လောက်လဲ|ဈေးနှုန်း|price|how much|cost|how many kyat)\b', 'PRODUCT_INQUIRY', True),
    (r'\b(အရောင်|ဆိုဒ်|size|color|colour|အနီ|အပြာ|အစိမ်း|အနက်|အဖြူ)\b', 'PRODUCT_INQUIRY', True),
    (r'\b(ရှိလား|ရလား|available|in stock|stock|န်းလား)\b', 'PRODUCT_INQUIRY', True),
    (r'\b(ပစ္စည်း|product|item|ပစ္စည်းတွေ|products|items)\b', 'PRODUCT_INQUIRY', True),

    # ── DELIVERY ──
    (r'\b(ပို့|ပို့ဆောင်|delivery|shipping|ရက်|ကြာ|duration|ဘယ်နှစ်ရက်|ရောက်|deliver|delivered)\b', 'DELIVERY', True),

    # ── PAYMENT ──
    (r'\b(ငွေချေ|ငွေပေး|payment|pay|kpay|wave pay|cod|cash|ဘယ်လိုပေး|ဘယ်လိုပေးရ)\b', 'PAYMENT', True),

    # ── START_ORDER ──
    (r'\b(ယူမယ်|ဝယ်မယ်|မှာမယ်|order|buy|purchase|တင်ပေး|မှာပေး|လိုချင်|ကြိုက်)\b', 'START_ORDER', False),

    # ── SERVICE ──
    (r'\b(ဝန်ဆောင်မှု|service|booking|appointment|ရက်ချိန်း|ကြိုချိန်း|reserve|schedule|ပြင်ဆင်|ပြုပြင်|repair|maintenance)\b', 'SERVICE', True),

    # ── POLICY ──
    (r'\b(return|refund|exchange|ပြန်|လဲ|အာမခံ|warranty|guarantee|policy|စည်းမျဉ်း)\b', 'POLICY_FAQ', True),

    # ── COMPLAINT ──
    (r'\b(မကောင်း|ပျက်စီး|damaged|broken|wrong|မှား|တိုင်ချင်|complain|စိတ်တို|မကျေနပ်)\b', 'COMPLAINT_OR_HUMAN', False),

    # ── GREETING ──
    (r'^(hi|hello|hey|မင်္ဂလာပါ|ဟိုင်း|နေကောင်း|good morning|good afternoon|good evening)[\s!]*$', 'GREETING', True),
    (r'^(thanks|thank you|ကျေးဇူး|ကျေးဇူးပါ|ok|okay|ဟုတ်)[\s!]*$', 'GREETING', True),
]

COMPLEX_KEYWORDS = [
    # These override skip — always need automation agent
    r'\b(cancel|ဖျက်|change|ပြောင်း|modify|edit|update order|wrong order)\b',
    r'\b(complain|တိုင်|စိတ်တို|မကျေနပ်|ပြောချင်|ဆက်သွယ်)\b',
    r'\b(human|person|လူ|admin|staff|ဆက်သွယ်ပေး|ချိတ်ပေး)\b',
]


def fast_intent_classify(user_msg: str, order_state: str = "NONE"):
    """
    Rule-based intent classifier. Returns (intent, skip_automation).

    Args:
        user_msg: The customer's message text.
        order_state: Current order flow state (NONE, COLLECTING, WAITING_FOR_SLIP, etc.)

    Returns:
        (intent, skip_automation) tuple.
        - intent: classified intent string or None if unclear
        - skip_automation: True if we can skip the Automation Agent AI call

    If order_state is active (COLLECTING/WAITING_FOR_SLIP/SUMMARY_SENT),
    we NEVER skip automation because order flow needs careful handling.
    """
    if not user_msg:
        return None, False

    # If customer is in an active order flow, always use automation agent (safety first)
    if order_state not in ("NONE",):
        return None, False

    msg_lower = user_msg.lower().strip()
    msg_original = user_msg.strip()

    # If message is very short and simple, likely a greeting/acknowledgment
    if len(msg_original) <= 15 and not any(c in msg_original for c in '?？'):
        for pattern, intent, skip in KEYWORD_INTENTS:
            if re.search(pattern, msg_lower):
                return intent, skip
        return "GREETING", True  # short message = probably greeting

    # Check complex keywords first (always need automation)
    for pattern in COMPLEX_KEYWORDS:
        if re.search(pattern, msg_lower):
            return None, False  # let automation agent handle

    # Check keyword intents
    matched_intent = None
    for pattern, intent, skip in KEYWORD_INTENTS:
        if re.search(pattern, msg_lower):
            if skip:
                # High confidence simple intent → skip automation
                return intent, True
            else:
                # Medium confidence → remember but keep checking
                if matched_intent is None:
                    matched_intent = intent

    if matched_intent:
        return matched_intent, False  # intent found but need AI confirmation

    # Ambiguous or complex → need full automation agent
    return None, False
