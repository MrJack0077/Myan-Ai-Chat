"""
Orders: Data extraction from natural language.
Pattern-based extraction of phone, name, address, payment, items, quantity.
"""
import re


def extract_order_data(text: str) -> dict:
    """Extract order fields from Myanmar/English free text."""
    return {
        "phone": extract_phone(text),
        "name": extract_name(text),
        "address": extract_address(text),
        "payment_method": extract_payment(text),
        "items": extract_items_from_tool_info(text),
        "quantity": extract_quantity(text),
    }


def extract_phone(text: str) -> str:
    """Extract Myanmar phone number."""
    match = re.search(r'(09\d{7,10}|\+?959\d{7,9})', text)
    return match.group(1) if match else ""


def extract_name(text: str) -> str:
    """Extract a person's name from message text."""
    # Look for name patterns: "နာမည် XXXX", "Name: XXXX", "ကျွန်တော် XXXX"
    patterns = [
        r'(?:နာမည်|name|အမည်)\s*[:\-]?\s*([က-အA-Za-z0-9\s]{2,20})',
        r'(?:ကျွန်တော်|ကျွန်မ|ကျနော်)\s+([က-အ\s]{2,20})',
        r'(?:name is|i\'?m|this is)\s+([A-Za-z\s]{2,20})',
    ]
    for pat in patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            name = match.group(1).strip().rstrip("ပါ။ရှင့်ဗျားဗျရဲ့ကိုဘဲလေးပေါ့နော်")
            if len(name) >= 2:
                return name
    return ""


def extract_address(text: str) -> str:
    """Extract delivery address from message text."""
    patterns = [
        r'(?:လိပ်စာ|address|နေရပ်|မြို့|ရပ်ကွက်|လမ်း|တိုက်|အခန်း)\s*[:\-]?\s*([^\n]{3,100})',
        r'(?:send to|deliver to|ship to)\s+([^\n]{3,100})',
    ]
    for pat in patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            addr = match.group(1).strip().rstrip("ပါ။ရှင့်ဗျားဗျ")
            if len(addr) >= 5:
                return addr
    return ""


def extract_payment(text: str) -> str:
    """Extract payment method preference."""
    text_lower = text.lower()
    methods = {
        "kbz pay": "KBZ Pay",
        "kpay": "KBZ Pay",
        "wave pay": "Wave Pay",
        "wave": "Wave Pay",
        "cod": "COD",
        "cash on delivery": "COD",
        "cash": "Cash",
        "ငွေလွှဲ": "Bank Transfer",
        "ဘဏ်": "Bank Transfer",
        "အိမ်ရောက်ငွေချေ": "COD",
    }
    for keyword, method in methods.items():
        if keyword in text_lower:
            return method
    return ""


def extract_items_from_tool_info(text: str) -> list[str]:
    """Extract product items mentioned in text."""
    # Product name patterns: "Camera E1", "iPhone 14 Pro", "Samsung S24"
    product_pattern = r'(?:Camera|IPhone|Samsung|Xiaomi|Oppo|Vivo|Apple\s*Watch|iPad|AirPods|JBL|Aqara)[\w\s\d\-]*\w'
    matches = re.findall(product_pattern, text, re.IGNORECASE)
    return list(dict.fromkeys(matches))  # dedupe preserving order


def extract_quantity(text: str) -> int:
    """Extract numeric quantity from text."""
    patterns = [
        r'(\d+)\s*(?:ခု|လုံး|ဘူး|items?|pcs?|units?)',
        r'(?:quantity|qty|အရေအတွက်)\s*[:\-]?\s*(\d+)',
    ]
    for pat in patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            return int(match.group(1))
    return 1


def get_order_summary(extracted: dict) -> str:
    """Format extracted order data as a human-readable summary."""
    lines = []
    if extracted.get("name"):
        lines.append(f"နာမည်: {extracted['name']}")
    if extracted.get("phone"):
        lines.append(f"ဖုန်း: {extracted['phone']}")
    if extracted.get("address"):
        lines.append(f"လိပ်စာ: {extracted['address']}")
    if extracted.get("items"):
        qty = extracted.get("quantity", 1)
        lines.append(f"ပစ္စည်း: {', '.join(extracted['items'])} (x{qty})")
    if extracted.get("payment_method"):
        lines.append(f"ငွေပေးချေမှု: {extracted['payment_method']}")
    return "\n".join(lines) if lines else "No details"
