export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  environment: string;
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskCategory = 'venue' | 'speakers' | 'marketing' | 'operations' | 'budget';

export interface Position {
  x: number;
  y: number;
}

export interface TaskNode {
  id: string;
  mission_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  owner: string;
  eta: string;
  position: Position;
  source_refs: string[];
  dependencies: string[];
  subtasks_completed: number;
  subtasks_total: number;
  created_at: string;
  updated_at: string;
}

export interface DependencyEdge {
  id: string;
  mission_id: string;
  source: string;
  target: string;
  created_at: string;
}

export interface MissionSummary {
  id: string;
  goal: string;
  brief?: string | null;
  task_count: number;
  created_at: string;
  updated_at: string;
}

export interface MissionDetail {
  id: string;
  goal: string;
  brief?: string | null;
  tasks: TaskNode[];
  edges: DependencyEdge[];
  created_at: string;
  updated_at: string;
}

export interface CreateMissionPayload {
  goal: string;
  brief?: string;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  category?: TaskCategory;
  owner?: string;
  eta?: string;
  position?: Position;
  source_refs?: string[];
  subtasks_completed?: number;
  subtasks_total?: number;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  category?: TaskCategory;
  owner?: string;
  eta?: string;
  position?: Position;
  source_refs?: string[];
  subtasks_completed?: number;
  subtasks_total?: number;
}

/**
 * Data passed into XYFlow node component data prop
 */
export interface FlowNodeData extends Record<string, unknown> {
  task: TaskNode;
  onEditTask?: (task: TaskNode) => void;
  onDeleteTask?: (taskId: string) => void;
}
