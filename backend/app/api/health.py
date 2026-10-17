"""Health check API router."""

from datetime import datetime, timezone
from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(tags=["Health"])


class HealthResponse(BaseModel):
    status: str = Field(default="ok", description="Service status indicator")
    service: str = Field(default="missioncontrol-backend", description="Service identifier")
    version: str = Field(default="0.1.0", description="API version")
    timestamp: str = Field(description="ISO 8601 UTC timestamp")
    environment: str = Field(default="development", description="Current running environment")


@router.get("/health", response_model=HealthResponse, summary="Service Health Check")
async def get_health() -> HealthResponse:
    """Return current service health and operational status."""
    return HealthResponse(
        status="ok",
        service="missioncontrol-backend",
        version="0.1.0",
        timestamp=datetime.now(timezone.utc).isoformat(),
        environment="development",
    )
