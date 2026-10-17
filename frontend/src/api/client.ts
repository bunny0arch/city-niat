import type {
  HealthResponse,
  MissionSummary,
  MissionDetail,
  CreateMissionPayload,
  TaskNode,
  CreateTaskPayload,
  UpdateTaskPayload,
  DependencyEdge,
  Position,
  AIPreviewResponse,
  AIApplyResponse,
  AIOperation,
} from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export interface HealthCheckResult {
  data: HealthResponse | null;
  error: string | null;
  latencyMs: number;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options?.headers || {}),
      },
    });

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errJson = await response.json();
        if (errJson && errJson.detail) {
          errorMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch {
        // use default error message
      }
      throw new Error(errorMsg);
    }

    if (response.status === 204) {
      return null as unknown as T;
    }

    return response.json();
  }

  async checkHealth(): Promise<HealthCheckResult> {
    const startTime = performance.now();
    try {
      const data = await this.request<HealthResponse>('/api/health');
      const latencyMs = Math.round(performance.now() - startTime);
      return { data, error: null, latencyMs };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Unknown error',
        latencyMs,
      };
    }
  }

  async listMissions(): Promise<MissionSummary[]> {
    return this.request<MissionSummary[]>('/api/missions');
  }

  async getMission(missionId: string): Promise<MissionDetail> {
    return this.request<MissionDetail>(`/api/missions/${missionId}`);
  }

  async createMission(payload: CreateMissionPayload): Promise<MissionDetail> {
    return this.request<MissionDetail>('/api/missions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async deleteMission(missionId: string): Promise<void> {
    return this.request<void>(`/api/missions/${missionId}`, {
      method: 'DELETE',
    });
  }

  async createTask(missionId: string, payload: CreateTaskPayload): Promise<TaskNode> {
    return this.request<TaskNode>(`/api/missions/${missionId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateTask(missionId: string, taskId: string, payload: UpdateTaskPayload): Promise<TaskNode> {
    return this.request<TaskNode>(`/api/missions/${missionId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteTask(missionId: string, taskId: string): Promise<void> {
    return this.request<void>(`/api/missions/${missionId}/tasks/${taskId}`, {
      method: 'DELETE',
    });
  }

  async createEdge(missionId: string, source: string, target: string): Promise<DependencyEdge> {
    return this.request<DependencyEdge>(`/api/missions/${missionId}/edges`, {
      method: 'POST',
      body: JSON.stringify({ source, target }),
    });
  }

  async deleteEdge(missionId: string, edgeId: string): Promise<void> {
    return this.request<void>(`/api/missions/${missionId}/edges/${edgeId}`, {
      method: 'DELETE',
    });
  }

  async updatePositions(missionId: string, positions: Record<string, Position>): Promise<void> {
    return this.request<void>(`/api/missions/${missionId}/positions`, {
      method: 'PUT',
      body: JSON.stringify({ positions }),
    });
  }

  async resetSampleMission(): Promise<{ status: string; mission_id: string }> {
    return this.request<{ status: string; mission_id: string }>('/api/missions/reset-sample', {
      method: 'POST',
    });
  }

  async previewAICommand(missionId: string, command: string): Promise<AIPreviewResponse> {
    return this.request<AIPreviewResponse>(`/api/missions/${missionId}/ai/preview`, {
      method: 'POST',
      body: JSON.stringify({ command }),
    });
  }

  async applyAIOperations(missionId: string, operations: AIOperation[]): Promise<AIApplyResponse> {
    return this.request<AIApplyResponse>(`/api/missions/${missionId}/ai/apply`, {
      method: 'POST',
      body: JSON.stringify({ operations }),
    });
  }

  getBaseUrl(): string {
    return this.baseUrl || 'http://localhost:8000 (proxied via /api)';
  }
}

export const api = new ApiClient();
