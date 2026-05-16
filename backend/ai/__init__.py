"""
AI Module — Gemini integration, prompts, agent, memory, embeddings.
"""
from .client import generate_content, generate_embedding
from .agent import run_unified_agent, INTENT_GUIDE
from .memory import (
    build_conversation_context, count_customer_messages,
    needs_summarization, generate_conversation_summary, MAX_RECENT_MESSAGES,
)
from .classifier import fast_intent_classify
from .embedding import generate_embedding as create_embedding
