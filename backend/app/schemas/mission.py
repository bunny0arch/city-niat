"""Pydantic models for missions, task nodes, and dependency edges."""

from typing import List, Optional, Literal, Dict
from pydantic import BaseModel, Field

TaskStatus = Literal["pending", "in_progress", "completed", "blocked"]
TaskPriority = Literal["low", "medium", "high", "critical"]
TaskCategory = Literal["venue", "speakers", "marketing", "operations", "budget"]


class Position(BaseModel):
    x: float = Field(default=0.0, description="X coordinate on canvas")
    y: float = Field(default=0.0, description="Y coordinate on canvas")


class TaskNode(BaseModel):
    id: str = Field(description="Stable unique identifier for the task node")
    mission_id: str
    title: str = Field(description="Task headline or milestone label")
    description: str = Field(default="", description="Detailed scope of work")
    status: TaskStatus = Field(default="pending")
    priority: TaskPriority = Field(default="medium")
    category: TaskCategory = Field(default="operations")
    owner: str = Field(default="Unassigned")
    eta: str = Field(default="TBD")
    position: Position = Field(default_factory=Position)
    source_refs: List[str] = Field(default_factory=list, description="References/citations/attachments")
    dependencies: List[str] = Field(default_factory=list, description="IDs of tasks that precede this task")
    subtasks_completed: int = Field(default=0)
    subtasks_total: int = Field(default=0)
    created_at: str
    updated_at: str


class DependencyEdge(BaseModel):
    id: str = Field(description="Unique edge identifier")
    mission_id: str
    source: str = Field(description="ID of predecessor task")
    target: str = Field(description="ID of dependent successor task")
    created_at: str


class MissionSummary(BaseModel):
    id: str
    goal: str
    brief: Optional[str] = None
    task_count: int = 0
    created_at: str
    updated_at: str


class MissionDetail(BaseModel):
    id: str
    goal: str
    brief: Optional[str] = None
    tasks: List[TaskNode]
    edges: List[DependencyEdge]
    created_at: str
    updated_at: str


class CreateMissionRequest(BaseModel):
    goal: str = Field(min_length=3, max_length=200, description="Primary event execution objective")
    brief: Optional[str] = Field(default=None, max_length=5000, description="Optional brief context or specs")


class UpdateMissionRequest(BaseModel):
    goal: Optional[str] = Field(default=None, min_length=3, max_length=200)
    brief: Optional[str] = Field(default=None, max_length=5000)


class CreateTaskRequest(BaseModel):
    id: Optional[str] = None
    title: str = Field(min_length=1, max_length=150)
    description: str = Field(default="", max_length=2000)
    status: TaskStatus = "pending"
    priority: TaskPriority = "medium"
    category: TaskCategory = "operations"
    owner: str = "Unassigned"
    eta: str = "TBD"
    position: Optional[Position] = None
    source_refs: List[str] = Field(default_factory=list)
    dependencies: List[str] = Field(default_factory=list)
    subtasks_completed: int = 0
    subtasks_total: int = 0


class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    category: Optional[TaskCategory] = None
    owner: Optional[str] = None
    eta: Optional[str] = None
    position: Optional[Position] = None
    source_refs: Optional[List[str]] = None
    dependencies: Optional[List[str]] = None
    subtasks_completed: Optional[int] = None
    subtasks_total: Optional[int] = None


class CreateEdgeRequest(BaseModel):
    source: str = Field(description="Predecessor task ID")
    target: str = Field(description="Successor task ID")


class BatchUpdatePositionsRequest(BaseModel):
    positions: Dict[str, Position]
