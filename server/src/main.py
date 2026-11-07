"""
FastAPI application for AEO (Answer Engine Optimization) audit tool
Exposes the audit functionality as a REST API
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.brands import router as brands_router
from src.api.competitors import get_comparison_service, router as competitors_router
from src.api.runs import get_service, router as runs_router
from src.services.maintenance import MAINTENANCE_INTERVAL_HOURS, run_maintenance

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runs left pending/running by a previous process can never finish - mark them failed.
    interrupted = get_service().recover_interrupted()
    if interrupted:
        logger.warning("Marked %s interrupted audit run(s) as failed", interrupted)
    stale = get_comparison_service().recover_interrupted()
    if stale:
        logger.warning("Marked %s interrupted competitor audit(s) as failed", stale)

    async def maintenance_loop():
        while True:
            try:
                svc = get_service()
                await asyncio.to_thread(run_maintenance, svc.storage, svc)
            except Exception:
                logger.exception("Maintenance run failed")
            await asyncio.sleep(MAINTENANCE_INTERVAL_HOURS * 3600)

    maintenance = asyncio.create_task(maintenance_loop(), name="store-maintenance")
    try:
        yield
    finally:
        maintenance.cancel()


# FastAPI app
app = FastAPI(
    title="AEO Audit API",
    description="Answer Engine Optimization audit tool for GenAI engines",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(runs_router)
app.include_router(brands_router)
app.include_router(competitors_router)


@app.get("/aeo-audit-tool/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3003)
