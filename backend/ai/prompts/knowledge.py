"""
AI Prompt: Knowledge base blocks — FAQs, few-shot examples, reply templates.
"""
import json


def build_knowledge_blocks(ai_config: dict) -> str:
    """Build FAQ, knowledge base, few-shot examples, and templates blocks."""
    parts = []

    # FAQs
    faqs = ai_config.get("faqs", [])
    if faqs:
        active_faqs = [f for f in faqs if isinstance(f, dict) and f.get("isActive", True)]
        if active_faqs:
            faq_lines = []
            for f in active_faqs[:5]:
                q = f.get("question", "")
                a = f.get("answer", "")
                if q and a:
                    faq_lines.append(f"Q: {q}\nA: {a}")
            if faq_lines:
                parts.append(f"[SHOP FAQs]\n" + "\n".join(faq_lines))

    # Knowledge Base
    kb = ai_config.get("knowledgeBase", [])
    if kb:
        kb_items = [item for item in kb if isinstance(item, str) and item.strip()]
        if kb_items:
            parts.append(f"[KNOWLEDGE BASE]\n" + "\n".join(f"- {k}" for k in kb_items[:20]))

    # Reply Templates
    templates = ai_config.get("replyTemplates", {})
    if templates:
        tmpl_lines = [f"{k}: {v}" for k, v in templates.items()]
        if tmpl_lines:
            parts.append(f"[REPLY TEMPLATES]\n" + "\n".join(tmpl_lines))

    # Few-shot Examples
    examples = ai_config.get("fewShotExamples", [])
    if examples:
        ex_lines = []
        for ex in examples[:3]:
            if isinstance(ex, dict):
                ex_lines.append(f"User: {ex.get('input','')}\nAI: {ex.get('output','')}")
        if ex_lines:
            parts.append(f"[FEW-SHOT EXAMPLES]\n" + "\n".join(ex_lines))

    # Constraints
    constraints = ai_config.get("constraints", [])
    if constraints:
        c_lines = [f"- {c}" for c in constraints if isinstance(c, str)]
        if c_lines:
            parts.append(f"[SHOP CONSTRAINTS]\n" + "\n".join(c_lines))

    # Automation Rules
    rules = ai_config.get("automationRules", [])
    if rules:
        active_rules = [r for r in rules if isinstance(r, dict) and r.get("isActive", True)]
        if active_rules:
            parts.append(f"[AUTOMATION RULES]\n" + json.dumps(active_rules, indent=2))

    return "\n".join(parts) if parts else ""
