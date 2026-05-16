"""
Pipeline Stage 5: Embedding research — semantic search + cache lookup.
"""
import time
from ai.embedding import generate_embedding


async def run_research(user_msg: str, shop_doc_id: str,
                       chat_history: str = "") -> tuple:
    """
    Run embedding-based semantic research for the user query.
    1. Generate embedding for the user message
    2. Search Firestore for similar products (keyword + vector)
    3. Returns (tool_info, msg_emb). Falls back to keyword-only if embedding fails.
    """
    t_start = time.time()
    msg_emb = await generate_embedding(user_msg)

    # Semantic search for products (keyword always works, embedding optional)
    tool_info = ""
    try:
        tool_info = await _hybrid_search(user_msg, shop_doc_id, msg_emb)
    except Exception as e:
        print(f"⚠️ Semantic search error: {e}", flush=True)

    # If still empty, try keyword-only search
    if not tool_info or tool_info == "No products in database.":
        try:
            tool_info = await _keyword_only_search(user_msg, shop_doc_id)
            if tool_info:
                print(f"✅ Keyword search found products (embedding unavailable)", flush=True)
        except Exception:
            pass

    # Inject last discussed product for vague messages
    tool_info = _inject_last_product(tool_info, user_msg, chat_history)

    if tool_info:
        print(f"⏱️  Research: {(time.time() - t_start):.2f}s | {tool_info[:80]}...", flush=True)
    else:
        tool_info = "No products in database."

    return tool_info, msg_emb


async def _hybrid_search(query: str, shop_doc_id: str, embedding: list[float]) -> str:
    """Hybrid search: vector similarity + keyword scoring for product matching."""
    from config import db
    if not db:
        return ""

    import asyncio
    items_ref = db.collection("shops").document(shop_doc_id).collection("items")

    # Get all products
    docs = await asyncio.to_thread(items_ref.stream)
    products = []
    for d in docs:
        data = d.to_dict() if callable(d.to_dict) else {}
        data["id"] = d.id
        products.append(data)

    print(f"🔍 Searched {len(products)} items for: {query[:60]}...", flush=True)

    if not products:
        return "No items in database."

    # Score by keyword match + embedding similarity
    query_lower = query.lower()
    scored = []
    for prod in products:
        name = str(prod.get("name", ""))
        keywords = str(prod.get("ai_keywords", ""))
        score = 0
        # Keyword scoring (product name)
        if name.lower() in query_lower or query_lower in name.lower():
            score += 5
        for word in query_lower.split():
            if word in name.lower():
                score += 2
        # Keyword scoring (ai_keywords field)
        if keywords:
            for word in query_lower.split():
                if word in keywords.lower():
                    score += 2
        # Cosine similarity (if embedding available)
        if embedding and prod.get("embedding"):
            try:
                sim = _cosine_sim(embedding, prod["embedding"])
                score += sim * 3
            except Exception:
                pass
        if score > 0:
            scored.append((score, prod))

    scored.sort(key=lambda x: x[0], reverse=True)

    # Build results string (top 10)
    lines = []
    for _, prod in scored[:10]:
        name = prod.get("name", "Unknown")
        price = prod.get("price", "N/A")
        status = prod.get("status", "available")
        description = str(prod.get("description", ""))[:80]
        kw = str(prod.get("ai_keywords", ""))[:60]
        lines.append(f"- {name} | {price} | Status: {status} | Keywords: {kw} | Desc: {description}")

    print(f"📊 Found {len(scored)} matches (top {len(lines)} shown)", flush=True)
    return "\n".join(lines) if lines else ""


def _cosine_sim(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = sum(x * x for x in a) ** 0.5
    mag_b = sum(x * x for x in b) ** 0.5
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


async def _keyword_only_search(query: str, shop_doc_id: str) -> str:
    """
    Pure keyword-based product search (no embedding needed).
    Used as fallback when embedding providers are down.
    """
    from config import db
    if not db:
        return ""

    import asyncio
    items_ref = db.collection("shops").document(shop_doc_id).collection("items")
    docs = await asyncio.to_thread(items_ref.stream)
    products = []
    for d in docs:
        data = d.to_dict() if callable(d.to_dict) else {}
        data["id"] = d.id
        products.append(data)

    if not products:
        return ""

    query_lower = query.lower()
    scored = []
    for prod in products:
        name = str(prod.get("name", ""))
        keywords = str(prod.get("ai_keywords", ""))
        score = 0
        if name.lower() in query_lower or query_lower in name.lower():
            score += 5
        for word in query_lower.split():
            if word in name.lower():
                score += 2
        if keywords:
            for word in query_lower.split():
                if word in keywords.lower():
                    score += 2
        if score > 0:
            scored.append((score, prod))

    scored.sort(key=lambda x: x[0], reverse=True)

    # Build results string (top 10 keyword matches)
    lines = []
    for _, prod in scored[:10]:
        name = prod.get("name", "Unknown")
        price = prod.get("price", "N/A")
        status = prod.get("status", "available")
        lines.append(f"- {name} | {price} | Status: {status}")

    return "\n".join(lines) if lines else ""


def _inject_last_product(tool_info: str, user_msg: str, chat_history: str) -> str:
    """For vague messages, inject the last discussed product as context."""
    import re
    vague_words = ['how much', 'i want', 'buy', 'take', 'price',
                   'ဘယ်လောက်', 'ယူမယ်', 'ဝယ်', 'ဈေး']
    if not any(p in user_msg.lower() for p in vague_words):
        return tool_info
    if not chat_history:
        return tool_info

    ai_lines = [l for l in chat_history.split('\n') if l.startswith('AI:')]
    if not ai_lines:
        return tool_info

    last_ai = ai_lines[-1]
    matches = re.findall(
        r'(?:Camera|IPhone|Samsung|Xiaomi|Oppo|Vivo|Apple\s*Watch|iPad|AirPods|JBL|Aqara)[\w\s]*\w',
        last_ai, re.IGNORECASE,
    )
    if matches and tool_info:
        return f"[Last Discussed Product]\n{matches[-1]} — from previous conversation\n\n{tool_info}"

    return tool_info
