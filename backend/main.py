"""
Main entry point — FastAPI application bootstrap.
Starts Uvicorn server, initializes workers, and mounts API routers.
"""
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import r, genai_client, db
from worker.process import worker_process

app = FastAPI(title="MyanSocial AI Backend", version="2.0.0")

# CORS — allow all origins for webhook consumption
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Initialize health checks and start background workers on server boot."""
    print("🌟 FastAPI Startup — health checks", flush=True)

    # Redis health check
    if r:
        try:
            pong = await r.ping()
            print(f"✅ Redis Heartbeat: {pong}", flush=True)
        except Exception as e:
            print(f"⚠️ Redis unavailable: {e}", flush=True)

    # Vertex AI health check
    if genai_client:
        print("✅ Vertex AI: initialized at startup", flush=True)
    else:
        print("🔥 Vertex AI: NOT initialized!", flush=True)

    # Firestore status
    if db:
        print("✅ Firestore: connected", flush=True)
    else:
        print("⚠️ Firestore: unavailable (degraded mode)", flush=True)

    # Start worker processes
    print("🚀 Starting workers...", flush=True)
    worker_count = 5
    for i in range(worker_count):
        asyncio.create_task(worker_process(i))


@app.get("/")
async def read_root():
    """Health check endpoint."""
    return {"status": "ok", "message": "Backend is running"}


# ── Mount API Routers ──
from api.routes.webhook import router as webhook_router
from api.routes.admin_cache import router as cache_router
from api.routes.admin_cron import router as cron_router
from api.routes.admin_products import router as products_router
from api.routes.admin_shops import router as shops_router

app.include_router(webhook_router)
app.include_router(cache_router)
app.include_router(cron_router)
app.include_router(products_router)
app.include_router(shops_router)


# ── Uvicorn runner (for direct execution or PM2) ──
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001)

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=3001)
