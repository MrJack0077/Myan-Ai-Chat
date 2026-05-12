import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from core.worker import worker_process
from api.routes import webhook, shops, cache, cron, products

load_dotenv()

print("👋 hi from Myan-Ai-Chat backend!", flush=True)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    print("🌟 FastAPI Startup event firing... starting health checks", flush=True)
    from utils import r, gm_key
    if r:
        try:
            ping = await r.ping()
            print(f"✅ Redis Heartbeat: {ping}", flush=True)
        except Exception as e:
            print(f"❌ Redis Heartbeat FAILED: {e}", flush=True)
    else:
        print("⚠️ Redis NOT initialized (r is None)", flush=True)
    
    if gm_key:
        print(f"✅ Gemini API Key found (starts with {gm_key[:4]}...)", flush=True)
    else:
        print("❌ Gemini API Key NOT FOUND!", flush=True)

    print("🚀 Starting workers...", flush=True)
    for i in range(5):
        asyncio.create_task(worker_process(i))

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Backend is running"}

# Include API Routers
app.include_router(webhook.router)
app.include_router(shops.router)
app.include_router(cache.router)
app.include_router(cron.router)
app.include_router(products.router)

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=3001)
