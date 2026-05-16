# Project Context: AI Chatbot Management Platform

This is an AI-powered Chatbot Management Platform facilitating interactions via Messenger and Telegram. 

## Architectural Overview

### Backend (Python 3.11+ + FastAPI + Redis)
```
backend/
├── main.py              — FastAPI entry point + router mounting
├── config.py            — Env, Redis, Firestore, Vertex AI, AI Studio
├── ai/                  — 🧠 AI / Gemini integration
│   ├── client.py        — GenAI client wrapper (call, retry, timeout)
│   ├── agent.py         — Unified single-pass agent (intent+reply+extract)
│   ├── agent_normalizer.py — AI JSON output normalization
│   ├── embedding.py     — Embedding generation (Vertex→AI Studio→local)
│   ├── memory.py        — Two-Tier conversation memory
│   ├── classifier.py    — Keyword-based fast intent classifier
│   └── prompts/         — System prompt assembly
│       ├── assembler.py — Orchestrates sub-modules
│       ├── identity.py  — Shop identity block
│       ├── style.py     — Communication style + rules
│       ├── knowledge.py — FAQ, knowledge base, templates
│       └── cache.py     — Prompt Redis-cache versioning
├── sendpulse/           — 📲 SendPulse API Client (fully isolated)
│   ├── auth.py          — OAuth token management
│   ├── client.py        — HTTP client with v2→v1 fallback + retry
│   ├── messages.py      — Message send + channel routing
│   └── actions.py       — typing, stop_typing, open_chat, tags
├── webhook/             — 📨 Webhook processing
│   ├── schemas.py       — Pydantic models for webhook payload
│   ├── signature.py     — HMAC-SHA256 verification
│   ├── debounce.py      — Message dedup/merge buffer
│   └── queue.py         — Redis/memory queue push/pop
├── pipeline/            — ⚙️ Message processing (Chain of Responsibility)
│   ├── orchestrator.py  — process_core_logic() thin coordinator
│   └── stages/
│       ├── extract.py   — Extract text, IDs, attachments
│       ├── validate.py  — Rate limit + per-user lock + token
│       ├── profile.py   — Load/update customer profile
│       ├── context.py   — History, media download, typing indicator
│       ├── research.py  — Embedding search + semantic cache
│       ├── reason.py    — Call unified agent for AI reply
│       ├── respond.py   — Send reply via SendPulse + typing
│       └── finalize.py  — Analytics, summary, cache save
├── orders/              — 📦 Order management
│   ├── extractor.py     — Pattern-based NLP extraction
│   ├── handler.py       — Order state machine + confirmation
│   ├── persistence.py   — Firestore order save + inventory
│   └── notifications.py — Admin notifications
├── shops/               — 🏪 Shop data service
│   ├── service.py       — get_shop_data, cache-aware lookup
│   ├── automation.py    — Automation settings CRUD + cache invalidation
│   └── analytics.py     — Token increment + analytics logging
├── customers/           — 👤 Customer profiles
│   ├── profile.py       — get/save, segment, expire order state
│   └── history.py       — Redis-based chat history
├── worker/              — 🔄 Background workers
│   ├── process.py       — worker_process loop + dead letter
│   └── health.py        — Worker health checks
├── shared/              — 🔧 Shared utilities (no business logic)
│   ├── redis.py         — Redis client + key helpers
│   ├── firestore.py     — Firestore client + error handler
│   ├── http_client.py   — httpx wrapper with retry + token
│   └── exceptions.py    — Custom exception classes
└── api/                 — 🌐 FastAPI HTTP routes (thin layer)
    ├── deps.py          — Dependency injection
    └── routes/
        ├── webhook.py       — POST /webhook
        ├── admin_cache.py   — Cache/embed/debug
        ├── admin_cron.py    — Cron followup
        ├── admin_products.py — Product sync
        └── admin_shops.py   — Automation settings
```

### Frontend (React + TypeScript + Tailwind CSS)
- Dashboard for shop settings, SendPulse credential management.

## 🧠 Critical Development Principles

### 1. SendPulse Integration
- **Endpoints:** Always prioritize `v2` endpoints.
- **Resilience:** v2→v1 fallback on 404.
- **Typing Status:** Use `asyncio.create_task()` for typing/stop_typing.
- **Credentials:** Managed on frontend, retrieved via Firestore.

### 2. Worker & Queueing Logic
- **Redis Resilience:** Workers handle empty queues gracefully.
- **AI Processing:** Use `genai_client.aio.models.generate_content()` with `genai.types.GenerateContentConfig`.
- **Model:** `gemini-3.1-flash-lite` (Vertex AI format, no `models/` prefix).

### 3. File Size Limit
- **STRICT:** No file exceeds 250 lines. Split into smaller modules.

### 4. Error Handling
- **Firestore:** Use `handleFirestoreError` for all operations.
- **Pipeline:** Every stage wrapped in try/except with traceback.

### 5. Code Standards
- **TypeScript:** Strictly typed.
- **Styling:** Tailwind CSS utility classes only.
- **Python:** Strict type hints + Pydantic for validation.
