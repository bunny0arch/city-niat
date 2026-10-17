"""Fast, structured-output workflow planning service."""

from __future__ import annotations

import json
import logging
import re
from typing import Any
from urllib import error as urlerror
from urllib import request as urlrequest

from app.config import settings

logger = logging.getLogger(__name__)


class AIPlannerError(RuntimeError):
    """Raised when the model cannot produce a safe operation proposal."""


_OPERATION_ALIASES = {
    "add_node": "add_node", "add_task": "add_node", "create_node": "add_node", "create_task": "add_node", "new_node": "add_node", "new_task": "add_node",
    "update_node": "update_node", "update_task": "update_node", "edit_node": "update_node", "edit_task": "update_node", "modify_task": "update_node",
    "remove_node": "remove_node", "remove_task": "remove_node", "delete_node": "remove_node", "delete_task": "remove_node",
    "add_edge": "add_edge", "connect": "add_edge", "link": "add_edge", "add_dependency": "add_edge", "create_dependency": "add_edge",
    "remove_edge": "remove_edge", "disconnect": "remove_edge", "unlink": "remove_edge", "remove_dependency": "remove_edge",
    "move_node": "move_node", "move_task": "move_node", "reposition": "move_node", "reposition_task": "move_node",
}
_STATUS_ALIASES = {"planned": "pending", "todo": "pending", "not_started": "pending", "not-started": "pending", "in-progress": "in_progress", "in progress": "in_progress", "done": "completed", "complete": "completed", "cancelled": "blocked"}
_PRIORITY_ALIASES = {"urgent": "critical", "medium-high": "high", "normal": "medium"}
_CATEGORY_ALIASES = {"logistics": "operations", "event": "operations", "general": "operations", "coordination": "operations", "content": "marketing", "catering": "operations", "food": "operations", "travel": "operations", "tech": "operations"}
_ALLOWED_OPS = {"add_node", "update_node", "remove_node", "add_edge", "remove_edge", "move_node"}


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
        raise AIPlannerError("The model returned the wrong JSON shape.")
    return value


def _response_schema() -> dict[str, Any]:
    # Keep this schema deliberately broad enough for both Gemma and Flash-Lite;
    # the server-side normalizer and apply validator remain the final authority.
    return {
        "type": "OBJECT",
        "properties": {
            "operations": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "op": {"type": "STRING", "enum": sorted(_ALLOWED_OPS)},
                        "task_id": {"type": "STRING"}, "source": {"type": "STRING"}, "target": {"type": "STRING"}, "edge_id": {"type": "STRING"},
                        "title": {"type": "STRING"}, "description": {"type": "STRING"}, "status": {"type": "STRING"}, "priority": {"type": "STRING"}, "category": {"type": "STRING"}, "owner": {"type": "STRING"}, "eta": {"type": "STRING"},
                        "x": {"type": "NUMBER"}, "y": {"type": "NUMBER"},
                    },
                    "required": ["op"],
                },
            },
            "rationale": {"type": "STRING"},
        },
        "required": ["operations", "rationale"],
    }


def _prompt(goal: str, brief: str | None, tasks: list[dict[str, Any]], edges: list[dict[str, Any]], command: str, attachments: list[dict[str, Any]] | None = None) -> str:
    task_context = [{"id": task["id"], "title": task["title"], "status": task["status"], "priority": task["priority"], "category": task["category"], "owner": task["owner"], "position": task["position"]} for task in tasks]
    edge_context = [{"id": edge["id"], "source": edge["source"], "target": edge["target"]} for edge in edges]
    attachment_context = "\n\nATTACHED DOCUMENT CONTEXT:\n" + json.dumps(attachments or [], ensure_ascii=False) if attachments else ""
    return f"""You are the fast graph-editing engine for MissionControl AI. Convert the user's command into the smallest set of operations for the existing event task graph.

IMPORTANT: If the user asks to add, create, include, plan, or make a new task, you MUST return an add_node operation. Do not answer with advice or prose. If the user asks to connect, make the dependency an add_edge operation. Preserve unrelated work.

MISSION GOAL: {goal}
BRIEF: {brief or 'No brief provided.'}
CURRENT TASKS: {json.dumps(task_context, ensure_ascii=False)}
CURRENT EDGES (source -> target means target depends on source): {json.dumps(edge_context, ensure_ascii=False)}
USER COMMAND: {command}{attachment_context}

Return only JSON with this exact top-level shape: {{"operations":[...],"rationale":"..."}}. Each operation is flat: for add_node use op, title, description, status, priority, category, owner, eta, x, and y; for update_node use op, task_id, and the fields to change; for add_edge use op, source, and target.
Allowed operations: add_node, update_node, remove_node, add_edge, remove_edge, move_node.
For add_node, include task.title, task.description, task.status, task.priority, task.category, task.owner, task.eta, and task.position. Use status pending/in_progress/completed/blocked; priority low/medium/high/critical; category venue/speakers/marketing/operations/budget. Use existing IDs exactly. Never add cycles, self-edges, duplicate edges, or unknown references.
"""


def _normalize_operations(result: dict[str, Any], command: str = "") -> list[dict[str, Any]]:
    raw_operations = result.get("operations") or result.get("actions") or result.get("changes")
    if isinstance(raw_operations, dict):
        raw_operations = [raw_operations]
    if not isinstance(raw_operations, list):
        raise AIPlannerError("The model did not return an operations list.")

    normalized: list[dict[str, Any]] = []
    for raw in raw_operations:
        if not isinstance(raw, dict):
            continue
        op_value = raw.get("op") or raw.get("operation") or raw.get("action") or raw.get("type") or raw.get("kind")
        op_key = str(op_value or "").strip().lower().replace(" ", "_").replace("-", "_")
        op = _OPERATION_ALIASES.get(op_key)
        if not op:
            continue
        item = {"op": op}
        task = raw.get("task") or raw.get("node")
        if op == "add_node":
            if not isinstance(task, dict):
                task = {key: raw[key] for key in ("id", "title", "name", "description", "status", "priority", "category", "owner", "eta") if key in raw}
                if "x" in raw or "y" in raw:
                    task["position"] = {"x": raw.get("x", 0), "y": raw.get("y", 0)}
            task = dict(task or {})
            if not task.get("title") and task.get("name"): task["title"] = task.pop("name")
            task.setdefault("description", "")
            task.setdefault("status", "pending")
            task.setdefault("priority", "medium")
            task.setdefault("category", "operations")
            task.setdefault("owner", "Unassigned")
            task.setdefault("eta", "TBD")
            command_lower = command.lower()
            if any(word in command_lower for word in ("critical", "urgent")):
                task["priority"] = "critical"
            elif "high priority" in command_lower or "priority high" in command_lower:
                task["priority"] = "high"
            if "operations team" in command_lower or "ops team" in command_lower:
                task["owner"] = "Operations"
            task.setdefault("position", {"x": 160 + len(normalized) * 40, "y": 140 + len(normalized) * 24})
            task["status"] = _STATUS_ALIASES.get(str(task.get("status", "pending")).lower(), str(task.get("status", "pending")).lower())
            task["priority"] = _PRIORITY_ALIASES.get(str(task.get("priority", "medium")).lower(), str(task.get("priority", "medium")).lower())
            task["category"] = _CATEGORY_ALIASES.get(str(task.get("category", "operations")).lower(), str(task.get("category", "operations")).lower())
            item["task"] = task
        elif op == "add_edge":
            dependency = raw.get("dependency") if isinstance(raw.get("dependency"), dict) else {}
            item["source"] = raw.get("source") or raw.get("from") or dependency.get("source") or dependency.get("from")
            item["target"] = raw.get("target") or raw.get("to") or dependency.get("target") or dependency.get("to")
        elif op == "remove_edge":
            item["edge_id"] = raw.get("edge_id") or raw.get("id")
        else:
            item["task_id"] = raw.get("task_id") or raw.get("node_id") or raw.get("taskId") or raw.get("id")
            if op == "update_node":
                item["changes"] = raw.get("changes") or {key: raw[key] for key in ("title", "description", "status", "priority", "category", "owner", "eta") if key in raw}
            elif op == "move_node":
                item["position"] = raw.get("position") or raw.get("coordinates") or {"x": raw.get("x", 0), "y": raw.get("y", 0)}
        normalized.append(item)
    if not normalized:
        raise AIPlannerError("The model did not return a usable graph operation.")
    return normalized[:30]


def _models_to_try() -> list[str]:
    # Interactive graph editing must never fall back to a 30–40 second model.
    # The fast model has structured output and bounded latency; failures surface
    # immediately instead of making the operator wait for a slow retry.
    return [settings.GEMINI_FAST_MODEL]


def _call_model(model: str, prompt: str, image_parts: list[dict[str, Any]] | None) -> dict[str, Any]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={settings.GEMINI_API_KEY}"
    generation_config: dict[str, Any] = {"temperature": 0, "maxOutputTokens": 1536, "candidateCount": 1}
    if model == settings.GEMINI_FAST_MODEL:
        generation_config.update({"responseMimeType": "application/json", "responseSchema": _response_schema()})
    elif model.startswith("gemma-4"):
        generation_config["thinkingConfig"] = {"thinkingLevel": "minimal"}
    body = {"contents": [{"parts": [{"text": prompt}, *(image_parts or [])]}], "generationConfig": generation_config}
    request = urlrequest.Request(url, data=json.dumps(body).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urlrequest.urlopen(request, timeout=settings.GEMINI_REQUEST_TIMEOUT_SECONDS) as raw_response:
            response = json.loads(raw_response.read().decode("utf-8"))
    except urlerror.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise AIPlannerError(f"{model} request failed ({exc.code}): {detail[:300]}") from exc
    except (urlerror.URLError, TimeoutError) as exc:
        raise AIPlannerError(f"{model} request failed: {exc}") from exc
    parts = response.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    text = "\n".join(part.get("text", "") for part in parts if part.get("text") and not part.get("thought")).strip()
    if not text:
        raise AIPlannerError(f"{model} returned an empty response.")
    return _extract_json(text)


def propose_operations(*, goal: str, brief: str | None, tasks: list[dict[str, Any]], edges: list[dict[str, Any]], command: str, attachments: list[dict[str, Any]] | None = None, image_parts: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    if not settings.GEMINI_API_KEY:
        raise AIPlannerError("GEMINI_API_KEY is not configured for the backend.")
    prompt = _prompt(goal, brief, tasks, edges, command, attachments)
    errors: list[str] = []
    for model in _models_to_try():
        try:
            result = _call_model(model, prompt, image_parts)
            operations = _normalize_operations(result, command)
            return {"operations": operations, "rationale": str(result.get("rationale", "")), "model": model}
        except AIPlannerError as exc:
            errors.append(str(exc))
            logger.warning("AI planner model failed; trying next model: %s", exc)
    raise AIPlannerError("No AI planner model returned a usable graph proposal. " + " | ".join(errors[:2]))
