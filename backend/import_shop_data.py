"""
Bulk import script — Mobile Phone Shop data for Noble Tech.
Adds 5 categories + 20 items with AI embeddings to Firestore.
"""
import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from utils import db
from google.cloud.firestore_v1.vector import Vector
import google.generativeai as genai
from utils.config import EMBEDDING_MODEL_NAME

# ══════════════════════════════════════════════════════════════
# CONFIG — Change this to your shop ID
# ══════════════════════════════════════════════════════════════
SHOP_ID = "2eUTZdBwFohkleA2oGG2"  # Your existing shop ID

# ══════════════════════════════════════════════════════════════
# CATEGORIES
# ══════════════════════════════════════════════════════════════
CATEGORIES = [
    "Smartphones",
    "Tablets",
    "Audio & Sound",
    "Smart Watches",
    "Accessories",
]

# ══════════════════════════════════════════════════════════════
# PRODUCTS (20 items with full AI details)
# ══════════════════════════════════════════════════════════════
PRODUCTS = [
    {
        "name": "Samsung Galaxy S25",
        "category": "Smartphones",
        "price": 1890000,
        "stock_quantity": 5,
        "brand": "Samsung",
        "description": "2025 flagship - 6.2\" Dynamic AMOLED 2X, Snapdragon 8 Elite, 50MP telephoto camera, Galaxy AI features",
        "ai_custom_description": "Samsung Galaxy S25 ဟာ 2025 ရဲ့အကောင်းဆုံး compact flagship ပါ။ AI features တွေ အပြည့်ပါပြီး ဓာတ်ပုံရိုက်တာ၊ battery ခံတာ အကောင်းဆုံးပါ။",
        "ai_keywords": "samsung, galaxy, s25, flagship, camera, ai, amoled, snapdragon, compact",
        "specifications": "Display: 6.2\" Dynamic AMOLED 2X 120Hz, CPU: Snapdragon 8 Elite, RAM: 12GB, Storage: 256GB, Camera: 50MP+12MP+10MP, Battery: 4000mAh, OS: One UI 7",
    },
    {
        "name": "iPhone 16 Pro",
        "category": "Smartphones",
        "price": 2450000,
        "stock_quantity": 3,
        "brand": "Apple",
        "description": "6.3\" Super Retina XDR OLED, A18 Pro chip, 48MP Fusion camera, Titanium design, USB-C, iOS 18",
        "ai_custom_description": "iPhone 16 Pro က premium titanium body နဲ့ A18 Pro chip ပါတဲ့အတွက် ဘယ် app ဖွင့်ဖွင့် အရမ်းမြန်ပါတယ်။ Video ရိုက်တာ professional အဆင့်ပါ။",
        "ai_keywords": "iphone, apple, 16 pro, titanium, a18, camera, video, premium, ios",
        "specifications": "Display: 6.3\" LTPO OLED 120Hz, CPU: A18 Pro, RAM: 8GB, Storage: 256GB, Camera: 48MP+12MP+12MP, Battery: 3582mAh, USB-C, Titanium",
    },
    {
        "name": "Xiaomi 14T Pro",
        "category": "Smartphones",
        "price": 1250000,
        "stock_quantity": 8,
        "brand": "Xiaomi",
        "description": "6.67\" CrystalRes AMOLED 144Hz, MediaTek Dimensity 9300+, Leica 50MP camera, 120W HyperCharge",
        "ai_custom_description": "Xiaomi 14T Pro က Leica camera ပါတာမို့ ဓာတ်ပုံအရမ်းလှတယ်။ 120W charger နဲ့ မိနစ် ၂၀ အတွင်း 100% သွင်းနိုင်တယ်။",
        "ai_keywords": "xiaomi, 14t, leica, camera, 120w, charging, mediatek, fast, photography",
        "specifications": "Display: 6.67\" AMOLED 144Hz, CPU: Dimensity 9300+, RAM: 12GB, Storage: 512GB, Camera: 50MP Leica+50MP+12MP, Battery: 5000mAh, 120W",
    },
    {
        "name": "Oppo Reno 12",
        "category": "Smartphones",
        "price": 890000,
        "stock_quantity": 10,
        "brand": "Oppo",
        "description": "6.7\" AMOLED 120Hz, MediaTek Dimensity 7300, 50MP AI Portrait, 80W SuperVOOC, Slim design",
        "ai_custom_description": "Oppo Reno 12 က portrait ဓာတ်ပုံရိုက်ရင် AI နဲ့အလှဆင်ပေးတယ်။ ပါးလွှာပြီး လက်ထဲကိုင်ရတာ အဆင်ပြေတယ်။",
        "ai_keywords": "oppo, reno, 12, portrait, ai, slim, 80w, charging, selfie",
        "specifications": "Display: 6.7\" AMOLED 120Hz, CPU: Dimensity 7300, RAM: 8GB, Storage: 256GB, Camera: 50MP+8MP+2MP, Battery: 5000mAh, 80W",
    },
    {
        "name": "Vivo V40",
        "category": "Smartphones",
        "price": 750000,
        "stock_quantity": 7,
        "brand": "Vivo",
        "description": "6.78\" AMOLED 120Hz, Snapdragon 7 Gen 3, ZEISS 50MP Portrait, 5500mAh, 80W FlashCharge",
        "ai_custom_description": "Vivo V40 က ZEISS camera ပါတဲ့အတွက် portrait ဓာတ်ပုံတွေ DSLR လိုလှတယ်။ Battery 5500mAh ဆိုတော့ တစ်နေ့လုံး သုံးလို့ရတယ်။",
        "ai_keywords": "vivo, v40, zeiss, portrait, battery, 5500, snapdragon, midrange",
        "specifications": "Display: 6.78\" AMOLED 120Hz, CPU: Snapdragon 7 Gen 3, RAM: 12GB, Storage: 256GB, Camera: 50MP ZEISS+50MP, Battery: 5500mAh, 80W",
    },
    {
        "name": "Samsung Galaxy A55",
        "category": "Smartphones",
        "price": 580000,
        "stock_quantity": 12,
        "brand": "Samsung",
        "description": "6.6\" Super AMOLED 120Hz, Exynos 1480, 50MP OIS camera, 5000mAh, IP67 waterproof",
        "ai_custom_description": "Samsung A55 က ဈေးသက်သာပြီး quality ကောင်းတယ်။ IP67 waterproof ပါတော့ မိုးထဲသုံးလည်း စိတ်ချရတယ်။",
        "ai_keywords": "samsung, a55, budget, waterproof, ip67, ois, amoled, reliable",
        "specifications": "Display: 6.6\" Super AMOLED 120Hz, CPU: Exynos 1480, RAM: 8GB, Storage: 128GB, Camera: 50MP OIS+12MP+5MP, Battery: 5000mAh, IP67",
    },
    {
        "name": "Redmi Note 14 Pro",
        "category": "Smartphones",
        "price": 520000,
        "stock_quantity": 15,
        "brand": "Xiaomi",
        "description": "6.67\" AMOLED 120Hz, Snapdragon 7s Gen 3, 200MP camera, 5100mAh, 67W charging",
        "ai_custom_description": "Redmi Note 14 Pro က 200MP camera ပါပြီး ဈေးလည်း အရမ်းသက်သာတယ်။ ကျောင်းသား/အလုပ်သမားတွေအတွက် အကောင်းဆုံး budget phone ပါ။",
        "ai_keywords": "redmi, note 14, 200mp, budget, camera, xiaomi, affordable, student",
        "specifications": "Display: 6.67\" AMOLED 120Hz, CPU: Snapdragon 7s Gen 3, RAM: 8GB, Storage: 256GB, Camera: 200MP+8MP+2MP, Battery: 5100mAh, 67W",
    },
    {
        "name": "iPhone 15",
        "category": "Smartphones",
        "price": 1750000,
        "stock_quantity": 4,
        "brand": "Apple",
        "description": "6.1\" Super Retina XDR OLED, A16 Bionic, 48MP camera, USB-C, Dynamic Island, iOS 17",
        "ai_custom_description": "iPhone 15 က Dynamic Island ပါလို့ notification တွေ အဆင်ပြေတယ်။ USB-C ပြောင်းသွားပြီဆိုတော့ charger လည်း အဆင်ပြေတယ်။",
        "ai_keywords": "iphone, 15, apple, dynamic island, usb-c, a16, camera, reliable",
        "specifications": "Display: 6.1\" OLED 60Hz, CPU: A16 Bionic, RAM: 6GB, Storage: 128GB, Camera: 48MP+12MP, Battery: 3349mAh, USB-C",
    },
    {
        "name": "iPad Air M2",
        "category": "Tablets",
        "price": 1350000,
        "stock_quantity": 4,
        "brand": "Apple",
        "description": "11\" Liquid Retina, M2 chip, Apple Pencil Pro support, Landscape camera, WiFi 6E",
        "ai_custom_description": "iPad Air M2 က M2 chip နဲ့ဆိုတော့ laptop လောက်တောင် မြန်တယ်။ ကျောင်းသားတွေ၊ designer တွေအတွက် အဆင်ပြေဆုံး tablet ပါ။",
        "ai_keywords": "ipad, air, m2, apple, tablet, pencil, student, design, powerful",
        "specifications": "Display: 11\" Liquid Retina, CPU: M2, RAM: 8GB, Storage: 128GB, Camera: 12MP, WiFi 6E, USB-C",
    },
    {
        "name": "Samsung Tab S9 FE",
        "category": "Tablets",
        "price": 680000,
        "stock_quantity": 6,
        "brand": "Samsung",
        "description": "10.9\" TFT 90Hz, Exynos 1380, S Pen included, IP68 waterproof, 8000mAh",
        "ai_custom_description": "Samsung Tab S9 FE က S Pen အပါလို့ စာရေးဖို့၊ ပုံဆွဲဖို့ အဆင်ပြေတယ်။ IP68 waterproof ပါတော့ ရေစိုမှာလည်း မပူရဘူး။",
        "ai_keywords": "samsung, tab, s9 fe, s pen, waterproof, tablet, student, drawing",
        "specifications": "Display: 10.9\" TFT 90Hz, CPU: Exynos 1380, RAM: 6GB, Storage: 128GB, Battery: 8000mAh, S Pen, IP68",
    },
    {
        "name": "Xiaomi Pad 6",
        "category": "Tablets",
        "price": 520000,
        "stock_quantity": 5,
        "brand": "Xiaomi",
        "description": "11\" IPS 144Hz, Snapdragon 870, 8840mAh, 33W charging, Quad speakers",
        "ai_custom_description": "Xiaomi Pad 6 က 144Hz display နဲ့ Quad speakers ပါတော့ ရုပ်ရှင်ကြည့်ရင် အရမ်းကောင်းတယ်။ ဈေးလည်းသက်သာတယ်။",
        "ai_keywords": "xiaomi, pad 6, 144hz, tablet, entertainment, budget, snapdragon, speakers",
        "specifications": "Display: 11\" IPS 144Hz, CPU: Snapdragon 870, RAM: 6GB, Storage: 128GB, Battery: 8840mAh, 33W",
    },
    {
        "name": "AirPods Pro 2",
        "category": "Audio & Sound",
        "price": 350000,
        "stock_quantity": 10,
        "brand": "Apple",
        "description": "Active Noise Cancellation, Adaptive Audio, USB-C, Personalized Spatial Audio, IP54",
        "ai_custom_description": "AirPods Pro 2 က noise cancellation အကောင်းဆုံးပါ။ လေယာဉ်စီးရင်၊ office မှာသုံးရင် ဆူညံသံတွေ လုံးဝမကြားရဘူး။",
        "ai_keywords": "airpods, pro 2, apple, anc, noise cancellation, wireless, premium, spatial audio",
        "specifications": "Type: True Wireless, ANC: Yes, Chip: H2, Battery: 6hr + 30hr case, USB-C, IP54",
    },
    {
        "name": "Samsung Buds3 Pro",
        "category": "Audio & Sound",
        "price": 280000,
        "stock_quantity": 8,
        "brand": "Samsung",
        "description": "Active Noise Cancellation, 360 Audio, IP57, Galaxy AI features, 30hr battery",
        "ai_custom_description": "Samsung Buds3 Pro က Galaxy phone နဲ့တွဲသုံးရင် 360 Audio နဲ့ AI translation တွေပါရတယ်။ Samsung user တွေအတွက် အကောင်းဆုံးပါ။",
        "ai_keywords": "samsung, buds3, pro, anc, 360 audio, galaxy, wireless, premium",
        "specifications": "Type: True Wireless, ANC: Yes, Battery: 8hr + 30hr case, IP57, Bluetooth 5.4",
    },
    {
        "name": "JBL Flip 7",
        "category": "Audio & Sound",
        "price": 180000,
        "stock_quantity": 6,
        "brand": "JBL",
        "description": "Bluetooth speaker, 30W output, IP67 waterproof, 16hr battery, PartyBoost",
        "ai_custom_description": "JBL Flip 7 က ရေစိမ်ခံနိုင်တဲ့ Bluetooth speaker ပါ။ ခရီးသွားရင်၊ ရေကူးရင် ယူသွားလို့ရတယ်။ အသံလည်း အရမ်းကောင်းတယ်။",
        "ai_keywords": "jbl, flip 7, bluetooth, speaker, waterproof, party, portable, bass",
        "specifications": "Type: Bluetooth Speaker, Power: 30W, Battery: 16hr, IP67, Bluetooth 5.4, PartyBoost",
    },
    {
        "name": "Xiaomi Buds 5",
        "category": "Audio & Sound",
        "price": 120000,
        "stock_quantity": 15,
        "brand": "Xiaomi",
        "description": "Active Noise Cancellation, LDAC, 38hr battery, IP54, Google Fast Pair",
        "ai_custom_description": "Xiaomi Buds 5 က ဈေးသက်သာပြီး ANC ပါတယ်။ LDAC ပါတော့ high quality audio နားထောင်လို့ရတယ်။ Battery လည်း ၃၈ နာရီခံတယ်။",
        "ai_keywords": "xiaomi, buds 5, anc, ldac, budget, wireless, affordable, battery",
        "specifications": "Type: True Wireless, ANC: Yes, LDAC, Battery: 8hr + 38hr case, IP54",
    },
    {
        "name": "Apple Watch S10",
        "category": "Smart Watches",
        "price": 680000,
        "stock_quantity": 4,
        "brand": "Apple",
        "description": "46mm, LTPO3 OLED, S10 chip, Blood Oxygen, ECG, Sleep tracking, Waterproof WR50",
        "ai_custom_description": "Apple Watch S10 က health tracking အပြည့်စုံဆုံးပါ။ blood oxygen, ECG, sleep tracking တွေ ပါတယ်။ iPhone user တွေအတွက် အကောင်းဆုံး smart watch ပါ။",
        "ai_keywords": "apple, watch, s10, health, ecg, blood oxygen, sleep, premium, fitness",
        "specifications": "Display: 46mm LTPO3 OLED, CPU: S10, Sensors: HR, SpO2, ECG, Temp, GPS, WR50, 18hr battery",
    },
    {
        "name": "Samsung Watch 7",
        "category": "Smart Watches",
        "price": 450000,
        "stock_quantity": 6,
        "brand": "Samsung",
        "description": "44mm, Super AMOLED, Wear OS 5, BioActive sensor, Sleep apnea detection, 40hr",
        "ai_custom_description": "Samsung Watch 7 က Wear OS နဲ့ဆိုတော့ Google apps တွေ အပြည့်သုံးလို့ရတယ်။ Sleep apnea detection ပါတော့ အိပ်စက်မှုကို စစ်ဆေးပေးတယ်။",
        "ai_keywords": "samsung, watch 7, wear os, bioactive, sleep, health, galaxy, fitness",
        "specifications": "Display: 44mm Super AMOLED, OS: Wear OS 5, Sensors: BioActive, GPS, 40hr battery, 5ATM",
    },
    {
        "name": "Xiaomi Watch 2",
        "category": "Smart Watches",
        "price": 180000,
        "stock_quantity": 10,
        "brand": "Xiaomi",
        "description": "1.43\" AMOLED, Wear OS, 150+ sports modes, 14-day battery, GPS, SpO2",
        "ai_custom_description": "Xiaomi Watch 2 က ၁၄ ရက်ခံတဲ့ battery ပါတယ်။ Wear OS နဲ့ဆိုတော့ app တွေလည်းသုံးလို့ရတယ်။ ဈေးလည်းအရမ်းသက်သာတယ်။",
        "ai_keywords": "xiaomi, watch 2, battery, 14 days, wear os, budget, fitness, spo2",
        "specifications": "Display: 1.43\" AMOLED, OS: Wear OS, 150+ sports, GPS, SpO2, 14-day battery",
    },
    {
        "name": "Samsung 45W Super Fast Charger",
        "category": "Accessories",
        "price": 35000,
        "stock_quantity": 20,
        "brand": "Samsung",
        "description": "45W PD 3.0, Type-C, Super Fast Charging 2.0, compatible with Galaxy S/Note/Tab",
        "ai_custom_description": "Samsung 45W charger က Galaxy phone တွေကို မိနစ် ၃၀ အတွင်း 70% အထိသွင်းပေးနိုင်တယ်။ Original Samsung ဖြစ်လို့ စိတ်ချရတယ်။",
        "ai_keywords": "samsung, charger, 45w, fast charging, type-c, original, galaxy, accessory",
        "specifications": "Type: Wall Charger, Power: 45W, Port: USB-C, PD 3.0, Super Fast Charging 2.0",
    },
    {
        "name": "Spigen Case — Multiple Models",
        "category": "Accessories",
        "price": 25000,
        "stock_quantity": 25,
        "brand": "Spigen",
        "description": "Shockproof case, available for Samsung S25/S24/S23, iPhone 16/15, Xiaomi 14T. Multiple colors.",
        "ai_custom_description": "Spigen case တွေက shockproof ဖြစ်ပြီး ဖုန်းကို ကာကွယ်ပေးတယ်။ အရောင်စုံ၊ model စုံရှိလို့ ကြိုက်တဲ့ဖုန်းအတွက် မေးကြည့်ပါရှင့်။",
        "ai_keywords": "spigen, case, shockproof, protection, cover, samsung, iphone, accessory, colorful",
        "specifications": "Material: TPU + PC, Shockproof: Military Grade, Colors: Black/Blue/Red/Clear, Models: Multiple",
    },
]


async def generate_embedding(text: str) -> list:
    """Generate embedding vector for product search."""
    try:
        res = await genai.embed_content_async(
            model=EMBEDDING_MODEL_NAME,
            content=text,
            task_type="retrieval_document",
            output_dimensionality=768,
        )
        return res['embedding']
    except Exception as e:
        print(f"  ⚠️ Embedding failed: {e}")
        return None


async def import_data():
    print(f"\n📱 Importing Mobile Shop Data for shop: {SHOP_ID}")
    print("=" * 60)
    
    shop_ref = db.collection("shops").document(SHOP_ID)
    shop_doc = shop_ref.get()
    if not shop_doc.exists:
        print(f"❌ Shop {SHOP_ID} not found!")
        return
    print(f"✅ Shop: {shop_doc.to_dict().get('name', 'Unknown')}")
    
    # ── 1. Import Categories ──
    print(f"\n📂 Importing {len(CATEGORIES)} categories...")
    for cat_name in CATEGORIES:
        cat_id = cat_name.lower().replace(" & ", "-").replace(" ", "_")
        shop_ref.collection("categories").document(cat_id).set({
            "name": cat_name,
        })
        print(f"  ✅ {cat_name}")
    
    # ── 2. Import Products ──
    print(f"\n📦 Importing {len(PRODUCTS)} products with AI embeddings...")
    items_ref = shop_ref.collection("items")
    
    for i, p in enumerate(PRODUCTS, 1):
        item_id = p["name"].lower().replace(" ", "_").replace("-", "_").replace("—", "_")[:50]
        
        # Build embedding text
        embed_text = f"""
Product: {p['name']}
Brand: {p.get('brand', '')}
Category: {p.get('category', '')}
Price: {p.get('price', 0)} MMK
Description: {p.get('description', '')}
AI Info: {p.get('ai_custom_description', '')}
Keywords: {p.get('ai_keywords', '')}
Specs: {p.get('specifications', '')}
""".strip()
        
        embedding = await generate_embedding(embed_text)
        
        item_data = {
            "name": p["name"],
            "category": p["category"],
            "price": p["price"],
            "stock_quantity": p["stock_quantity"],
            "stock_type": "count",
            "is_available": True,
            "status": "active",
            "item_type": "product",
            "brand": p.get("brand", ""),
            "description": p.get("description", ""),
            "ai_custom_description": p.get("ai_custom_description", ""),
            "ai_keywords": p.get("ai_keywords", ""),
            "specifications": p.get("specifications", ""),
            "created_at": "2026-05-14T00:00:00Z",
            "updated_at": "2026-05-14T00:00:00Z",
        }
        
        if embedding:
            item_data["embedding"] = Vector(embedding)
        
        items_ref.document(item_id).set(item_data)
        status = "🔍 embedded" if embedding else "⚠️ no embed"
        print(f"  [{i:2d}/20] ✅ {p['name'][:45]} — {p['price']:,} MMK ({status})")
        await asyncio.sleep(0.5)  # Rate limit for embedding API
    
    # ── 3. Clear semantic cache ──
    print(f"\n🧹 Clearing semantic cache...")
    cache_ref = shop_ref.collection("semantic_cache")
    cache_docs = cache_ref.limit(500).get()
    batch = db.batch()
    for doc in cache_docs:
        batch.delete(doc.reference)
    batch.commit()
    print(f"  ✅ Cleared {len(list(cache_docs))} cache entries")
    
    # ── 4. Summary ──
    print(f"\n{'='*60}")
    print(f"✅ IMPORT COMPLETE!")
    print(f"   Categories: {len(CATEGORIES)}")
    print(f"   Products:   {len(PRODUCTS)}")
    print(f"   Shop:       {shop_doc.to_dict().get('name', 'Unknown')}")
    print(f"\n🚀 Ready to test! Send a message to your bot.")
    print(f"   Try: 'Samsung S25 ဘယ်လောက်လဲ' or 'iPhone ရှိလား'")


if __name__ == "__main__":
    asyncio.run(import_data())
