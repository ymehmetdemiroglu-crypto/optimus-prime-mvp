import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import router
from app.core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup/shutdown events for FastAPI, including the background scheduler."""
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger
    from apscheduler.triggers.interval import IntervalTrigger
    from app.services.jobs import (
        run_daily_optimization_models,
        compute_keyword_health_scores,
        discover_negative_keywords,
        compute_budget_pacing,
    )

    scheduler = AsyncIOScheduler()

    # —— Nightly jobs (run at 02:00 UTC) ——
    scheduler.add_job(
        run_daily_optimization_models,
        CronTrigger(hour=2, minute=0),
        id="daily_optimization",
        name="Daily Optimization Models",
    )
    scheduler.add_job(
        compute_keyword_health_scores,
        CronTrigger(hour=2, minute=15),
        id="keyword_health",
        name="Keyword Health Scores",
    )
    scheduler.add_job(
        discover_negative_keywords,
        CronTrigger(hour=2, minute=30),
        id="negative_keywords",
        name="Negative Keyword Discovery",
    )

    # —— Runs every 4 hours ——
    scheduler.add_job(
        compute_budget_pacing,
        IntervalTrigger(hours=4),
        id="budget_pacing",
        name="Budget Pacing",
    )

    scheduler.start()
    logger.info("🚀 APScheduler started with %d jobs", len(scheduler.get_jobs()))

    yield  # app is running

    scheduler.shutdown()
    logger.info("🛑 APScheduler shut down.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI-powered Amazon advertising optimization platform",
    version="2.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
from app.api.semantic import router as semantic_router

app.include_router(router)
app.include_router(semantic_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    return {
        "message": "Grok AdMaster API",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/api/health"
    }
