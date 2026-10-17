"""Schemas for previewable AI workflow operations."""

from typing import Any, Literal
from pydantic import BaseModel, Field


OperationType = Literal["add_node", "update_node", "remove_node", "add_edge", "remove_edge", "move_node"]


class AICommandRequest(BaseModel):
    command: str = Field(min_length=3, max_length=3000)


class AIOperation(BaseModel):
    op: OperationType
    task_id: str | None = None
    source: str | None = None
    target: str | None = None
    edge_id: str | None = None
    position: dict[str, float] | None = None
    task: dict[str, Any] | None = None
    changes: dict[str, Any] | None = None


class AIOperationsRequest(BaseModel):
    operations: list[AIOperation] = Field(min_length=1, max_length=30)


class AIPreviewResponse(BaseModel):
    model: str
    rationale: str
    operations: list[AIOperation]
    affected_task_ids: list[str]
    affected_edge_ids: list[str]


class AIApplyResponse(AIPreviewResponse):
    applied: bool = True
    mission_id: str
