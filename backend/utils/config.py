import os
import redis.asyncio as aioredis
from google.cloud import firestore
from dotenv import load_dotenv

load_dotenv()
try:
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '..', '.env'))
except:
    pass

# ── Vertex AI (Mandatory) ──
try:
    import vertexai
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT", "myanaichat")
    location = os.getenv("VERTEX_AI_LOCATION", "us-east4")
    vertexai.init(project=project_id, location=location)
    print(f"✅ Vertex AI initialized: {project_id}/{location}")
except Exception as e:
    print(f"🔥 Vertex AI init FAILED: {e}")
    raise RuntimeError(f"Vertex AI is required: {e}")

# ── Model Names (Vertex AI format — no 'models/' prefix) ──
BASE_MODEL_NAME = os.getenv("BASE_MODEL_NAME", "gemini-2.5-flash-lite")
FAST_MODEL_NAME = os.getenv("FAST_MODEL_NAME", "gemini-2.5-flash-lite")
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "text-embedding-004")


sa_path = os.getenv("SERVICE_ACCOUNT_PATH")
if not sa_path or not os.path.exists(sa_path):
    for name in ["serviceAccount.json", "service-account.json", "backend/serviceAccount.json", "../serviceAccount.json"]:
        full_path = os.path.abspath(os.path.join(os.getcwd(), name))
        if os.path.exists(full_path):
            sa_path = full_path
            break

if sa_path and os.path.exists(sa_path):
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = sa_path

db = None
try:
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT", "myanaichat")
    try:
        db = firestore.Client(project=project_id)
    except Exception:
        db = firestore.Client()
except Exception as e:
    print(f"🔥 Firestore Error: {e}")

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
except Exception as e:
    print(f"🔥 Redis Error: {e}")
