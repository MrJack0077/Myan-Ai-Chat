"""
Smart Photo Analyzer — pre-process images before they reach AI agents.

Detects payment slips, matches product photos against shop inventory,
and adds rich context to help AI give better responses.
"""
import re
from utils import db


def detect_payment_slip(user_msg: str, order_state: str) -> tuple[bool, str]:
    """Check if the message context suggests this is a payment slip."""
    msg_lower = user_msg.lower() if user_msg else ""
    
    slip_keywords = [
        'slip', 'payment', 'paid', 'transfer', 'sent', 'ပို့', 'လွှဲ',
        'ငွေ', 'ပေးငွေ', 'ပို့ပြီး', 'လွှဲပြီး', 'ငွေလွှဲ',
        'screenshot', 'receipt', 'ဖြတ်ပိုင်း', 'kpay', 'wave', 'k pay',
    ]
    
    is_slip = any(kw in msg_lower for kw in slip_keywords)
    
    if is_slip:
        return True, "🔍 Detected: Payment Slip Screenshot"
    
    # If order state is waiting for slip, assume it's a slip
    if order_state in ("WAITING_FOR_SLIP", "SUMMARY_SENT"):
        return True, "🔍 Detected: Payment Slip (waiting state)"
    
    return False, ""


async def match_product_photo(shop_id: str, user_msg: str) -> tuple[bool, str]:
    """
    Try to match a product photo against shop inventory using keywords in message.
    Returns (matched: bool, context: str).
    """
    if not db or not shop_id:
        return False, ""
    
    try:
        # Extract product keywords from user message
        msg_lower = (user_msg or "").lower()
        keywords = re.findall(r'[\u1000-\u109F\w]{2,}', msg_lower)
        
        if not keywords:
            return False, ""
        
        # Search for matching products in shop
        items_ref = db.collection("shops").document(shop_id).collection("items")
        docs = items_ref.limit(10).get()
        
        best_match = None
        best_score = 0
        
        for doc in docs:
            data = doc.to_dict()
            name = (data.get("name") or "").lower()
            desc = (data.get("description") or "").lower()
            keywords_str = (data.get("ai_keywords") or "").lower()
            combined = f"{name} {desc} {keywords_str}"
            
            # Score based on keyword overlap
            score = sum(1 for kw in keywords if kw in combined)
            if score > best_score:
                best_score = score
                best_match = data
        
        if best_match and best_score >= 2:
            ctx = (
                f"🔍 Product Photo Match: {best_match.get('name', 'Unknown')}\n"
                f"   Price: {best_match.get('price', 'N/A')} | "
                f"Stock: {best_match.get('stock_quantity', 0)} | "
                f"Status: {'Available' if best_match.get('is_available') else 'Out of Stock'}"
            )
            return True, ctx
        
    except Exception as e:
        print(f"⚠️ Photo match error: {e}", flush=True)
    
    return False, ""


async def analyze_photo_context(shop_id: str, user_msg: str, order_state: str, attachments_count: int) -> str:
    """
    Pre-analyze photo attachments and return context string for AI prompt.
    
    Returns a context hint that helps the AI respond smarter:
    - Payment slip → tells AI to verify payment details
    - Product photo → tells AI matched product info
    - Unrelated → tells AI to politely redirect
    """
    if attachments_count == 0:
        return ""
    
    hints = []
    
    # Check for payment slip
    is_slip, slip_hint = detect_payment_slip(user_msg, order_state)
    if is_slip:
        hints.append(slip_hint)
        hints.append("💡 AI: Verify payment — check amount, account, and confirm order.")
    else:
        # Try to match product
        matched, product_hint = await match_product_photo(shop_id, user_msg)
        if matched:
            hints.append(product_hint)
            hints.append("💡 AI: Show this product info naturally. Ask if they want to order.")
        else:
            hints.append("🔍 Unknown photo — could be product, could be unrelated.")
    
    return "\n".join(hints) if hints else ""
