"""
AI Reply System Test — Real Multi-Turn Conversation Testing
Simulates a real customer conversation with Smart Heaven Myanmar bot.
Tests: product search, order flow, memory, policies, anti-hallucination.
"""
import asyncio
import json
from ai.agent import run_unified_agent

# ── Realistic Shop Data (from Firestore snapshot) ──
SHOP_DATA = {
    "ai_config": {
        "botName": "စမတ်ဟုန်း အကြံပေးအေးဂျင့်",
        "responseLanguage": "Myanmar",
        "formalityLevel": "friendly",
        "communicationStyle": {"preset": "friendly"},
        "constraints": [
            "ဈေးနှုန်းကို ဘယ်တော့မှအရင်မပြောပါနဲ့ မေးမှပြောပါ",
            "အခြားပြိုင်ဘက်ဆိုင်များ၏ အမည်နှင့် ဈေးနှုန်းများကို မဖြေကြားရန်",
            "Smart Home နှင့် မသက်ဆိုင်သော နိုင်ငံရေး၊ ဘာသာရေးကိစ္စများကို ယဉ်ကျေးစွာငြင်းဆန်ရန်",
            "သေချာမသိသောအရာကို လုပ်ကြံမပြောရ — DB ထဲမပါရင် မရှိကြောင်း ရိုးသားစွာပြော",
        ],
        "policies": {
            "shipping": "ရန်ကုန် (၁-၂ရက်)၊ မန္တလေး (၂-၃ရက်)၊ အခြားမြို့ (၃-၅ရက်)",
            "returns": "၇ရက်အတွင်း ပြန်လဲနိုင် (Factory Defect အတွက်သာ)",
            "guarantees": "Smart Lock နှင့် CCTV ကို ၂နှစ်အာမခံပေး၊ အခြားပစ္စည်းများ ၁နှစ်",
        },
    },
}

# ── Product Database (24 items from Firestore) ──
PRODUCT_DB = """- Camera E1 | 308,661 | Keywords: camera, wifi, indoor, security | Status: active
- Camera G100 Select | 211,916 | Keywords: camera, outdoor, 4k, night vision | Status: active
- Smart Switch (1 Gang) | 25,000 | Keywords: switch, smart home, wifi | Status: active
- Smart Bulb RGB | 35,000 | Keywords: bulb, light, rgb, smart home | Status: active
- Door Sensor | 15,000 | Keywords: sensor, door, security, alarm | Status: active
- AirPods Pro 2 | 350,000 | Keywords: airpods, apple, wireless, earbuds | Status: active
- Apple Watch S10 | 680,000 | Keywords: watch, apple, smartwatch | Status: active
- iPhone 15 | 1,750,000 | Keywords: iphone, apple, phone, mobile | Status: active
- iPhone 16 Pro | 2,450,000 | Keywords: iphone, apple, phone, pro | Status: active
- Samsung Galaxy S25 | 1,890,000 | Keywords: samsung, galaxy, android, phone | Status: active
- Samsung Galaxy S23 | 1,250,000 | Keywords: samsung, galaxy, android, phone | Status: active
- Xiaomi 14 | 890,000 | Keywords: xiaomi, android, phone, budget | Status: active
- Oppo Reno 12 | 890,000 | Keywords: oppo, android, phone, budget | Status: active
- iPad Air M2 | 1,350,000 | Keywords: ipad, apple, tablet | Status: active
- Xiaomi Watch 2 | 180,000 | Keywords: watch, xiaomi, smartwatch, budget | Status: active
- JBL Flip 7 | 180,000 | Keywords: speaker, bluetooth, jbl, music | Status: active
- Aqara Video Doorbell G4 | 534,398 | Keywords: doorbell, camera, security, aqara | Status: active
- Smart Lock Pro | 250,000 | Keywords: lock, smart, security, door | Status: active
- Motion Sensor | 12,000 | Keywords: sensor, motion, security, smart home | Status: active
- Temperature Sensor | 15,000 | Keywords: sensor, temperature, smart home | Status: active"""

PAYMENT_METHODS = [
    {"type": "Kpay"}, {"type": "CB"}, {"type": "KBZ"},
    {"type": "MAB"}, {"type": "AYA"}, {"type": "YOMA"}, {"type": "A BANK"},
]

DELIVERY_INFO = [
    {"city": "Yangon", "price": 3000, "days": "1-2 days"},
    {"city": "Mandalay", "price": 5000, "days": "2-3 days"},
    {"city": "Other", "price": 7000, "days": "3-5 days"},
]

# ── Customer Profile (evolves through conversation) ──
profile = {
    "identification": {"name": "", "phone": "", "address": "", "segment": "new"},
    "dynamics": {"message_count": 0, "order_state": "NONE", "last_interaction": ""},
    "current_order": {"items": [], "total_price": 0},
    "sales_data": {"past_purchases": [], "total_spent": 0},
    "ai_insights": {"conversation_summary": "", "preferences": {}},
}

chat_history = ""

async def send_message(msg: str, description: str = ""):
    """Send a customer message and get AI reply, then update state."""
    global chat_history, profile
    
    if description:
        print(f"\n{'─'*70}")
        print(f"💬 {description}")
    
    print(f"\n👤 Customer: {msg}")
    
    result = await run_unified_agent(
        user_msg=msg,
        chat_history=chat_history,
        profile=profile,
        ai_config=SHOP_DATA["ai_config"],
        tool_info=PRODUCT_DB,
        order_state=profile["dynamics"]["order_state"],
        delivery_info=DELIVERY_INFO,
        payment_info=PAYMENT_METHODS,
        currency="MMK",
    )
    
    intent = result.get("intent", "?")
    reply = result.get("reply", "")
    extracted = result.get("extracted", {})
    
    # ── Update profile based on AI extraction ──
    if extracted.get("name"):
        profile["identification"]["name"] = extracted["name"]
    if extracted.get("phone"):
        profile["identification"]["phone"] = extracted["phone"]
    if extracted.get("address"):
        profile["identification"]["address"] = extracted["address"]
    if extracted.get("payment_method"):
        profile["current_order"]["payment_method"] = extracted["payment_method"]
    if extracted.get("items"):
        profile["current_order"]["items"] = extracted["items"]
    
    # ── Track order state ──
    if intent == "START_ORDER":
        profile["dynamics"]["order_state"] = "COLLECTING"
        profile["current_order"]["items"] = []
        profile["current_order"]["total_price"] = 0
    elif intent == "ORDER_CONFIRMED":
        profile["dynamics"]["order_state"] = "COMPLETED"
    
    # ── Update chat history (Tier 1 memory) ──
    chat_history += f"\nCustomer: {msg}\nAI: {reply[:200]}"
    profile["dynamics"]["message_count"] += 1
    
    print(f"🤖 AI [{intent}]: {reply[:300]}")
    
    return result


async def main():
    print("═" * 70)
    print("🧪 AI REPLY SYSTEM — REAL CONVERSATION TEST")
    print("═" * 70)
    print(f"Shop: Smart Heaven Myanmar")
    print(f"Products: 20+ items in DB")
    print(f"Payment: Kpay, CB, KBZ, MAB, AYA, YOMA, A BANK, COD")
    print(f"Delivery: Yangon(3000), Mandalay(5000), Other(7000)")
    
    # ═══ PHASE 1: Product Inquiry ═══
    print(f"\n{'═'*70}")
    print("📱 PHASE 1: PRODUCT INQUIRY — Customer browsing")
    print("═"*70)
    
    await send_message("မင်္ဂလာပါရှင့်", "Greeting")
    await send_message("ဖုန်းတစ်လုံးလောက် ကြည့်ချင်လို့ပါ", "Product inquiry - phone")
    await send_message("iPhone နဲ့ Samsung တွေရော ဘာတွေရှိလဲ", "Product list request")
    await send_message("iPhone 16 Pro ဘယ်လောက်လဲ", "Specific price inquiry")
    await send_message("Samsung Galaxy S25 ရော ဘယ်လောက်လဲ အဲ့ဒီနှစ်ခု ဘာကွာလဲ", "Compare products")
    await send_message("iPhone 15 လည်းရှိလား ဘယ်လောက်လဲ", "Check another product")
    
    # ═══ PHASE 2: Start Order Flow ═══
    print(f"\n{'═'*70}")
    print("🛒 PHASE 2: ORDER FLOW — Customer decides to buy")
    print("═"*70)
    
    await send_message("iPhone 16 Pro ယူမယ်ဗျာ", "Start order")
    await send_message("နာမည်က အောင်အောင်ပါ ဖုန်းနံပါတ်က 09987654321 ပါ", "Provide name + phone")
    await send_message("ရန်ကုန် ဗဟန်းမြို့နယ်ကိုပို့ပေးပါ အမှတ် ၄၂ အောင်ဆန်းလမ်း", "Provide address")
    await send_message("ပို့ခ ဘယ်လောက်ကျမလဲ", "Delivery cost inquiry (should use policy: 3000)")
    
    # ═══ PHASE 3: Payment & Policy ═══
    print(f"\n{'═'*70}")
    print("💳 PHASE 3: PAYMENT & POLICIES — Customer finalizing")
    print("═"*70)
    
    await send_message("ဘယ်လိုငွေပေးချေလို့ရလဲ", "Payment methods inquiry")
    await send_message("Kpay နဲ့ပေးချေမယ်", "Select payment method")
    await send_message("အာမခံချက်ရှိလား ပြန်လဲလို့ရလား", "Warranty/return policy inquiry")
    await send_message("အဆင်ပြေပါတယ် အော်ဒါတင်လိုက်ပါ", "Confirm order")
    
    # ═══ PHASE 4: Memory Test ═══
    print(f"\n{'═'*70}")
    print("🧠 PHASE 4: MEMORY TEST — Context preservation")
    print("═"*70)
    
    await send_message("ခုနက အော်ဒါ ပမာဏ ဘယ်လောက်လဲ ပြန်ပြောပြပါ", "Recall order info (memory test)")
    await send_message("ကျေးဇူးပဲနော် နောက်မှထပ်မေးမယ်", "End conversation")
    
    # ═══ PHASE 5: Edge Cases ═══
    print(f"\n{'═'*70}")
    print("🎯 PHASE 5: EDGE CASES — Anti-hallucination test")
    print("═"*70)
    
    # New customer for edge cases
    profile["identification"] = {"name": "", "phone": "", "address": "", "segment": "new"}
    profile["dynamics"] = {"message_count": 0, "order_state": "NONE", "last_interaction": ""}
    profile["current_order"] = {"items": [], "total_price": 0}
    chat_history = ""
    
    await send_message("Nokia 3310 ရှိလား", "Non-existent product (should politely refuse)")
    await send_message("ပို့ခ ဘယ်လောက်လဲ အတိအကျပြော", "Delivery without order (should ask city)")
    await send_message("မန္တလေးကိုပါ", "Specify city")
    await send_message("တခြားဆိုင်တွေမှာ ၂သိန်းပဲပေး အဲ့ဒါဘာလို့ဈေးကြီးလဲ", "Competitor price comparison (constraint: don't compare)")
    
    print(f"\n{'═'*70}")
    print("✅ ALL CONVERSATION TESTS COMPLETE")
    print("═"*70)

asyncio.run(main())
