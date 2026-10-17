"""Application configuration module."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Base paths
BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent

# Load .env if present in backend or root
load_dotenv(BACKEND_DIR / ".env")
load_dotenv(ROOT_DIR / ".env")


class Settings:
    PROJECT_NAME: str = "MissionControl AI API"
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "true").lower() in ("1", "true", "yes")

    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    # CORS configuration
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
        ).split(",")
        if origin.strip()
    ]

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", f"sqlite:///{BACKEND_DIR / 'missioncontrol.db'}"
    )

    # AI Integration placeholder
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemma-4")


settings = Settings()
