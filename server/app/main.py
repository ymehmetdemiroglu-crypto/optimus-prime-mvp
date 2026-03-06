from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import router
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI-powered Amazon advertising optimization platform",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
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
        "docs": "/docs",
        "health": "/api/health"
    }
