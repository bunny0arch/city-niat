import type {
  HealthResponse, MissionSummary, MissionDetail, CreateMissionPayload, TaskNode,
  CreateTaskPayload, UpdateTaskPayload, DependencyEdge, Position,
  AIPreviewResponse, AIApplyResponse, AIOperation,
} from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export interface HealthCheckResult { data: HealthResponse | null; error: string | null; latencyMs: number; }
export interface AuditEvent { id: string; workspace_user: string; event_type: string; action: string; details: Record<string, unknown>; created_at: string; }

export class ApiClient {
  private baseUrl: string;
  constructor(baseUrl: string = API_BASE_URL) { this.baseUrl = baseUrl; }

  private workspaceUser() {
    try { return (JSON.parse(window.sessionStorage.getItem('missioncontrol.session') || '{}') as { email?: string }).email || 'anonymous'; } catch { return 'anonymous'; }
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const isFormData = options?.body instanceof FormData;
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        Accept: 'application/json',
        'X-Workspace-User': this.workspaceUser(),
        ...(options?.headers || {}),
      },
    });
    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      try { const errJson = await response.json(); if (errJson?.detail) errorMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail); } catch { /* default */ }
      throw new Error(errorMsg);
    }
    if (response.status === 204) return null as unknown as T;
    return response.json();
  }

  async checkHealth(): Promise<HealthCheckResult> { const start = performance.now(); try { const data = await this.request<HealthResponse>('/api/health'); return { data, error: null, latencyMs: Math.round(performance.now() - start) }; } catch (err) { return { data: null, error: err instanceof Error ? err.message : 'Unknown error', latencyMs: Math.round(performance.now() - start) }; } }
  async listMissions() { return this.request<MissionSummary[]>('/api/missions'); }
  async getMission(id: string) { return this.request<MissionDetail>(`/api/missions/${id}`); }
  async createMission(payload: CreateMissionPayload) { return this.request<MissionDetail>('/api/missions', { method: 'POST', body: JSON.stringify(payload) }); }
  async deleteMission(id: string) { return this.request<void>(`/api/missions/${id}`, { method: 'DELETE' }); }
  async createTask(id: string, payload: CreateTaskPayload) { return this.request<TaskNode>(`/api/missions/${id}/tasks`, { method: 'POST', body: JSON.stringify(payload) }); }
  async updateTask(id: string, taskId: string, payload: UpdateTaskPayload) { return this.request<TaskNode>(`/api/missions/${id}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(payload) }); }
  async deleteTask(id: string, taskId: string) { return this.request<void>(`/api/missions/${id}/tasks/${taskId}`, { method: 'DELETE' }); }
  async createEdge(id: string, source: string, target: string) { return this.request<DependencyEdge>(`/api/missions/${id}/edges`, { method: 'POST', body: JSON.stringify({ source, target }) }); }
  async deleteEdge(id: string, edgeId: string) { return this.request<void>(`/api/missions/${id}/edges/${edgeId}`, { method: 'DELETE' }); }
  async updatePositions(id: string, positions: Record<string, Position>) { return this.request<void>(`/api/missions/${id}/positions`, { method: 'PUT', body: JSON.stringify({ positions }) }); }
  async resetSampleMission() { return this.request<{ status: string; mission_id: string }>('/api/missions/reset-sample', { method: 'POST' }); }
  async previewAICommand(id: string, command: string) { return this.request<AIPreviewResponse>(`/api/missions/${id}/ai/preview`, { method: 'POST', body: JSON.stringify({ command }) }); }
  async previewAICommandWithFiles(id: string, command: string, files: File[]) { const body = new FormData(); body.append('command', command); files.forEach((file) => body.append('files', file)); return this.request<AIPreviewResponse>(`/api/missions/${id}/ai/preview-with-files`, { method: 'POST', body }); }
  async applyAIOperations(id: string, operations: AIOperation[]) { return this.request<AIApplyResponse>(`/api/missions/${id}/ai/apply`, { method: 'POST', body: JSON.stringify({ operations }) }); }
  async recordAudit(event_type: string, action: string, details: Record<string, unknown> = {}) { await this.request<void>('/api/audit/events', { method: 'POST', body: JSON.stringify({ event_type, action, details }) }); }
  async listAuditEvents() { return this.request<AuditEvent[]>('/api/audit'); }
  getBaseUrl() { return this.baseUrl || 'http://localhost:8000 (proxied via /api)'; }
}
export const api = new ApiClient();
