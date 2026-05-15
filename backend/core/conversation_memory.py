"""
Two-Tier Conversation Memory for continuous AI chat.

Tier 1 (Recent):   Last 6 raw messages (Customer + AI) — exact wording
Tier 2 (Summary):  AI-generated summary, updated every 5 customer messages

Token budget:      ~500 tokens max for history context
Summary style:     Full conversation context (both Customer and AI)
"""
import json
from vertexai.generative_models import GenerativeModel, GenerationConfig
from utils.config import BASE_MODEL_NAME, FAST_MODEL_NAME

MAX_RECENT_MESSAGES = 6       # last N messages kept raw
SUMMARIZE_EVERY_N   = 5        # update summary every N customer messages
MAX_SUMMARY_CHARS   = 400      # keep summary concise (~100 tokens)


def build_conversation_context(chat_history: str, profile: dict) -> str:
    """
    Build the memory block for AI prompt.

    Format:
      [Earlier Conversation]
      {conversation summary}

      [Recent Messages]
      Customer: ...
      AI: ...
    """
    parts = []

    # Tier 2: Compressed summary of earlier conversation
    summary = profile.get("ai_insights", {}).get("conversation_summary", "")
    if summary:
        parts.append(f"[Earlier Conversation]\n{summary}")

    # Tier 1: Recent raw messages
    if chat_history:
        recent = _get_recent_messages(chat_history)
        if recent:
            parts.append(f"[Recent Messages]\n{recent}")

    return "\n\n".join(parts) if parts else ""


def _get_recent_messages(chat_history: str, max_msgs: int = MAX_RECENT_MESSAGES) -> str:
    """Keep only the last N messages from chat history."""
    if not chat_history:
        return ""
    lines = chat_history.strip().split("\n")
    # Each message is "Role: text" — keep last N lines
    recent = lines[-max_msgs:] if len(lines) > max_msgs else lines
    return "\n".join(recent)


def count_customer_messages(chat_history: str) -> int:
    """Count how many Customer messages are in the history."""
    if not chat_history:
        return 0
    return sum(1 for line in chat_history.split("\n") if line.startswith("Customer:"))


def needs_summarization(chat_history: str) -> bool:
    """Check if it's time to update the conversation summary."""
    count = count_customer_messages(chat_history)
    return count > 0 and count % SUMMARIZE_EVERY_N == 0


async def generate_conversation_summary(
    old_summary: str,
    chat_history: str,
    profile: dict,
    base_model_name: str = None,
) -> str:
    """
    Generate/update conversation summary using AI.

    Unlike the old summarize_chat_history (which only looked at Customer messages),
    this creates a FULL conversation summary: what was discussed, what was decided,
    what products were shown, what AI recommended, what the customer chose.
    """
    if not chat_history:
        return old_summary or ""

    model_name = base_model_name or BASE_MODEL_NAME
    model = GenerativeModel(model_name)

    sys_prompt = """You are a conversation summarizer for a shop chatbot.

Summarize the FULL conversation between a Customer and a Shop AI Assistant.
Focus on what matters for CONTINUING the conversation:

- What products did the customer ask about?
- What did the AI recommend or explain?
- What decisions were made (colors, sizes, prices agreed on)?
- What is the current state (browsing, ordering, payment, etc.)?
- What does the customer seem to want next?

Rules:
- Include BOTH customer questions AND AI responses
- Keep it to 2-3 concise sentences
- Write in the same language as the conversation
- If there's an old summary, incorporate its key details
- DON'T repeat greetings or small talk"""

    user_prompt_parts = []
    if old_summary:
        user_prompt_parts.append(f"[Previous Summary]\n{old_summary}")
    user_prompt_parts.append(f"[New Messages]\n{chat_history}")
    user_prompt = "\n\n".join(user_prompt_parts)

    try:
        res = await model.generate_content_async(
            contents=[sys_prompt, user_prompt],
            generation_config=GenerationConfig(temperature=0.2, max_output_tokens=150),
        )
        summary = res.text.strip()
        # Truncate if too long
        if len(summary) > MAX_SUMMARY_CHARS:
            summary = summary[:MAX_SUMMARY_CHARS] + "..."
        return summary
    except Exception as e:
        print(f"⚠️ Conversation summary generation error: {e}", flush=True)
        return old_summary or ""
