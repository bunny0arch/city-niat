"""Gemma-powered workflow command planning service."""

from __future__ import annotations

import json
import re
from typing import Any
from urllib import error as urlerror
from urllib import request as urlrequest

from app.config import settings


class AIPlannerError(RuntimeError):
    """Raised when the model cannot produce a safe operation proposal."""


def _extract_json(text: str) -> dict[str, Any]:
    cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        value = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            raise AIPlannerError("Gemma returned a response that was not valid JSON.") from exc
        try:
            value = json.loads(match.group(0))
        except json.JSONDecodeError as nested_exc:
            raise AIPlannerError("Gemma returned malformed JSON.") from nested_exc
    if not isinstance(value, dict):
        raise AIPlannerError("Gemma returned the wrong JSON shape.")
    return value


def _prompt(goal: str, brief: str | None, tasks: list[dict[str, Any]], edges: list[dict[str, Any]], command: str) -> str:
    task_context = [
        {
            "id": task["id"],
            "title": task["title"],
            "status": task["status"],
            "priority": task["priority"],
            "category": task["category"],
            "owner": task["owner"],
            "position": task["position"],
        }
        for task in tasks
    ]
    edge_context = [{"id": edge["id"], "source": edge["source"], "target": edge["target"]} for edge in edges]
    return f"""You are the workflow operations engine for MissionControl AI.
Interpret the user's command as a targeted edit to the existing event execution graph.
Never regenerate or delete unrelated work. Do not invent factual event data.

MISSION GOAL:
{goal}

BRIEF:
{brief or 'No brief provided.'}

CURRENT TASKS:
{json.dumps(task_context, ensure_ascii=False)}

CURRENT EDGES (source -> target means target depends on source):
{json.dumps(edge_context, ensure_ascii=False)}

USER COMMAND:
{command}

Return ONLY valid JSON in this exact shape:
{{
  "operations": [
    {{"op":"add_node","task":{{"title":"...","description":"...","status":"pending","priority":"medium","category":"operations","owner":"Unassigned","eta":"TBD","position":{{"x":100,"y":100}},"source_refs":[],"subtasks_total":0}}}},
    {{"op":"update_node","task_id":"existing-id","changes":{{"title":"..."}}}},
    {{"op":"remove_node","task_id":"existing-id"}},
    {{"op":"add_edge","source":"existing-id","target":"existing-id"}},
    {{"op":"remove_edge","edge_id":"existing-edge-id"}},
    {{"op":"move_node","task_id":"existing-id","position":{{"x":100,"y":100}}}}
  ],
  "rationale":"one concise explanation"
}}

Rules:
- Use only the six operation names shown above.
- Use existing IDs exactly when referring to existing tasks or edges.
- Keep operations minimal and targeted.
- A -> B means B depends on A.
- Never add self-edges, duplicate edges, cycles, or references to unknown IDs.
- Allowed status: pending, in_progress, completed, blocked.
- Allowed priority: low, medium, high, critical.
- Allowed category: venue, speakers, marketing, operations, budget.
"""


def propose_operations(*, goal: str, brief: str | None, tasks: list[dict[str, Any]], edges: list[dict[str, Any]], command: str) -> dict[str, Any]:
    if not settings.GEMINI_API_KEY:
        raise AIPlannerError("GEMINI_API_KEY is not configured for the backend.")

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
    )
    body = {
        "contents": [{"parts": [{"text": _prompt(goal, brief, tasks, edges, command)}]}],
        "generationConfig": {"temperature": 0.15, "maxOutputTokens": 4096},
    }
    request = urlrequest.Request(url, data=json.dumps(body).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urlrequest.urlopen(request, timeout=120) as raw_response:
            response = json.loads(raw_response.read().decode("utf-8"))
    except urlerror.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise AIPlannerError(f"Gemma request failed ({exc.code}): {detail[:500]}") from exc
    except (urlerror.URLError, TimeoutError) as exc:
        raise AIPlannerError(f"Gemma request failed: {exc}") from exc

    parts = response.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    text = "\n".join(part.get("text", "") for part in parts if not part.get("thought")).strip()
    if not text:
        raise AIPlannerError("Gemma returned an empty response.")
    result = _extract_json(text)
    operations = result.get("operations")
    if not isinstance(operations, list) or not operations:
        raise AIPlannerError("Gemma did not return any graph operations.")
    if len(operations) > 30:
        raise AIPlannerError("Gemma returned too many graph operations.")
    return {"operations": operations, "rationale": str(result.get("rationale", "")), "model": settings.GEMINI_MODEL}
