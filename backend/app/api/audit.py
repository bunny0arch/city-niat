"""Workspace audit trail endpoints."""

from __future__ import annotations
import json
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from app.db.database import get_db_connection, record_audit

router = APIRouter(prefix="/audit", tags=["Audit log"])

class AuditEventRequest(BaseModel):
    event_type: str = Field(min_length=1, max_length=40)
    action: str = Field(min_length=1, max_length=120)
    details: dict = Field(default_factory=dict)

@router.post("/events", status_code=201)
def create_audit_event(payload: AuditEventRequest, x_workspace_user: str = Header("anonymous")):
    user = x_workspace_user.strip()[:180] or "anonymous"
    record_audit(user, payload.event_type, payload.action, payload.details)
    return {"status": "recorded"}

@router.get("")
def list_audit_events(limit: int = 100, x_workspace_user: str = Header("anonymous")):
    if limit < 1 or limit > 500:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 500")
    conn = get_db_connection()
    try:
        rows = conn.execute(
            "SELECT id, workspace_user, event_type, action, details, created_at FROM audit_log ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [
            {
                "id": row["id"],
                "workspace_user": row["workspace_user"],
                "event_type": row["event_type"],
                "action": row["action"],
                "details": json.loads(row["details"] or "{}"),
                "created_at": row["created_at"],
            }
            for row in rows
        ]
    finally:
        conn.close()
