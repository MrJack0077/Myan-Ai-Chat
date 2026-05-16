"""
AI: Two-Tier Conversation Memory.
Tier 1: Recent messages (last N messages, untruncated).
Tier 2: AI-generated summary of older conversation (compressed).
"""
import asyncio
from config import genai_client, FAST_MODEL_NAME, r

MAX_RECENT_MESSAGES = 10
SUMMARY_TRIGGER = 12  # summarize when total messages exceed this


def build_conversation_context(history_text: str, summary: str = "",
                               max_recent: int = MAX_RECENT_MESSAGES) -> str:
    """
    Build a concise conversation context string.
    Prepend summary (Tier 2) if available, then recent messages (Tier 1).
    """
    parts = []
    if summary and summary.strip():
        parts.append(f"[Conversation So Far]\n{summary}")
    if history_text and history_text.strip():
        # Take last N messages as recent context
        lines = history_text.strip().split("\n")
        recent = lines[-max_recent * 2:] if len(lines) > max_recent * 2 else lines
        parts.append("[Recent Messages]\n" + "\n".join(recent))
    return "\n\n".join(parts)


def count_customer_messages(history_text: str) -> int:
    """Count customer messages in formatted history."""
    if not history_text:
        return 0
    return sum(1 for line in history_text.split("\n") if line.startswith("Customer:"))


def needs_summarization(history_text: str, threshold: int = SUMMARY_TRIGGER) -> bool:
    """Check if conversation needs summarization based on message count."""
    return count_customer_messages(history_text) >= threshold


async def generate_conversation_summary(
    old_summary: str, history_text: str, profile: dict,
) -> str:
    """
    Generate a rolling summary of the conversation using AI.
    Merges old summary with new history for a compressed representation.
    """
    if not genai_client:
        return old_summary or ""

    try:
        prompt = (
            "Summarize this customer conversation in 3-5 sentences. "
            "Include: what they want, any order details, preferences expressed.\n\n"
        )
        if old_summary:
            prompt += f"Previous Summary: {old_summary}\n\n"
        if history_text:
            prompt += f"Recent Chat:\n{history_text[-2000:]}"

        res = await asyncio.wait_for(
            genai_client.aio.models.generate_content(
                model=FAST_MODEL_NAME,
                contents=[prompt],
            ),
            timeout=5.0,
        )
        summary = str(res.text).strip()
        return summary if summary else old_summary or ""
    except Exception as e:
        print(f"⚠️ Summary generation failed: {e}", flush=True)
        return old_summary or ""
