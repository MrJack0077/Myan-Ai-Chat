# Backend AI Chatbot — Project Guidelines

## Language
- **Always communicate with user in Myanmar (Burmese)** for all explanations, code reviews, and discussions.
- Variable names, function names, and code MUST be in English.
- Code comments can be in English or Myanmar — either is acceptable. Use whatever is clearer for the context.

## Workflow (HARD RULE)
- **Discuss before implementing** — applies to ALL changes including small fixes.
- First explain/analyze the current state and problems, then propose solutions.
- Only after user confirmation, write code.
- When analyzing, list problems with ✅/❌/⚠️ markers for clarity.
- Use comprehensive commit-style summaries after completing changes.

## Tech Stack & Conventions
- **Python 3.11+** with async/await throughout
- **FastAPI** for HTTP, **Redis** for caching/queue, **Google Firestore** for persistence
- **Google Gemini API** for AI (FAST_MODEL for classification, BASE_MODEL for customer replies)
- **SendPulse API** for messaging (webhook integration)
- Use `typing_extensions.TypedDict` for AI response schemas
- Prefer `asyncio.create_task()` for background work, never block the main pipeline

## Architecture
```
backend/
├── main.py              — FastAPI entry point
├── agents/              — AI agent functions (one file per agent type)
│   ├── automation_agent.py, product_agent.py, order_agent.py
│   ├── media_agent.py, service_agent.py, unified_agent.py
│   ├── photo_analyzer.py, base.py
├── core/                — Pipeline orchestration, caching, memory, routing
│   ├── processor.py, worker.py, data_extractor.py
│   ├── order_extractor.py, order_handler.py
│   ├── prompt_builder.py, prompt_cache.py
│   ├── intent_classifier.py, greeting_router.py, routing.py
│   ├── conversation_memory.py, cache_manager.py
│   ├── profile_manager.py, semantic_research.py, plan_enforcer.py
├── api/routes/          — FastAPI route handlers
│   ├── webhook.py, shops.py, cache.py, cron.py, products.py
├── utils/               — Database helpers, API clients, config
│   ├── config.py, api_utils.py, firestore_utils.py
│   ├── redis_utils.py, ai_utils.py, admin_utils.py, sendpulse_utils.py
├── tests/               — Unit & integration tests
│   ├── test_product.py
├── logs/                — PM2 log output
├── requirements.txt     — Python dependencies
├── .env                 — Environment variables (see below)
├── serviceAccount.json  — Google Cloud service account key
├── docker-compose.yml   — Redis container config
└── ecosystem.config.cjs — PM2 process config (at project root)
```
- Keep files under 400 lines — extract to new modules when they grow.
- Each module should have a clear single responsibility.

## Caching Rules
- ALL Redis cache keys MUST have TTL (no eternal keys).
- Use `core/cache_manager.py` for TTL constants and helpers: `TTL_HOT=60s, TTL_WARM=120s, TTL_COOL=3600s, TTL_COLD=7d`.
- Profile and chat history keys MUST use `TTL_COOL` with renewal on activity.
- Cache invalidation via SCAN pattern, never tracking SETs (avoids race conditions).
- Shop data cache: `TTL_WARM=120s`, invalidated on `/refresh` and shop settings update.

## AI Agent Quality
- Agents that generate customer-facing replies MUST use `BASE_MODEL` (`gemini-2.5-flash-lite`).
- Agents that only classify intent MAY use `FAST_MODEL` (`gemini-2.5-flash-lite`).
- Embedding operations use `EMBEDDING_MODEL_NAME` (`gemini-embedding-2`).
- Model names are defined in `utils/config.py` and can be overridden via `.env`.
- Never hardcode replies that override AI output — prefer AI-generated text with hardcoded fallback only.
- Use Two-Tier Memory (`conversation_memory.py`) for chat continuity: recent msgs + periodic summary.
- System prompts MUST be cached via `prompt_cache.py` with `TTL_WARM`.
- Every AI call should have a fallback using `make_fallback_response()`.
- Smart Skip: use `intent_classifier.fast_intent_classify()` to avoid calling Automation Agent when unnecessary.

## Code Quality
- Remove dead code — unused functions, duplicate API calls.
- Use atomic Redis operations (`SET NX EX`, not `INCR` + `EXPIRE` separately).
- Handle exceptions gracefully — never let a single message crash the worker.
- Use dead-letter queue for failed tasks (`dead_letter:*` in Redis).
- Log with clear emoji prefixes: 📩 📤 ❌ ✅ ⚠️ 🧠 ⚡ 💾 🎯 🔔

## SendPulse Integration
- All messages go through `send_sendpulse_messages()` in `utils/sendpulse_utils.py`.
- Typing actions (typing/stop_typing) go through `core/order_handler.py` as `asyncio.create_task` tasks.
- Webhook verification via HMAC-SHA256 (`verify_sendpulse_signature` in `utils/api_utils.py`).
- Debounce rapid messages with 4-second buffer window in `api/routes/webhook.py` (uses atomic `SET NX EX`).
- Use `get_sendpulse_token()` for OAuth with Redis caching (`utils/api_utils.py`).
- Direct channel routing: Telegram → `/telegram/contacts/send`, Messenger → `/messenger/contacts/send`, unknown → v2 then v1 fallback.

## Conversation Memory
- Two-Tier: Recent raw messages (last 6) + compressed summary (every 5 msgs).
- Summary includes BOTH customer and AI messages — full conversation context.
- Summary stored in `profile.ai_insights.conversation_summary`.
- On order complete: keep summary, clear recent history only.
