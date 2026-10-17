"""Vercel adapter for the existing MissionControl FastAPI application."""

import os
import shutil
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"
TMP_DATABASE = Path("/tmp/missioncontrol.db")
SOURCE_DATABASE = BACKEND_ROOT / "missioncontrol.db"

# Vercel's deployment filesystem is read-only. Keep the existing SQLite-backed
# behavior available in the ephemeral function filesystem for live previews.
if "DATABASE_URL" not in os.environ:
    if SOURCE_DATABASE.exists() and not TMP_DATABASE.exists():
        shutil.copyfile(SOURCE_DATABASE, TMP_DATABASE)
    os.environ["DATABASE_URL"] = f"sqlite:///{TMP_DATABASE}"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.main import app  # noqa: E402

__all__ = ["app"]
