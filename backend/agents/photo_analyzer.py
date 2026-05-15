"""Smart Photo Analyzer — pre-process images before they reach AI agents."""
import re
import asyncio
from utils import db

# Vertex AI Vision via google-genai SDK
try:
    from google import genai
    from utils.config import genai_client, FAST_MODEL_NAME
    _VISION_AVAILABLE = True
except Exception:
    _VISION_AVAILABLE = False


def detect_payment_slip(user_msg: str, order_state: str) -> tuple[bool, str]:
    """Check if the message context suggests this is a payment slip."""
    msg_lower = user_msg.lower() if user_msg else ""
    
    slip_keywords = [
        'slip', 'payment', 'paid', 'transfer', 'sent', 'ပို့', 'လွှဲ',
        'ငွေ', 'ပေးငွေ', 'ပို့ပြီး', 'လွှဲပြီး', 'ငွေလွှဲ', 'ပို့လိုက်',
        'screenshot', 'receipt', 'ဖြတ်ပိုင်း', 'kpay', 'wave', 'k pay',
    ]
    
    is_slip = any(kw in msg_lower for kw in slip_keywords)
    
    if is_slip:
        return True, "🔍 Detected: Payment Slip Screenshot"
    
    if order_state in ("WAITING_FOR_SLIP", "SUMMARY_SENT"):
        return True, "🔍 Detected: Payment Slip (waiting state)"
    
    return False, ""


async def analyze_image_with_ai(image_base64: str, mime_type: str = "image/jpeg") -> str:
    """Use Gemini Vision to analyze image content. Returns description or empty string."""
    if not _VISION_AVAILABLE:
        return ""
    
    try:
        vision_config = genai.types.GenerateContentConfig(
            temperature=0.1,
        )
        res = await asyncio.wait_for(
            genai_client.aio.models.generate_content(
                model=FAST_MODEL_NAME,
                contents=[prompt, genai.types.Part.from_bytes(data=image_base64, mime_type=mime_type)],
                config=vision_config,
            ),
            timeout=8.0
        )
        return res.text.strip() if res and res.text else ""
    except asyncio.TimeoutError:
        print("⏰ AI vision timeout — falling back to keyword analysis", flush=True)
        return ""
    except Exception as e:
        print(f"⚠️ AI vision error: {e}", flush=True)
        return ""


async def match_product_photo(shop_id: str, user_msg: str, ai_vision_desc: str = "") -> tuple[bool, str]:
    """
    Match a product photo against shop inventory.
    Uses AI vision description first, falls back to keyword matching.
    """
    if not db or not shop_id:
        return False, ""
    
    try:
        # Build search text from AI vision + user message
        msg_lower = (user_msg or "").lower()
        vision_lower = (ai_vision_desc or "").lower()
        combined = f"{msg_lower} {vision_lower}"
        
        keywords = re.findall(r'[\u1000-\u109F\w]{2,}', combined)
        if not keywords:
            return False, ""
        
        items_ref = db.collection("shops").document(shop_id).collection("items")
        docs = items_ref.limit(10).get()
        
        best_match = None
        best_score = 0
        
        for doc in docs:
            data = doc.to_dict()
            name = (data.get("name") or "").lower()
            desc = (data.get("description") or "").lower()
            ai_keys = (data.get("ai_keywords") or "").lower()
            brand = (data.get("brand") or "").lower()
            combined_text = f"{name} {desc} {ai_keys} {brand}"
            
            score = sum(1 for kw in keywords if kw in combined_text)
            if score > best_score:
                best_score = score
                best_match = data
        
        if best_match and best_score >= 1:  # Lower threshold — AI vision helps
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


async def analyze_photo_context(shop_id: str, user_msg: str, order_state: str, attachments_count: int, media_parts: list = None) -> str:
    """
    Pre-analyze photo attachments and return context string for AI prompt.
    """
    if attachments_count == 0:
        return ""
    
    hints = []
    
    # Try AI Vision first for image analysis
    ai_desc = ""
    if _VISION_AVAILABLE and media_parts:
        for part in media_parts[:1]:  # Analyze first image only (save time)
            if hasattr(part, 'get') and 'image' in str(part.get('mime_type', '')):
                img_data = part.get('data', '') if isinstance(part, dict) else getattr(part, 'data', '')
                if img_data:
                    ai_desc = await analyze_image_with_ai(img_data, part.get('mime_type', 'image/jpeg') if isinstance(part, dict) else 'image/jpeg')
                    if ai_desc:
                        hints.append(f"🤖 AI Vision: {ai_desc[:200]}")
                    break
    
    # Check for payment slip
    is_slip, slip_hint = detect_payment_slip(user_msg, order_state)
    if is_slip:
        hints.append(slip_hint)
        hints.append("💡 AI: Verify payment — check amount, account, and confirm order.")
    else:
        # Try product matching
        matched, product_hint = await match_product_photo(shop_id, user_msg, ai_desc)
        if matched:
            hints.append(product_hint)
            hints.append("💡 AI: Show this product info naturally. Ask if they want to order.")
        elif not ai_desc:
            hints.append("🔍 Unknown photo — could be product, could be unrelated.")
    
    return "\n".join(hints) if hints else ""
