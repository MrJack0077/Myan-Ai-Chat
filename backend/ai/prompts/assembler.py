"""
AI: Prompt assembly — shop identity, communication rules, faqs, knowledge base.
Orchestrates sub-modules to build the full system prompt.
"""
import hashlib
from config import r
from .identity import build_identity
from .style import build_communication_rules
from .knowledge import build_knowledge_blocks
from .cache import get_cached_prompt, set_cached_prompt


async def assemble_system_prompt(
    ai_config: dict,
    intent: str = None,
    extra_context: list[str] = None,
    shop_doc_id: str = None,
) -> str:
    """
    Build the full system prompt from shop config.
    Uses Redis cache keyed on shop_doc_id + config hash.
    """
    # Try cached prompt first
    if shop_doc_id and r:
        config_hash = hashlib.sha256(str(ai_config).encode()).hexdigest()[:16]
        cached = await get_cached_prompt(shop_doc_id, config_hash)
        if cached:
            # Append dynamic extra context to the cached base
            if extra_context:
                cached = cached + "\n\n" + "\n".join(extra_context)
            return cached

    # Build prompt blocks
    parts = [
        build_identity(ai_config),
        "",
        build_communication_rules(ai_config, intent),
        "",
        build_knowledge_blocks(ai_config),
    ]

    if extra_context:
        parts.append("\n".join(extra_context))

    prompt = "\n".join(parts)

    # Cache for future use
    if shop_doc_id and r:
        config_hash = hashlib.sha256(str(ai_config).encode()).hexdigest()[:16]
        await set_cached_prompt(shop_doc_id, config_hash, prompt)

    return prompt
