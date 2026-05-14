"""
Professional Order Data Extractor — robust keyword + pattern-based extraction.
Handles Myanmar names, phones, addresses, items, and payment methods.
"""
import re


def extract_order_data(user_msg: str, tool_info: str = "") -> dict:
    """
    Extract order-related data from user message.
    Returns dict with: name, phone, address, payment_method, items, total_price
    """
    data = {}
    
    # ── PHONE ──
    phone = extract_phone(user_msg)
    if phone:
        data["phone"] = phone
    
    # ── NAME ──
    name = extract_name(user_msg)
    if name:
        data["name"] = name
    
    # ── ADDRESS ──
    address = extract_address(user_msg)
    if address:
        data["address"] = address
    
    # ── PAYMENT METHOD ──
    payment = extract_payment(user_msg)
    if payment:
        data["payment_method"] = payment
    
    # ── ITEMS & PRICE from tool_info ──
    if tool_info:
        items, price = extract_items_from_tool_info(tool_info)
        if items:
            data["items"] = items
        if price:
            data["total_price"] = price
    
    # ── QUANTITY ──
    qty = extract_quantity(user_msg)
    if qty:
        data["item_qty"] = qty
    
    return data


def extract_phone(text: str) -> str:
    """Extract Myanmar phone number."""
    # Clean format: 09xxxxxxxx, +959xxxxxxxx, 09-xxx-xxx
    patterns = [
        r'(09\d{7,9})',
        r'(\+?959\d{7,9})',
        r'(09[\s\-]\d{3}[\s\-]\d{3,5})',
    ]
    for pat in patterns:
        m = re.search(pat, text)
        if m:
            phone = re.sub(r'[\s\-]', '', m.group(1))
            if 9 <= len(phone) <= 12:
                return phone
    return ""


def extract_name(text: str) -> str:
    """Extract Myanmar/English customer name."""
    patterns = [
        # "name is X" / "နာမည်က X"
        r'(?:name|နာမည်|အမည်)\s*(?:is|က|ကတော့|လေး)?\s*([A-Za-z\u1000-\u109F]{2,25})',
        # Honorifics: ကိုX, မောင်X, မမX, ဦးX, ဒေါ်X
        r'(?:ကို|မောင်|မမ|ဦး|ဒေါ်|ကိုကို)\s*([A-Za-z\u1000-\u109F]{2,20})',
        # "I'm X" / "ကျွန်တော် X ပါ"
        r"(?:i'?m|ကျွန်တော်|ကျွန်မ|ကျုပ်)\s+([A-Za-z\u1000-\u109F]{2,20})",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            name = m.group(1).strip()
            name = re.sub(r"['\"]+$", '', name)  # Clean trailing quotes
            name = re.sub(r'\s+', ' ', name).strip()
            # Filter out non-name Myanmar phrases
            non_names = ['ဝယ်ယူ', 'မှာယူ', 'အော်ဒါ', 'တင်ပေး', 'ပို့ဆောင်', 'ငွေပေး', 
                        'ပေးချေ', 'ကျေးဇူး', 'ကြိုဆို', 'မင်္ဂလာ', 'ဆက်သွယ်',
                        'ရန်', 'မည်', 'ရှင့်', 'ခင်ဗျ', 'တောင်းပန်']
            if any(nn in name for nn in non_names) or len(name) < 2 or name.isdigit():
                continue
            return name
    return ""


def extract_address(text: str) -> str:
    """Extract Myanmar address from text."""
    # Look for address markers first
    patterns = [
        # "No.123 Street" / "အမှတ် ၁၂၃"
        r'(?:No\.?\s*\d+[A-Za-z]?\s*,?\s*|အမှတ်\s*\d+\s*,?\s*)([A-Za-z0-9\u1000-\u109F\s,]{5,50}?)(?:$|\n|၊|\.)',
        # City names with context
        r'((?:ရန်ကုန်|မန္တလေး|နေပြည်တော်|yangon|mandalay|dagon|တာမွေ|ဗဟန်း|လှိုင်|သာကေ|မရမ်း|ကမာရွတ်|စမ်းချောင်း|ဒဂုံ|အင်းစိန်|မြောက်ဥက္ကလာ|တောင်ဥက္ကလာ)[\w\u1000-\u109F\s,/\-]{5,40})',
        # Full address line (Street/District pattern)
        r'([\w\u1000-\u109F\s,/\-]{10,60}(?:street|road|လမ်း|ရပ်ကွက်|မြို့နယ်|township|city))',
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            addr = m.group(1).strip() if m.lastindex else m.group(0).strip()
            # Don't capture AI-generated text
            if any(ai_word in addr.lower() for ai_word in ['ပို့ဆောင်', 'မှာယူ', 'ငွေပေး', 'ကျေးဇူး', 'deliver']):
                continue
            if 5 <= len(addr) <= 80:
                # Split by newline — take the last line (usually the real address)
                lines = addr.split('\n')
                addr = lines[-1].strip() if len(lines) > 1 else addr
                # If still contains AI text, try to extract just the street part
                if len(addr) > 60:
                    # Try to find street number pattern
                    street_m = re.search(r'(?:no|No|No\.|အမှတ်)[\s.]*\d+[\s,]*([\w\s\u1000-\u109F]{5,40})', addr)
                    if street_m:
                        addr = f"No. {street_m.group(0).strip()}" if not addr.lower().startswith('no') else street_m.group(0).strip()
                return addr[:80]
    return ""


def extract_payment(text: str) -> str:
    """Extract payment method from text."""
    text_lower = text.lower()
    payment_map = {
        'kpay': 'KPay', 'k pay': 'KPay', 'kbz pay': 'KPay',
        'wave': 'WavePay', 'wave pay': 'WavePay', 'wavepay': 'WavePay',
        'kbz': 'KBZ Bank', 'kbz bank': 'KBZ Bank',
        'cod': 'Cash on Delivery', 'cash': 'Cash',
        'aya': 'AYA Pay', 'aya pay': 'AYA Pay',
        'ငွေချေ': 'Cash', 'ငွေပေး': 'Cash',
    }
    for key, value in payment_map.items():
        if key in text_lower:
            return value
    return ""


def extract_items_from_tool_info(tool_info: str) -> tuple:
    """
    Extract product name and price from tool_info.
    Returns (items_list, total_price).
    """
    items = []
    total_price = 0
    
    lines = tool_info.strip().split('\n')
    for line in lines[:5]:
        line = line.strip()
        if not line:
            continue
            
        # Look for price indicators
        if any(kw in line.lower() for kw in ['price', 'mmk', 'kyat', 'ကျပ်', '$', 'ks']):
            # Extract name — first segment before pipe or price
            # Split by common delimiters
            name = re.split(r'\s*\|\s*|\s{3,}', line)[0].strip()
            name = re.sub(r'^[📦🛒🛍️\s🔥💡⭐✨]+', '', name)
            name = re.sub(r'^(Name|Product|Item)[\s:：]*', '', name, flags=re.IGNORECASE)
            # Take only the product name part (before "Price:" or "|")
            name = re.split(r'\s*(?:Price|MMK|Kyat|ကျပ်)\s*[:：]', name, flags=re.IGNORECASE)[0].strip()
            name = re.sub(r'\s{2,}', ' ', name).strip()
            
            if name and len(name) >= 3 and name.lower() not in ('name', 'product', 'item', 'none'):
                items.append(name)
            
            # Extract price
            price_m = re.search(r'(\d[\d,]*)\s*(?:MMK|kyat|ကျပ်|\$|ks)', line, re.IGNORECASE)
            if price_m:
                try:
                    total_price = int(price_m.group(1).replace(',', ''))
                except ValueError:
                    pass
            break
    
    return items, total_price


def get_order_summary(prof: dict) -> str:
    """Generate a human-readable order summary."""
    ident = prof.get("identification", {})
    curr = prof.get("current_order", {})
    
    parts = []
    if ident.get("name"):
        parts.append(f"👤 {ident['name']}")
    if ident.get("phone"):
        parts.append(f"📞 {ident['phone']}")
    if curr.get("address"):
        parts.append(f"📍 {curr['address']}")
    
    items = curr.get("items", [])
    qty = curr.get("item_qty", 1)
    if items:
        item_str = ', '.join(items)
        if qty > 1:
            item_str += f" x{qty}"
        parts.append(f"📦 {item_str}")
    
    item_price = curr.get("total_price", 0)
    deli = curr.get("deli_charge", 0)
    if item_price:
        parts.append(f"💲 Items: {item_price:,} MMK")
    if deli:
        parts.append(f"🚚 Delivery: {deli:,} MMK")
    if item_price or deli:
        parts.append(f"💰 Total: {item_price + deli:,} MMK")
    
    if curr.get("payment_method"):
        parts.append(f"💳 {curr['payment_method']}")
    
    return "\n".join(parts) if parts else "No order data yet"


def extract_quantity(text: str) -> int:
    """Extract item quantity from user message."""
    patterns = [
        r'(\d+)\s*(?:လုံး|ခု|unit|pcs|pieces|items|qty)',
        r'(?:qty|quantity|amount)[\s:：]*(\d+)',
        r'(\d+)\s*x\s*',
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            qty = int(m.group(1))
            if 1 <= qty <= 100:
                return qty
    return 1  # Default to 1
