import logging
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from app.api.endpoints import router
from app.core.config import settings

# ─── Structured Logging ───
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("optimus.main")


# ─── Rate Limiter (in-memory, per-IP) ───
class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory rate limiter: max N requests per minute per IP."""

    def __init__(self, app, max_requests: int = 100, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()

        # Prune old entries
        self._hits[client_ip] = [t for t in self._hits[client_ip] if now - t < self.window]

        if len(self._hits[client_ip]) >= self.max_requests:
            logger.warning(f"Rate limit exceeded for {client_ip}")
            return Response(
                content='{"detail":"Rate limit exceeded. Try again later."}',
                status_code=429,
                media_type="application/json",
            )

        self._hits[client_ip].append(now)
        return await call_next(request)


# ─── Request Timing Middleware ───
class TimingMiddleware(BaseHTTPMiddleware):
    """Logs every request with method, path, status code, and duration."""

    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000

        # Skip noisy healthcheck logs
        if request.url.path not in ("/", "/api/v1/health"):
            logger.info(
                f"{request.method} {request.url.path} → {response.status_code} ({elapsed_ms:.0f}ms)"
            )

        return response


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
    from app.services.autonomous_executor import (
        run_autonomous_bid_optimization,
        auto_conclude_experiments,
        auto_negate_wasteful_keywords,
        auto_advance_rollouts,
    )
    from app.services.notifications import notification_service, NotificationPayload

    scheduler = AsyncIOScheduler()

    # —— Nightly jobs (run at 02:00 UTC) — data preparation ——
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

    # —— Autonomous Executor (run at 03:00 UTC after data is fresh) ——
    async def _run_autonomous_cycle():
        """Full autonomous cycle: optimize bids, negate waste, conclude experiments, advance rollouts."""
        logger.info("🤖 Starting full autonomous cycle...")
        bid_result = await run_autonomous_bid_optimization()
        negate_result = await auto_negate_wasteful_keywords()
        exp_concluded = await auto_conclude_experiments()
        rollouts_advanced = await auto_advance_rollouts()

        # Send daily digest notification
        digest = {
            "auto_applied": bid_result.get("auto_applied", 0) if isinstance(bid_result, dict) else 0,
            "notified": bid_result.get("notified", 0) if isinstance(bid_result, dict) else 0,
            "queued": bid_result.get("queued", 0) if isinstance(bid_result, dict) else 0,
            "keywords_negated": negate_result.get("negated", 0) if isinstance(negate_result, dict) else 0,
            "experiments_concluded": exp_concluded,
            "rollouts_advanced": rollouts_advanced,
        }
        await notification_service.send_daily_digest(digest)
        logger.info(f"🤖 Autonomous cycle complete: {digest}")

    scheduler.add_job(
        _run_autonomous_cycle,
        CronTrigger(hour=3, minute=0),
        id="autonomous_cycle",
        name="Autonomous Optimization Cycle",
    )

    # —— Experiment & rollout checks every 4 hours ——
    scheduler.add_job(
        auto_conclude_experiments,
        IntervalTrigger(hours=4),
        id="experiment_check",
        name="Experiment Auto-Conclusion Check",
    )
    scheduler.add_job(
        auto_advance_rollouts,
        IntervalTrigger(hours=4),
        id="rollout_check",
        name="Rollout Auto-Advancement Check",
    )

    # —— Runs every 4 hours ——
    scheduler.add_job(
        compute_budget_pacing,
        IntervalTrigger(hours=4),
        id="budget_pacing",
        name="Budget Pacing",
    )
    
    from app.services.predictive_alerts import generate_predictive_alerts
    scheduler.add_job(
        generate_predictive_alerts,
        IntervalTrigger(hours=4),
        id="predictive_alerts",
        name="Predictive Alerts Engine",
    )

    scheduler.start()
    app.state.scheduler = scheduler  # Store for health check access
    logger.info("🚀 APScheduler started with %d jobs", len(scheduler.get_jobs()))

    yield  # app is running

    scheduler.shutdown()
    logger.info("🛑 APScheduler shut down.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI-powered Amazon advertising optimization platform",
    version="2.1.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# ─── Middleware Stack (order matters: outermost first) ───
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware, max_requests=100, window_seconds=60)
app.add_middleware(TimingMiddleware)

# Include routers
from app.api.semantic import router as semantic_router

app.include_router(router)
app.include_router(semantic_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    return {
        "message": "Optimus Pryme API",
        "version": "2.1.0",
        "docs": "/docs",
        "health": "/api/v1/health",
    }

