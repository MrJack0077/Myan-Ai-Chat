"""
AI Agent: JSON output normalization.
Handles various AI response formats (nested, plural, alternate field names).
Separated from agent.py to keep files under 250 lines.
"""


def normalize_ai_output(data: dict) -> dict:
    """Normalize various AI JSON output formats into a standard shape."""
    # Nested response field
    if isinstance(data.get("response"), dict):
        inner = data["response"]
        data["reply"] = inner.get("text") or inner.get("reply") or inner.get("message") or ""
        if "intent" in inner and not data.get("intent"):
            data["intent"] = inner["intent"]
    elif isinstance(data.get("response"), str):
        data["reply"] = data.pop("response")

    # dialog.message format
    if isinstance(data.get("dialog"), dict):
        dial = data["dialog"]
        if dial.get("message") and not data.get("reply"):
            data["reply"] = dial["message"]
        if dial.get("intent") and not data.get("intent"):
            data["intent"] = dial["intent"]
        extra = dial.get("extra_info", {})
        if isinstance(extra, dict):
            extr = data.setdefault("extracted", {})
            for key in ("name", "phone", "address"):
                if extra.get(key) and not extr.get(key):
                    extr[key] = extra[key]

    # Plural→Singular normalization
    if not data.get("reply") and isinstance(data.get("replies"), list) and data["replies"]:
        data["reply"] = data["replies"][0].get("reply", "")
    if not data.get("intent") and isinstance(data.get("intents"), list) and data["intents"]:
        data["intent"] = data["intents"][0].get("intent", "")

    # Alternate field names
    for alt in ("question", "answer", "message"):
        if alt in data and not data.get("reply"):
            data["reply"] = data.pop(alt)

    # parameters wrapping (AI sometimes wraps data in 'parameters')
    params = data.get("parameters", {})
    if isinstance(params, dict) and params:
        extr = data.setdefault("extracted", {})
        if isinstance(params.get("items"), list):
            items = [i.get("name", str(i)) if isinstance(i, dict) else str(i)
                     for i in params["items"]]
            if items and not extr.get("items"):
                extr["items"] = items
        cust = params.get("customer", {})
        if isinstance(cust, dict):
            for key in ("name", "phone", "address"):
                if cust.get(key) and not extr.get(key):
                    extr[key] = cust[key]
        for key in ("total_price", "payment_method"):
            if params.get(key) and not extr.get(key):
                extr[key] = params[key]
        if isinstance(params.get("buttons"), list) and not extr.get("buttons"):
            extr["buttons"] = params["buttons"]

    return data
