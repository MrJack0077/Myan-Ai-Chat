import os
import google.generativeai as genai
import redis.asyncio as aioredis
from google.cloud import firestore
from dotenv import load_dotenv

load_dotenv()
try:
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '..', '.env'))
except:
    pass

gm_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("VITE_GEMINI_API_KEY")
if gm_key:
    genai.configure(api_key=gm_key)
    print(f"✅ DEBUG: GEMINI_API_KEY found")
else:
    print("❌ DEBUG: GEMINI_API_KEY NOT FOUND!")

# Try Vertex AI init (optional — falls back to AI Studio if fails)
_vertex_available = False
try:
    import vertexai
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT", "myanaichat")
    location = os.getenv("VERTEX_AI_LOCATION", "us-east4")
    vertexai.init(project=project_id, location=location)
    _vertex_available = True
    print(f"✅ Vertex AI initialized: {project_id}/{location}")
except Exception as e:
    print(f"⚠️ Vertex AI not available — using AI Studio fallback: {e}")

BASE_MODEL_NAME = os.getenv("BASE_MODEL_NAME", "models/gemini-3.1-flash-lite-preview")
FAST_MODEL_NAME = os.getenv("FAST_MODEL_NAME", "models/gemini-3.1-flash-lite-preview")
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "models/gemini-embedding-2-preview")


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
        
        url = f"redis://:{redis_pass}@{redis_host}:{redis_port}/{redis_db}" if redis_pass else f"redis://{redis_host}:{redis_port}/{redis_db}"
        r = aioredis.from_url(url, decode_responses=True)
except Exception as e:
    print(f"🔥 Redis Error: {e}")
