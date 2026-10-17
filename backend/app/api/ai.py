"""AI workflow command routes with preview-before-apply semantics."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

import base64
from fastapi import APIRouter, File, Form, Header, HTTPException, Path as PathParam, UploadFile

from app.db.database import get_db_connection
from app.schemas.ai import AIOperationsRequest, AIPreviewResponse, AIApplyResponse, AICommandRequest, AIOperation
from app.services.ai_planner import AIPlannerError, propose_operations
from app.services.graph_service import validate_dag

router = APIRouter(prefix="/missions/{mission_id}/ai", tags=["AI workflow commands"])
ALLOWED_STATUS = {"pending", "in_progress", "completed", "blocked"}
ALLOWED_PRIORITY = {"low", "medium", "high", "critical"}
ALLOWED_CATEGORY = {"venue", "speakers", "marketing", "operations", "budget"}
ALLOWED_CHANGES = {"title", "description", "status", "priority", "category", "owner", "eta", "source_refs", "subtasks_completed", "subtasks_total"}


def _mission_context(mission_id: str, workspace_user: str = "anonymous") -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    conn = get_db_connection()
    try:
        mission = conn.execute("SELECT id, goal, brief FROM missions WHERE id = ? AND owner_id = ?", (mission_id, workspace_user.strip()[:180] or "anonymous")).fetchone()
        if not mission:
            raise HTTPException(status_code=404, detail=f"Mission '{mission_id}' not found.")
        tasks = [dict(row) for row in conn.execute("SELECT id, title, status, priority, category, owner, position_x, position_y FROM tasks WHERE mission_id = ?", (mission_id,)).fetchall()]
        for task in tasks:
            task["position"] = {"x": task.pop("position_x"), "y": task.pop("position_y")}
        edges = [dict(row) for row in conn.execute("SELECT id, source_task_id AS source, target_task_id AS target FROM dependencies WHERE mission_id = ?", (mission_id,)).fetchall()]
        return dict(mission), tasks, edges
    finally:
        conn.close()


def _response(operations: list[dict[str, Any]], rationale: str, model: str, mission_id: str, applied: bool = False):
    task_ids = []
    edge_ids = []
    for operation in operations:
        task_id = operation.get("task_id") or (operation.get("task") or {}).get("id")
        if task_id and task_id not in task_ids:
            task_ids.append(task_id)
        edge_id = operation.get("edge_id")
        if edge_id and edge_id not in edge_ids:
            edge_ids.append(edge_id)
    payload = {"model": model, "rationale": rationale, "operations": operations, "affected_task_ids": task_ids, "affected_edge_ids": edge_ids}
    if applied:
        payload.update({"applied": True, "mission_id": mission_id})
        return AIApplyResponse(**payload)
    return AIPreviewResponse(**payload)


@router.post("/preview", response_model=AIPreviewResponse)
def preview_command(payload: AICommandRequest, mission_id: str = PathParam(...), x_workspace_user: str = Header("anonymous")):
    mission, tasks, edges = _mission_context(mission_id, x_workspace_user)
    try:
        result = propose_operations(goal=mission["goal"], brief=mission.get("brief"), tasks=tasks, edges=edges, command=payload.command)
    except AIPlannerError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return _response(result["operations"], result["rationale"], result["model"], mission_id)


async def _attachments(files: list[UploadFile]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    if len(files) > 8:
        raise HTTPException(status_code=413, detail="Upload up to 8 files at a time.")
    text_context: list[dict[str, Any]] = []
    image_parts: list[dict[str, Any]] = []
    for file in files:
        data = await file.read()
        if len(data) > 12 * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"{file.filename or 'File'} is larger than 12MB.")
        mime = file.content_type or "application/octet-stream"
        name = file.filename or "uploaded file"
        if mime.startswith("image/"):
            image_parts.append({"inline_data": {"mime_type": mime, "data": base64.b64encode(data).decode("ascii")}})
        elif mime == "application/pdf" or name.lower().endswith(".pdf"):
            try:
                from pypdf import PdfReader
                from io import BytesIO
                text = "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(data)).pages)
            except Exception:
                text = "PDF text extraction was unavailable; use the filename and command as planning context."
            text_context.append({"name": name, "text": text[:50000]})
        elif name.lower().endswith(".docx"):
            try:
                from docx import Document
                from io import BytesIO
                text = "\n".join(paragraph.text for paragraph in Document(BytesIO(data)).paragraphs)
            except Exception:
                text = "DOCX text extraction was unavailable; infer only from the filename and user command."
            text_context.append({"name": name, "text": text[:50000]})
        elif name.lower().endswith(".xlsx"):
            try:
                from openpyxl import load_workbook
                from io import BytesIO
                workbook = load_workbook(BytesIO(data), read_only=True, data_only=True)
                text = "\n".join(f"{sheet.title}: " + " | ".join(str(cell.value or "") for row in sheet.iter_rows() for cell in row) for sheet in workbook.worksheets)
            except Exception:
                text = "XLSX text extraction was unavailable; infer only from the filename and user command."
            text_context.append({"name": name, "text": text[:50000]})
        elif name.lower().endswith(".pptx"):
            try:
                from pptx import Presentation
                from io import BytesIO
                presentation = Presentation(BytesIO(data))
                text = "\n".join(shape.text for slide in presentation.slides for shape in slide.shapes if hasattr(shape, "text"))
            except Exception:
                text = "PPTX text extraction was unavailable; infer only from the filename and user command."
            text_context.append({"name": name, "text": text[:50000]})
        else:
            try:
                text_context.append({"name": name, "text": data.decode("utf-8", errors="replace")[:50000]})
            except Exception:
                text_context.append({"name": name, "text": "Binary document attached; infer only from its filename and user command."})
    return text_context, image_parts


@router.post("/preview-with-files", response_model=AIPreviewResponse)
async def preview_command_with_files(command: str = Form(...), files: list[UploadFile] = File(default=[]), mission_id: str = PathParam(...), x_workspace_user: str = Header("anonymous")):
    mission, tasks, edges = _mission_context(mission_id, x_workspace_user)
    attachment_context, image_parts = await _attachments(files)
    try:
        result = propose_operations(goal=mission["goal"], brief=mission.get("brief"), tasks=tasks, edges=edges, command=command, attachments=attachment_context, image_parts=image_parts)
    except AIPlannerError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return _response(result["operations"], result["rationale"], result["model"], mission_id)


def _validate_and_apply(mission_id: str, operations: list[AIOperation]) -> list[dict[str, Any]]:
    conn = get_db_connection()
    now = datetime.now(timezone.utc).isoformat()
    try:
        mission = conn.execute("SELECT id FROM missions WHERE id = ?", (mission_id,)).fetchone()
        if not mission:
            raise HTTPException(status_code=404, detail=f"Mission '{mission_id}' not found.")
        task_rows = conn.execute("SELECT id FROM tasks WHERE mission_id = ?", (mission_id,)).fetchall()
        task_ids = {row["id"] for row in task_rows}
        edge_rows = conn.execute("SELECT id, source_task_id, target_task_id FROM dependencies WHERE mission_id = ?", (mission_id,)).fetchall()
        edges: list[tuple[str, str]] = [(row["source_task_id"], row["target_task_id"]) for row in edge_rows]
        edge_ids = {row["id"] for row in edge_rows}
        occupied_positions = {(round(float(row["position_x"]) / 40), round(float(row["position_y"]) / 40)) for row in conn.execute("SELECT position_x, position_y FROM tasks WHERE mission_id = ?", (mission_id,)).fetchall()}
        normalized: list[dict[str, Any]] = []

        for raw in operations:
            op = raw.model_dump(exclude_none=True)
            kind = op["op"]
            if kind == "add_node":
                task = dict(op.get("task") or {})
                title = str(task.get("title", "")).strip()
                if not title:
                    raise HTTPException(status_code=422, detail="AI add_node requires a task title.")
                task_id = str(task.get("id") or f"task-ai-{uuid.uuid4().hex[:8]}")
                if task_id in task_ids:
                    raise HTTPException(status_code=422, detail=f"AI proposed duplicate task ID '{task_id}'.")
                status = task.get("status", "pending")
                priority = task.get("priority", "medium")
                category = task.get("category", "operations")
                if status not in ALLOWED_STATUS or priority not in ALLOWED_PRIORITY or category not in ALLOWED_CATEGORY:
                    raise HTTPException(status_code=422, detail="AI proposed an invalid task status, priority, or category.")
                # Never trust model-provided coordinates to be collision-free.
                # Allocate a stable grid slot beside the existing graph.
                slot = len(occupied_positions)
                while True:
                    candidate = (slot % 4, slot // 4)
                    if candidate not in occupied_positions:
                        occupied_positions.add(candidate)
                        position = {"x": 100 + candidate[0] * 330, "y": 100 + candidate[1] * 220}
                        break
                    slot += 1
                task_id = task_id
                conn.execute("INSERT INTO tasks (id, mission_id, title, description, status, priority, category, owner, eta, position_x, position_y, source_refs, subtasks_completed, subtasks_total, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", (task_id, mission_id, title, str(task.get("description", "")), status, priority, category, str(task.get("owner", "Unassigned")), str(task.get("eta", "TBD")), float(position.get("x", 0)), float(position.get("y", 0)), json.dumps(task.get("source_refs", [])), int(task.get("subtasks_completed", 0)), int(task.get("subtasks_total", 0)), now, now))
                task_ids.add(task_id)
                normalized.append({"op": "add_node", "task": {**task, "id": task_id, "position": position}})
            elif kind in {"update_node", "move_node", "remove_node"}:
                task_id = op.get("task_id")
                if task_id not in task_ids:
                    raise HTTPException(status_code=422, detail=f"AI referenced unknown task '{task_id}'.")
                if kind == "remove_node":
                    conn.execute("DELETE FROM tasks WHERE id = ? AND mission_id = ?", (task_id, mission_id))
                    task_ids.remove(task_id)
                    edges = [(src, tgt) for src, tgt in edges if src != task_id and tgt != task_id]
                    normalized.append({"op": kind, "task_id": task_id})
                elif kind == "move_node":
                    position = op.get("position") or {}
                    conn.execute("UPDATE tasks SET position_x = ?, position_y = ?, updated_at = ? WHERE id = ? AND mission_id = ?", (float(position.get("x", 0)), float(position.get("y", 0)), now, task_id, mission_id))
                    normalized.append({"op": kind, "task_id": task_id, "position": position})
                else:
                    changes = op.get("changes") or {}
                    invalid = set(changes) - ALLOWED_CHANGES
                    if invalid:
                        raise HTTPException(status_code=422, detail=f"AI proposed unsupported task fields: {', '.join(sorted(invalid))}.")
                    if "status" in changes and changes["status"] not in ALLOWED_STATUS:
                        raise HTTPException(status_code=422, detail="AI proposed an invalid task status.")
                    if "priority" in changes and changes["priority"] not in ALLOWED_PRIORITY:
                        raise HTTPException(status_code=422, detail="AI proposed an invalid task priority.")
                    if "category" in changes and changes["category"] not in ALLOWED_CATEGORY:
                        raise HTTPException(status_code=422, detail="AI proposed an invalid task category.")
                    set_clause = ", ".join(f"{key} = ?" for key in changes)
                    if set_clause:
                        values = [json.dumps(value) if key == "source_refs" else value for key, value in changes.items()]
                        conn.execute(f"UPDATE tasks SET {set_clause}, updated_at = ? WHERE id = ? AND mission_id = ?", [*values, now, task_id, mission_id])
                    normalized.append({"op": kind, "task_id": task_id, "changes": changes})
            elif kind == "add_edge":
                source, target = op.get("source"), op.get("target")
                if source not in task_ids or target not in task_ids:
                    raise HTTPException(status_code=422, detail="AI proposed an edge referencing an unknown task.")
                if (source, target) in edges:
                    raise HTTPException(status_code=422, detail="AI proposed a duplicate dependency.")
                if source == target or validate_dag(list(task_ids), [*edges, (source, target)]):
                    raise HTTPException(status_code=422, detail="AI proposed a dependency cycle or self-connection.")
                edge_id = f"edge-ai-{uuid.uuid4().hex[:8]}"
                conn.execute("INSERT INTO dependencies (id, mission_id, source_task_id, target_task_id, created_at) VALUES (?, ?, ?, ?, ?)", (edge_id, mission_id, source, target, now))
                edges.append((source, target))
                edge_ids.add(edge_id)
                normalized.append({"op": kind, "source": source, "target": target, "edge_id": edge_id})
            elif kind == "remove_edge":
                edge_id = op.get("edge_id")
                edge = next((row for row in edge_rows if row["id"] == edge_id), None)
                if not edge:
                    raise HTTPException(status_code=422, detail=f"AI referenced unknown edge '{edge_id}'.")
                conn.execute("DELETE FROM dependencies WHERE id = ? AND mission_id = ?", (edge_id, mission_id))
                edges = [(src, tgt) for src, tgt in edges if not (src == edge["source_task_id"] and tgt == edge["target_task_id"])]
                normalized.append({"op": kind, "edge_id": edge_id})
            else:
                raise HTTPException(status_code=422, detail=f"Unsupported AI operation '{kind}'.")

        validation_error = validate_dag(list(task_ids), edges)
        if validation_error:
            raise HTTPException(status_code=422, detail=validation_error)
        conn.execute("UPDATE missions SET updated_at = ? WHERE id = ?", (now, mission_id))
        conn.commit()
        return normalized
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@router.post("/apply", response_model=AIApplyResponse)
def apply_operations(payload: AIOperationsRequest, mission_id: str = PathParam(...), x_workspace_user: str = Header("anonymous")):
    _mission_context(mission_id, x_workspace_user)
    normalized = _validate_and_apply(mission_id, payload.operations)
    return _response(normalized, "Applied after explicit operator approval.", "operator-approved", mission_id, applied=True)
