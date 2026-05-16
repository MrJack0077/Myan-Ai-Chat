"""
Application configuration: env, Redis, Firestore, Vertex AI, AI Studio.
Single source of truth for all clients and model names.
"""
import os
import redis.asyncio as aioredis
from google.cloud import firestore
from dotenv import load_dotenv

# ── Load .env from multiple possible locations ──
load_dotenv()
for alt in [
    os.path.join(os.path.dirname(__file__), '.env'),
    os.path.join(os.path.dirname(__file__), '..', '.env'),
]:
    try:
        if os.path.exists(alt):
            load_dotenv(alt)
    except Exception:
        pass

# ── Vertex AI (Mandatory - Chat/LLM) ──
genai_client = None
try:
    from google import genai as google_genai
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT", "myanaichat").strip()
    location = os.getenv("VERTEX_AI_LOCATION", "us-east4").strip()
    genai_client = google_genai.Client(vertexai=True, project=project_id, location=location)
    print(f"✅ Vertex AI initialized: {project_id}/{location}", flush=True)
except Exception as e:
    print(f"🔥 Vertex AI init FAILED: {e}", flush=True)
    raise RuntimeError(f"Vertex AI is required: {e}")

# ── AI Studio Client (Optional - Embeddings) ──
studio_client = None
try:
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    if gemini_key:
        studio_client = google_genai.Client(api_key=gemini_key)
        print("✅ AI Studio client ready (embeddings)", flush=True)
except Exception as e:
    print(f"⚠️ AI Studio init failed (non-critical): {e}", flush=True)

# ── Model Names ──
BASE_MODEL_NAME = os.getenv("BASE_MODEL_NAME", "gemini-3.1-flash-lite").strip()
FAST_MODEL_NAME = os.getenv("FAST_MODEL_NAME", "gemini-3.1-flash-lite").strip()
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "text-embedding-004").strip()

# ── Firestore ──
db = None
sa_path = os.getenv("SERVICE_ACCOUNT_PATH")
if not sa_path or not os.path.exists(sa_path):
    for name in ["serviceAccount.json", "service-account.json",
                 "backend/serviceAccount.json", "../serviceAccount.json"]:
        full = os.path.abspath(os.path.join(os.getcwd(), name))
        if os.path.exists(full):
            sa_path = full
            break

if sa_path and os.path.exists(sa_path):
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = sa_path

try:
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT", "myanaichat").strip()
    try:
        db = firestore.Client(project=project_id)
    except Exception:
        db = firestore.Client()
    print("✅ Firestore client ready", flush=True)
except Exception as e:
    print(f"🔥 Firestore Error: {e}", flush=True)

# ── Redis ──
r = None
try:
    redis_host = str(os.getenv('REDIS_HOST', 'localhost')).strip().strip('"').strip("'").lower()
    if redis_host not in ('none', 'false', '', 'null'):
        redis_port = str(os.getenv('REDIS_PORT', '6379')).strip().strip('"').strip("'")
        redis_db = str(os.getenv('REDIS_DB', '0')).strip().strip('"').strip("'")
        redis_pass = os.getenv('REDIS_PASSWORD')
        redis_pass_val = redis_pass.strip().strip('"').strip("'") if redis_pass else ""
        if redis_pass_val:
            url = f"redis://:{redis_pass_val}@{redis_host}:{redis_port}/{redis_db}"
        else:
            url = f"redis://{redis_host}:{redis_port}/{redis_db}"
        r = aioredis.from_url(url, decode_responses=True, protocol=2)
        print(f"✅ Redis connected: {redis_host}:{redis_port}", flush=True)
except Exception as e:
    print(f"⚠️ Redis unavailable (degraded mode): {e}", flush=True)
