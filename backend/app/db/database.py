"""SQLite database access layer for MissionControl AI."""

import json
import sqlite3
import uuid
from pathlib import Path
from typing import Any, Optional
from datetime import datetime, timezone
from app.config import settings

DB_PATH = Path(settings.DATABASE_URL.replace("sqlite:///", ""))


def get_db_connection() -> sqlite3.Connection:
    """Create and configure a SQLite connection with foreign keys and WAL mode."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn


def init_db() -> None:
    """Initialize database tables and seed sample mission if empty."""
    conn = get_db_connection()
    try:
        with conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS missions (
                    id TEXT PRIMARY KEY,
                    goal TEXT NOT NULL,
                    brief TEXT,
                    owner_id TEXT NOT NULL DEFAULT 'system',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    mission_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    status TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'completed', 'blocked')),
                    priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high', 'critical')),
                    category TEXT NOT NULL CHECK(category IN ('venue', 'speakers', 'marketing', 'operations', 'budget')),
                    owner TEXT NOT NULL,
                    eta TEXT NOT NULL,
                    position_x REAL NOT NULL,
                    position_y REAL NOT NULL,
                    source_refs TEXT,
                    subtasks_completed INTEGER NOT NULL DEFAULT 0,
                    subtasks_total INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS dependencies (
                    id TEXT PRIMARY KEY,
                    mission_id TEXT NOT NULL,
                    source_task_id TEXT NOT NULL,
                    target_task_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE,
                    FOREIGN KEY (source_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                    FOREIGN KEY (target_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                    UNIQUE(mission_id, source_task_id, target_task_id)
                );

                CREATE INDEX IF NOT EXISTS idx_tasks_mission ON tasks(mission_id);
                CREATE INDEX IF NOT EXISTS idx_dependencies_mission ON dependencies(mission_id);
                CREATE TABLE IF NOT EXISTS audit_log (
                    id TEXT PRIMARY KEY,
                    workspace_user TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    action TEXT NOT NULL,
                    details TEXT,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
                """
            )

            columns = {row["name"] for row in conn.execute("PRAGMA table_info(missions)").fetchall()}
            if "owner_id" not in columns:
                conn.execute("ALTER TABLE missions ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'system'")

    finally:
        conn.close()


def record_audit(workspace_user: str, event_type: str, action: str, details: dict[str, Any] | None = None) -> None:
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db_connection()
    try:
        with conn:
            conn.execute(
                "INSERT INTO audit_log (id, workspace_user, event_type, action, details, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (f"audit-{uuid.uuid4().hex[:12]}", workspace_user, event_type, action, json.dumps(details or {}), now),
            )
    finally:
        conn.close()


def seed_sample_mission(conn: sqlite3.Connection, owner_id: str = "system") -> str:
    """Seed a realistic demonstrable event mission with a validated DAG."""
    now = datetime.now(timezone.utc).isoformat()
    mission_id = "mission-techsummit-2026"
    goal = "Execute Global TechSummit 2026"
    brief = "A 3-day premier developer and AI engineering summit with 1,500 expected attendees, 24 speaker tracks, expo booths, and live broadcast."

    with conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO missions (id, goal, brief, owner_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (mission_id, goal, brief, owner_id, now, now),
        )

        sample_tasks = [
            (
                "task-venue",
                mission_id,
                "Venue Contracting & Permits",
                "Execute convention center lease, secure city fire permits, and finalize electrical floor drops.",
                "completed",
                "critical",
                "venue",
                "Elena Rostova",
                "Oct 12 (Done)",
                40.0,
                160.0,
                json.dumps(["Permit Ref #SF-2026-99", "Lease agreement signed Oct 10"]),
                6,
                6,
                now,
                now,
            ),
            (
                "task-speakers",
                mission_id,
                "Keynotes & Panel Curriculum",
                "Curate technical tracks, finalize 6 keynote speakers, and lock slide deck delivery schedules.",
                "in_progress",
                "high",
                "speakers",
                "Marcus Vance",
                "Oct 20 (Active)",
                420.0,
                50.0,
                json.dumps(["Call for Papers Portal", "Speaker confirmation deck v3"]),
                8,
                12,
                now,
                now,
            ),
            (
                "task-sponsors",
                mission_id,
                "Sponsorship & Booth Logistics",
                "Allocate platinum & gold expo booths, review custom booth build specs, and power feeds.",
                "in_progress",
                "medium",
                "budget",
                "Aisha Chen",
                "Oct 22 (Active)",
                420.0,
                290.0,
                json.dumps(["Sponsorship prospectus 2026", "Expo floor diagram rev 4"]),
                4,
                5,
                now,
                now,
            ),
            (
                "task-catering",
                mission_id,
                "VIP & Attendee Catering Logistics",
                "Select catering menus, lock dietary restriction allocations, and finalize water stations.",
                "pending",
                "medium",
                "operations",
                "Sarah Jenkins",
                "Oct 24",
                420.0,
                520.0,
                json.dumps(["Menu tasting notes", "Dietary survey responses"]),
                2,
                4,
                now,
                now,
            ),
            (
                "task-marketing",
                mission_id,
                "Attendee Ticketing & Campaign Launch",
                "Publish speaker line-up, launch early bird registration campaign, and sync event app.",
                "pending",
                "high",
                "marketing",
                "Liam O'Connor",
                "Oct 25",
                820.0,
                50.0,
                json.dumps(["Ticketing gateway Stripe connect", "Ad campaign deck"]),
                3,
                8,
                now,
                now,
            ),
            (
                "task-runbook",
                mission_id,
                "Day-of Technical Runbook & AV Matrix",
                "Synchronize stage cue scripts, wireless mic frequency matrix, and livestream failover routes.",
                "pending",
                "critical",
                "operations",
                "David Kim",
                "Oct 27 (Pending)",
                820.0,
                290.0,
                json.dumps(["AV matrix v2.1", "Run of show minute-by-minute"]),
                1,
                9,
                now,
                now,
            ),
        ]

        conn.executemany(
            """
            INSERT OR REPLACE INTO tasks (
                id, mission_id, title, description, status, priority, category,
                owner, eta, position_x, position_y, source_refs,
                subtasks_completed, subtasks_total, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            sample_tasks,
        )

        sample_edges = [
            ("edge-venue-speakers", mission_id, "task-venue", "task-speakers", now),
            ("edge-venue-sponsors", mission_id, "task-venue", "task-sponsors", now),
            ("edge-venue-catering", mission_id, "task-venue", "task-catering", now),
            ("edge-speakers-marketing", mission_id, "task-speakers", "task-marketing", now),
            ("edge-speakers-runbook", mission_id, "task-speakers", "task-runbook", now),
            ("edge-sponsors-runbook", mission_id, "task-sponsors", "task-runbook", now),
            ("edge-catering-runbook", mission_id, "task-catering", "task-runbook", now),
        ]

        conn.executemany(
            """
            INSERT OR REPLACE INTO dependencies (
                id, mission_id, source_task_id, target_task_id, created_at
            ) VALUES (?, ?, ?, ?, ?)
            """,
            sample_edges,
        )

    return mission_id
