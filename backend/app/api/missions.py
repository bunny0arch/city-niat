"""Missions and workflow graph API router."""

import json
import uuid
from datetime import datetime, timezone
from typing import List, Dict
from fastapi import APIRouter, HTTPException, Path as PathParam, status

from app.db.database import get_db_connection, seed_sample_mission
from app.schemas.mission import (
    MissionSummary,
    MissionDetail,
    CreateMissionRequest,
    UpdateMissionRequest,
    TaskNode,
    CreateTaskRequest,
    UpdateTaskRequest,
    DependencyEdge,
    CreateEdgeRequest,
    BatchUpdatePositionsRequest,
    Position,
)
from app.services.graph_service import detect_cycle_with_new_edge

router = APIRouter(prefix="/missions", tags=["Missions"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("", response_model=List[MissionSummary], summary="List all missions")
def list_missions():
    """Retrieve all event planning missions."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT m.id, m.goal, m.brief, m.created_at, m.updated_at,
                   COUNT(t.id) as task_count
            FROM missions m
            LEFT JOIN tasks t ON m.id = t.mission_id
            GROUP BY m.id
            ORDER BY m.created_at DESC
            """
        )
        rows = cursor.fetchall()
        return [
            MissionSummary(
                id=r["id"],
                goal=r["goal"],
                brief=r["brief"],
                task_count=r["task_count"],
                created_at=r["created_at"],
                updated_at=r["updated_at"],
            )
            for r in rows
        ]
    finally:
        conn.close()


@router.post("", response_model=MissionDetail, status_code=status.HTTP_201_CREATED, summary="Create a new mission")
def create_mission(payload: CreateMissionRequest):
    """Create a new mission from an event goal and brief."""
    conn = get_db_connection()
    now_ts = _now()
    mission_id = f"mission-{uuid.uuid4().hex[:8]}"

    try:
        with conn:
            conn.execute(
                """
                INSERT INTO missions (id, goal, brief, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (mission_id, payload.goal, payload.brief, now_ts, now_ts),
            )
        return get_mission(mission_id)
    finally:
        conn.close()


@router.get("/{mission_id}", response_model=MissionDetail, summary="Get full mission graph")
def get_mission(mission_id: str = PathParam(..., description="Mission ID")):
    """Retrieve full mission with all tasks, positions, and dependency edges."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM missions WHERE id = ?", (mission_id,))
        m_row = cursor.fetchone()
        if not m_row:
            raise HTTPException(status_code=404, detail=f"Mission '{mission_id}' not found.")

        # Fetch edges first to compute incoming dependencies per task
        cursor.execute(
            "SELECT id, mission_id, source_task_id, target_task_id, created_at FROM dependencies WHERE mission_id = ?",
            (mission_id,),
        )
        edge_rows = cursor.fetchall()
        edges: List[DependencyEdge] = []
        task_deps: Dict[str, List[str]] = {}

        for er in edge_rows:
            edge = DependencyEdge(
                id=er["id"],
                mission_id=er["mission_id"],
                source=er["source_task_id"],
                target=er["target_task_id"],
                created_at=er["created_at"],
            )
            edges.append(edge)
            task_deps.setdefault(edge.target, []).append(edge.source)

        # Fetch tasks
        cursor.execute("SELECT * FROM tasks WHERE mission_id = ? ORDER BY created_at ASC", (mission_id,))
        task_rows = cursor.fetchall()
        tasks: List[TaskNode] = []

        for tr in task_rows:
            source_refs_raw = tr["source_refs"]
            source_refs = json.loads(source_refs_raw) if source_refs_raw else []

            task = TaskNode(
                id=tr["id"],
                mission_id=tr["mission_id"],
                title=tr["title"],
                description=tr["description"],
                status=tr["status"],
                priority=tr["priority"],
                category=tr["category"],
                owner=tr["owner"],
                eta=tr["eta"],
                position=Position(x=tr["position_x"], y=tr["position_y"]),
                source_refs=source_refs,
                dependencies=task_deps.get(tr["id"], []),
                subtasks_completed=tr["subtasks_completed"],
                subtasks_total=tr["subtasks_total"],
                created_at=tr["created_at"],
                updated_at=tr["updated_at"],
            )
            tasks.append(task)

        return MissionDetail(
            id=m_row["id"],
            goal=m_row["goal"],
            brief=m_row["brief"],
            tasks=tasks,
            edges=edges,
            created_at=m_row["created_at"],
            updated_at=m_row["updated_at"],
        )
    finally:
        conn.close()


@router.put("/{mission_id}", response_model=MissionSummary, summary="Update mission metadata")
def update_mission(payload: UpdateMissionRequest, mission_id: str = PathParam(...)):
    """Update goal and/or brief for a mission."""
    conn = get_db_connection()
    now_ts = _now()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM missions WHERE id = ?", (mission_id,))
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail=f"Mission '{mission_id}' not found.")

        goal = payload.goal if payload.goal is not None else existing["goal"]
        brief = payload.brief if payload.brief is not None else existing["brief"]

        with conn:
            conn.execute(
                "UPDATE missions SET goal = ?, brief = ?, updated_at = ? WHERE id = ?",
                (goal, brief, now_ts, mission_id),
            )

        cursor.execute("SELECT COUNT(*) as count FROM tasks WHERE mission_id = ?", (mission_id,))
        task_count = cursor.fetchone()["count"]

        return MissionSummary(
            id=mission_id,
            goal=goal,
            brief=brief,
            task_count=task_count,
            created_at=existing["created_at"],
            updated_at=now_ts,
        )
    finally:
        conn.close()


@router.delete("/{mission_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete mission")
def delete_mission(mission_id: str = PathParam(...)):
    """Delete a mission and all its cascading tasks and edges."""
    conn = get_db_connection()
    try:
        with conn:
            cursor = conn.execute("DELETE FROM missions WHERE id = ?", (mission_id,))
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail=f"Mission '{mission_id}' not found.")
    finally:
        conn.close()


@router.post("/{mission_id}/tasks", response_model=TaskNode, status_code=status.HTTP_201_CREATED, summary="Add task node")
def add_task(payload: CreateTaskRequest, mission_id: str = PathParam(...)):
    """Create a task node in the mission graph."""
    conn = get_db_connection()
    now_ts = _now()
    task_id = payload.id or f"task-{uuid.uuid4().hex[:6]}"
    pos_x = payload.position.x if payload.position else 200.0
    pos_y = payload.position.y if payload.position else 200.0

    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM missions WHERE id = ?", (mission_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail=f"Mission '{mission_id}' not found.")

        # Ensure task_id unique
        cursor.execute("SELECT id FROM tasks WHERE id = ?", (task_id,))
        if cursor.fetchone():
            task_id = f"task-{uuid.uuid4().hex[:6]}"

        with conn:
            conn.execute(
                """
                INSERT INTO tasks (
                    id, mission_id, title, description, status, priority, category,
                    owner, eta, position_x, position_y, source_refs,
                    subtasks_completed, subtasks_total, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    task_id,
                    mission_id,
                    payload.title,
                    payload.description,
                    payload.status,
                    payload.priority,
                    payload.category,
                    payload.owner,
                    payload.eta,
                    pos_x,
                    pos_y,
                    json.dumps(payload.source_refs),
                    payload.subtasks_completed,
                    payload.subtasks_total,
                    now_ts,
                    now_ts,
                ),
            )
            # Update mission updated_at
            conn.execute("UPDATE missions SET updated_at = ? WHERE id = ?", (now_ts, mission_id))

        return TaskNode(
            id=task_id,
            mission_id=mission_id,
            title=payload.title,
            description=payload.description,
            status=payload.status,
            priority=payload.priority,
            category=payload.category,
            owner=payload.owner,
            eta=payload.eta,
            position=Position(x=pos_x, y=pos_y),
            source_refs=payload.source_refs,
            dependencies=[],
            subtasks_completed=payload.subtasks_completed,
            subtasks_total=payload.subtasks_total,
            created_at=now_ts,
            updated_at=now_ts,
        )
    finally:
        conn.close()


@router.patch("/{mission_id}/tasks/{task_id}", response_model=TaskNode, summary="Update task node")
def update_task(
    payload: UpdateTaskRequest,
    mission_id: str = PathParam(...),
    task_id: str = PathParam(...),
):
    """Update properties, status, or position of an individual task node."""
    conn = get_db_connection()
    now_ts = _now()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tasks WHERE id = ? AND mission_id = ?", (task_id, mission_id))
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found in mission '{mission_id}'.")

        title = payload.title if payload.title is not None else existing["title"]
        description = payload.description if payload.description is not None else existing["description"]
        task_status = payload.status if payload.status is not None else existing["status"]
        priority = payload.priority if payload.priority is not None else existing["priority"]
        category = payload.category if payload.category is not None else existing["category"]
        owner = payload.owner if payload.owner is not None else existing["owner"]
        eta = payload.eta if payload.eta is not None else existing["eta"]

        pos_x = payload.position.x if payload.position is not None else existing["position_x"]
        pos_y = payload.position.y if payload.position is not None else existing["position_y"]

        source_refs = (
            payload.source_refs
            if payload.source_refs is not None
            else (json.loads(existing["source_refs"]) if existing["source_refs"] else [])
        )
        sub_comp = (
            payload.subtasks_completed
            if payload.subtasks_completed is not None
            else existing["subtasks_completed"]
        )
        sub_tot = (
            payload.subtasks_total
            if payload.subtasks_total is not None
            else existing["subtasks_total"]
        )

        with conn:
            conn.execute(
                """
                UPDATE tasks SET
                    title = ?, description = ?, status = ?, priority = ?, category = ?,
                    owner = ?, eta = ?, position_x = ?, position_y = ?, source_refs = ?,
                    subtasks_completed = ?, subtasks_total = ?, updated_at = ?
                WHERE id = ? AND mission_id = ?
                """,
                (
                    title,
                    description,
                    task_status,
                    priority,
                    category,
                    owner,
                    eta,
                    pos_x,
                    pos_y,
                    json.dumps(source_refs),
                    sub_comp,
                    sub_tot,
                    now_ts,
                    task_id,
                    mission_id,
                ),
            )
            conn.execute("UPDATE missions SET updated_at = ? WHERE id = ?", (now_ts, mission_id))

        # Fetch dependencies
        cursor.execute("SELECT source_task_id FROM dependencies WHERE target_task_id = ?", (task_id,))
        deps = [r["source_task_id"] for r in cursor.fetchall()]

        return TaskNode(
            id=task_id,
            mission_id=mission_id,
            title=title,
            description=description,
            status=task_status,
            priority=priority,
            category=category,
            owner=owner,
            eta=eta,
            position=Position(x=pos_x, y=pos_y),
            source_refs=source_refs,
            dependencies=deps,
            subtasks_completed=sub_comp,
            subtasks_total=sub_tot,
            created_at=existing["created_at"],
            updated_at=now_ts,
        )
    finally:
        conn.close()


@router.delete("/{mission_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete task node")
def delete_task(mission_id: str = PathParam(...), task_id: str = PathParam(...)):
    """Delete a task node and all its connected dependencies."""
    conn = get_db_connection()
    try:
        with conn:
            cursor = conn.execute("DELETE FROM tasks WHERE id = ? AND mission_id = ?", (task_id, mission_id))
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found in mission '{mission_id}'.")
            conn.execute("UPDATE missions SET updated_at = ? WHERE id = ?", (_now(), mission_id))
    finally:
        conn.close()


@router.post("/{mission_id}/edges", response_model=DependencyEdge, status_code=status.HTTP_201_CREATED, summary="Add dependency edge")
def add_edge(payload: CreateEdgeRequest, mission_id: str = PathParam(...)):
    """
    Connect a directed dependency edge from source (predecessor) to target (dependent).
    Validates node existence, rejects self-loops and directed cycles.
    """
    conn = get_db_connection()
    now_ts = _now()
    src = payload.source
    tgt = payload.target

    if src == tgt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Self-dependency rejected: A task cannot depend on itself.",
        )

    try:
        cursor = conn.cursor()
        # Verify both tasks exist in this mission
        cursor.execute("SELECT id FROM tasks WHERE id = ? AND mission_id = ?", (src, mission_id))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Source task '{src}' does not exist in mission '{mission_id}'.",
            )

        cursor.execute("SELECT id FROM tasks WHERE id = ? AND mission_id = ?", (tgt, mission_id))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target task '{tgt}' does not exist in mission '{mission_id}'.",
            )

        # Fetch existing edges to check for cycle and duplicates
        cursor.execute("SELECT source_task_id, target_task_id FROM dependencies WHERE mission_id = ?", (mission_id,))
        existing_pairs = [(r["source_task_id"], r["target_task_id"]) for r in cursor.fetchall()]

        # Check for duplicate
        for s, t in existing_pairs:
            if s == src and t == tgt:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Dependency edge ({src} -> {tgt}) already exists.",
                )

        # Check for cycle
        if detect_cycle_with_new_edge(existing_pairs, src, tgt):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Circular dependency rejected: Adding edge ({src} -> {tgt}) would form a closed cycle in the task graph.",
            )

        edge_id = f"edge-{src}-{tgt}"
        with conn:
            conn.execute(
                """
                INSERT INTO dependencies (id, mission_id, source_task_id, target_task_id, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (edge_id, mission_id, src, tgt, now_ts),
            )
            conn.execute("UPDATE missions SET updated_at = ? WHERE id = ?", (now_ts, mission_id))

        return DependencyEdge(
            id=edge_id,
            mission_id=mission_id,
            source=src,
            target=tgt,
            created_at=now_ts,
        )
    finally:
        conn.close()


@router.delete("/{mission_id}/edges/{edge_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete dependency edge")
def delete_edge(mission_id: str = PathParam(...), edge_id: str = PathParam(...)):
    """Remove a dependency edge."""
    conn = get_db_connection()
    try:
        with conn:
            cursor = conn.execute("DELETE FROM dependencies WHERE id = ? AND mission_id = ?", (edge_id, mission_id))
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail=f"Edge '{edge_id}' not found in mission '{mission_id}'.")
            conn.execute("UPDATE missions SET updated_at = ? WHERE id = ?", (_now(), mission_id))
    finally:
        conn.close()


@router.put("/{mission_id}/positions", summary="Batch update node positions")
def update_node_positions(payload: BatchUpdatePositionsRequest, mission_id: str = PathParam(...)):
    """Persist multiple node position changes on canvas drag."""
    conn = get_db_connection()
    now_ts = _now()
    try:
        with conn:
            for task_id, pos in payload.positions.items():
                conn.execute(
                    "UPDATE tasks SET position_x = ?, position_y = ?, updated_at = ? WHERE id = ? AND mission_id = ?",
                    (pos.x, pos.y, now_ts, task_id, mission_id),
                )
            conn.execute("UPDATE missions SET updated_at = ? WHERE id = ?", (now_ts, mission_id))
        return {"status": "ok", "updated_count": len(payload.positions)}
    finally:
        conn.close()


@router.post("/reset-sample", summary="Reset sample demonstrable mission")
def reset_sample():
    """Reset or recreate the standard sample event mission with all tasks and edges."""
    conn = get_db_connection()
    try:
        mission_id = seed_sample_mission(conn)
        return {"status": "ok", "mission_id": mission_id}
    finally:
        conn.close()
