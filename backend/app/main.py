"""Main application entry point for MissionControl AI backend."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.health import router as health_router
from app.api.missions import router as missions_router
from app.api.ai import router as ai_router
from app.api.audit import router as audit_router
from app.db.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database tables without seeding a shared sample mission."""
    init_db()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API service for MissionControl AI event-planning execution workspace.",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Enable CORS for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(health_router, prefix="/api")
app.include_router(missions_router, prefix="/api")
app.include_router(ai_router, prefix="/api")
app.include_router(audit_router, prefix="/api")


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint providing service discovery metadata."""
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs": "/docs",
        "health": "/api/health",
    }
