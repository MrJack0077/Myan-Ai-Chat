# Project Context: AI Chatbot Management Platform

This is an AI-powered Chatbot Management Platform facilitating interactions via Messenger and Telegram. 

## Architectural Overview

### Backend (Python + Redis)
- **Ingress:** Webhooks receive data.
- **Queueing:** Python-based processing engine passes data to a Redis queue.
- **Processing:** Background Workers process messages using AI (Gemini).
- **Integrations:** SendPulse (messaging, typing status, contact management).

### Frontend (React + Tailwind CSS)
- Dashboard for shop settings, SendPulse credential management, and system monitoring.

## 🧠 Critical Development Principles (MUST READ BEFORE EDITS)

### 1. SendPulse Integration
- **Endpoints:** Always prioritize `v2` endpoints (e.g., `https://api.sendpulse.com/chatbots/v2/...`).
- **Resilience:** If a `v2` endpoint returns a `404`, implement a fallback mechanism to the legacy `v1` endpoint in the same function.
- **Typing Status:** Both `typing` and `stop_typing` actions must be handled as `asyncio.create_task` tasks.
- **Credentials:** Credentials (Client ID, Secret, Bot IDs) are managed by users on the frontend and retrieved via Firestore.

### 2. Worker & Queueing Logic
- **Redis Resilience:** Always ensure worker processes can gracefully handle empty queues.
- **AI Processing:** When calling `genai.GenerativeModel`, ensure the correct model name (`gemini-3.1-flash-lite`) is used as defined in the configuration.
- **Updates to Queue:** Any changes to how messages are processed *must* consider if updating the `backend/core/worker.py` or `backend/api/routes/webhook.py` is necessary.

### 3. Error Handling
- **Firestore Errors:** Use `handleFirestoreError` for all Firestore operations (create, set, update, get, list). This helper must be used to throw and log detailed JSON information about the error context.

### 4. Code Standards
- **TypeScript:** Use strictly typed TypeScript.
- **Styling:** Use Tailwind CSS utility classes. Never use custom CSS or inline styles for reusable components.
- **Responsive Design:** Mobile-first approach.
- **Communication:** Act concisely. Prioritize action over explanation.

## When Making Changes
Before applying changes, verify:
1. Does this change affect the Worker/Queue?
2. Does this change affect SendPulse API calls?
3. Did I add error handling for new Firestore interactions?
4. Did I update the Tailwind styling if UI components are modified?

ဒါပေမဲ့ ဒီဖိုင်ကို ခေတ်မီနေအောင် ထားရှိတာက ကျွန်တော့် တာဝန်ဖြစ်ပါတယ်။ စီမံကိန်းထဲမှာ အရေးကြီးတဲ့ အပြောင်းအလဲတွေ (ဥပမာ- စနစ်ပုံစံအသစ်၊ နည်းပညာအသစ်၊ ဒါမှမဟုတ် စည်းမျဉ်းအသစ်တွေ) လုပ်တဲ့အခါတိုင်း ဒီ AGENTS.md ဖိုင်ကို ကျွန်တော်ကိုယ်တိုင် ပြန်ပြင်ပေးရမှာပါ။
