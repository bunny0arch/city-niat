import { useState, useEffect, useCallback } from 'react';
import {
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
} from '@xyflow/react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { WorkflowCanvas } from './components/WorkflowCanvas';
import { InspectorPanel } from './components/InspectorPanel';
import { StatusBar } from './components/StatusBar';
import { CreateMissionModal } from './components/CreateMissionModal';
import { TaskModal } from './components/TaskModal';
import { LoginPage } from './components/LoginPage';
import { AICommandPanel } from './components/AICommandPanel';
import { CursorFollower } from './components/CursorFollower';
import { api, type AuditEvent, type HealthCheckResult } from './api/client';
import type {
  MissionSummary,
  MissionDetail,
  TaskNode,
  CreateMissionPayload,
  CreateTaskPayload,
  UpdateTaskPayload,
  TaskStatus,
  FlowNodeData,
  AIPreviewResponse,
  AIApplyResponse,
} from './types';
import { Cpu, AlertCircle } from 'lucide-react';
import './App.css';

export function App() {
  const [isLoginView, setIsLoginView] = useState(() => window.location.pathname === '/login' || !window.sessionStorage.getItem('missioncontrol.session'));
  const [sessionUser, setSessionUser] = useState<{ email: string; displayName: string }>(() => {
    try {
      const session = JSON.parse(window.sessionStorage.getItem('missioncontrol.session') || '{}') as { email?: string; displayName?: string };
      return { email: session.email || '', displayName: session.displayName || 'Workspace operator' };
    } catch {
      return { email: '', displayName: 'Workspace operator' };
    }
  });
  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [checkingHealth, setCheckingHealth] = useState<boolean>(true);

  // Missions & Graph State
  const [missions, setMissions] = useState<MissionSummary[]>([]);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [activeMission, setActiveMission] = useState<MissionDetail | null>(null);
  const [loadingMission, setLoadingMission] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Modals & Panels
  const [selectedTask, setSelectedTask] = useState<TaskNode | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isCreateMissionOpen, setIsCreateMissionOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<TaskNode | null>(null);
  const [activeTab, setActiveTab] = useState<string>('canvas');
  const [isAICommandOpen, setIsAICommandOpen] = useState(true);
  const [aiPreview, setAIPreview] = useState<AIPreviewResponse | null>(null);
  const [aiApplyResult, setAIApplyResult] = useState<AIApplyResponse | null>(null);
  const [aiLoading, setAILoading] = useState(false);
  const [aiError, setAIError] = useState<string | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Health Polling
  const fetchHealth = useCallback(async () => {
    setCheckingHealth(true);
    const result = await api.checkHealth();
    setHealth(result);
    setCheckingHealth(false);
  }, []);

  useEffect(() => {
    if (isLoginView) return;
    let isMounted = true;
    void api.checkHealth().then((result) => {
      if (isMounted) {
        setHealth(result);
        setCheckingHealth(false);
      }
    });

    const interval = setInterval(() => {
      if (isMounted) {
        void fetchHealth();
      }
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchHealth, isLoginView]);

  // Load Missions List
  const loadMissions = useCallback(async (selectId?: string) => {
    try {
      const list = await api.listMissions();
      setMissions(list);
      if (list.length > 0) {
        setActiveMissionId((prev) => {
          if (selectId) return selectId;
          if (prev && list.some((m) => m.id === prev)) return prev;
          return list[0].id;
        });
      }
    } catch (err) {
      console.error('Failed to load missions:', err);
    }
  }, []);

  useEffect(() => {
    if (isLoginView) return;
    let isMounted = true;
    void api.listMissions().then((list) => {
      if (isMounted) {
        setMissions(list);
        if (list.length > 0) {
          setActiveMissionId((prev) => prev || list[0].id);
        }
      }
    }).catch((err) => {
      console.error('Failed to load missions:', err);
    });

    return () => {
      isMounted = false;
    };
  }, [isLoginView]);

  // Convert tasks & edges into ReactFlow format
  const syncGraphToCanvas = useCallback((detail: MissionDetail) => {
    const flowNodes: Node[] = detail.tasks.map((task) => ({
      id: task.id,
      type: 'eventStage',
      position: { x: task.position.x, y: task.position.y },
      data: {
        task,
      } satisfies FlowNodeData,
    }));

    const flowEdges: Edge[] = detail.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: true,
      style: { stroke: '#475569', strokeWidth: 1.5 },
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [setNodes, setEdges]);

  // Load Active Mission Details
  const loadActiveMission = useCallback(async (missionId: string) => {
    setLoadingMission(true);
    try {
      const detail = await api.getMission(missionId);
      setActiveMission(detail);
      syncGraphToCanvas(detail);
      // Update selected task reference if still exists
      setSelectedTask((prev) => {
        if (!prev) return null;
        return detail.tasks.find((t) => t.id === prev.id) || null;
      });
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to load mission.');
    } finally {
      setLoadingMission(false);
    }
  }, [syncGraphToCanvas]);

  useEffect(() => {
    if (!activeMissionId) return;
    let isMounted = true;

    void api.getMission(activeMissionId).then((detail) => {
      if (isMounted) {
        setActiveMission(detail);
        syncGraphToCanvas(detail);
        setSelectedTask((prev) => {
          if (!prev) return null;
          return detail.tasks.find((t) => t.id === prev.id) || null;
        });
        setLoadingMission(false);
      }
    }).catch((err) => {
      if (isMounted) {
        setErrorBanner(err instanceof Error ? err.message : 'Failed to load mission.');
        setLoadingMission(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [activeMissionId, syncGraphToCanvas]);

  useEffect(() => {
    if (isLoginView || activeTab !== 'audit') return;
    void api.listAuditEvents().then(setAuditEvents).catch((err) => setErrorBanner(err instanceof Error ? err.message : 'Failed to load audit log.'));
  }, [activeTab, isLoginView]);

  // Node Click handler
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const flowData = node.data as unknown as FlowNodeData;
      if (flowData?.task) {
        setSelectedTask(flowData.task);
      }
    },
    []
  );

  const handlePaneClick = useCallback(() => {
    setSelectedTask(null);
    setSelectedEdgeId(null);
  }, []);

  // Moving tasks: persist new position on drag stop
  const handleNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, node: Node) => {
      if (!activeMissionId) return;
      void api.updatePositions(activeMissionId, {
        [node.id]: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
      }).catch((err) => {
        console.error('Failed to persist node position:', err);
      });
      void api.recordAudit('workflow', 'Moved task on canvas', { mission_id: activeMissionId, task_id: node.id });
    },
    [activeMissionId]
  );

  // Connecting tasks (Predecessor -> Dependent)
  const handleConnect = useCallback(
    async (connection: Connection) => {
      if (!activeMissionId || !connection.source || !connection.target) return;
      try {
        setErrorBanner(null);
        const createdEdge = await api.createEdge(activeMissionId, connection.source, connection.target);
        // Update React Flow immediately after the API confirms the edge. The
        // mission reload below remains authoritative for persistence, but the
        // operator should never need to refresh to see a successful connection.
        setEdges((currentEdges) => {
          if (currentEdges.some((edge) => edge.id === createdEdge.id)) return currentEdges;
          return [...currentEdges, {
            id: createdEdge.id,
            source: createdEdge.source,
            target: createdEdge.target,
            animated: true,
            style: { stroke: '#475569', strokeWidth: 1.5 },
          }];
        });
        void api.recordAudit('workflow', 'Connected dependency', { mission_id: activeMissionId, source: connection.source, target: connection.target });
        await loadActiveMission(activeMissionId);
      } catch (err) {
        setErrorBanner(err instanceof Error ? err.message : 'Failed to connect tasks.');
      }
    },
    [activeMissionId, loadActiveMission, setEdges]
  );

  // Select an edge on click (no confirm dialog)
  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setSelectedEdgeId((prev) => (prev === edge.id ? null : edge.id));
      setSelectedTask(null);
    },
    []
  );

  // Delete a selected edge via keyboard or action
  const handleDeleteEdge = useCallback(
    async (edge: Edge) => {
      if (!activeMissionId) return;
      try {
        setErrorBanner(null);
        await api.deleteEdge(activeMissionId, edge.id);
        void api.recordAudit('workflow', 'Removed dependency', { mission_id: activeMissionId, edge_id: edge.id });
        setSelectedEdgeId(null);
        await loadActiveMission(activeMissionId);
      } catch (err) {
        setErrorBanner(err instanceof Error ? err.message : 'Failed to delete dependency edge.');
      }
    },
    [activeMissionId, loadActiveMission]
  );

  // Create Mission
  const handleCreateMission = useCallback(
    async (payload: CreateMissionPayload) => {
      const newMission = await api.createMission(payload);
      void api.recordAudit('workflow', 'Created mission', { mission_id: newMission.id, goal: payload.goal });
      await loadMissions(newMission.id);
    },
    [loadMissions]
  );

  // Task Add / Edit Modal Submit
  const handleTaskModalSubmit = useCallback(
    async (payload: CreateTaskPayload | UpdateTaskPayload) => {
      if (!activeMissionId) return;
      if (taskToEdit) {
        // Edit existing
        await api.updateTask(activeMissionId, taskToEdit.id, payload as UpdateTaskPayload);
        void api.recordAudit('workflow', 'Updated task', { mission_id: activeMissionId, task_id: taskToEdit.id });
      } else {
        // Add new
        // Calculate a reasonable position on canvas
        const currentCount = nodes.length;
        const col = currentCount % 3;
        const row = Math.floor(currentCount / 3);
        const position = {
          x: 60 + col * 360,
          y: 80 + row * 240,
        };
        await api.createTask(activeMissionId, {
          ...(payload as CreateTaskPayload),
          position,
        });
        void api.recordAudit('workflow', 'Created task', { mission_id: activeMissionId, title: (payload as CreateTaskPayload).title });
      }
      await loadActiveMission(activeMissionId);
      await loadMissions();
    },
    [activeMissionId, taskToEdit, nodes.length, loadActiveMission, loadMissions]
  );

  // Delete Task
  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      if (!activeMissionId) return;
      try {
        setErrorBanner(null);
        await api.deleteTask(activeMissionId, taskId);
        void api.recordAudit('workflow', 'Deleted task', { mission_id: activeMissionId, task_id: taskId });
        setSelectedTask(null);
        await loadActiveMission(activeMissionId);
        await loadMissions();
      } catch (err) {
        setErrorBanner(err instanceof Error ? err.message : 'Failed to delete task.');
      }
    },
    [activeMissionId, loadActiveMission, loadMissions]
  );

  // Quick Status Change from Inspector
  const handleQuickStatusChange = useCallback(
    async (task: TaskNode, newStatus: TaskStatus) => {
      if (!activeMissionId) return;
      try {
        setErrorBanner(null);
        await api.updateTask(activeMissionId, task.id, { status: newStatus });
        void api.recordAudit('workflow', 'Changed task status', { mission_id: activeMissionId, task_id: task.id, status: newStatus });
        await loadActiveMission(activeMissionId);
      } catch (err) {
        setErrorBanner(err instanceof Error ? err.message : 'Failed to update status.');
      }
    },
    [activeMissionId, loadActiveMission]
  );

  // Reset sample workflow
  const handleResetSample = useCallback(async () => {
    if (window.confirm('Reset this mission back to the standard demonstrable sample event workflow?')) {
      try {
        setErrorBanner(null);
        const res = await api.resetSampleMission();
        await loadMissions(res.mission_id);
      } catch (err) {
        setErrorBanner(err instanceof Error ? err.message : 'Failed to reset sample workflow.');
      }
    }
  }, [loadMissions]);

  const handleAIPreview = useCallback(async (command: string, files: File[] = []) => {
    if (!activeMissionId) return;
    setAILoading(true);
    setAIError(null);
    setAIApplyResult(null);
    try {
      const preview = files.length > 0
        ? await api.previewAICommandWithFiles(activeMissionId, command, files)
        : await api.previewAICommand(activeMissionId, command);
      setAIPreview(preview);
    } catch (err) {
      setAIError(err instanceof Error ? err.message : 'Gemini could not prepare a safe graph change.');
    } finally {
      setAILoading(false);
    }
  }, [activeMissionId]);

  const handleAIApply = useCallback(async () => {
    if (!activeMissionId || !aiPreview) return;
    setAILoading(true);
    setAIError(null);
    try {
      const result = await api.applyAIOperations(activeMissionId, aiPreview.operations);
      setAIApplyResult(result);
      setAIPreview(null);
      await loadActiveMission(activeMissionId);
      await loadMissions();
      void api.recordAudit('ai', 'Applied Gemini workflow changes', { mission_id: activeMissionId, operation_count: result.operations.length });
    } catch (err) {
      setAIError(err instanceof Error ? err.message : 'The proposed changes were not saved.');
    } finally {
      setAILoading(false);
    }
  }, [activeMissionId, aiPreview, loadActiveMission, loadMissions]);

  const openAddTaskModal = useCallback(() => {
    setTaskToEdit(null);
    setIsTaskModalOpen(true);
  }, []);

  const openEditTaskModal = useCallback((task: TaskNode) => {
    setTaskToEdit(task);
    setIsTaskModalOpen(true);
  }, []);

  const logout = useCallback(() => {
    void api.recordAudit('auth', 'Logged out');
    window.sessionStorage.removeItem('missioncontrol.session');
    window.history.pushState({}, '', '/login');
    setMissions([]);
    setActiveMissionId(null);
    setActiveMission(null);
    setNodes([]);
    setEdges([]);
    setSessionUser({ email: '', displayName: 'Workspace operator' });
    setIsLoginView(true);
  }, [setEdges, setNodes]);

  const continueToWorkspace = useCallback(async (email: string, displayName: string) => {
    window.sessionStorage.setItem('missioncontrol.session', JSON.stringify({ email, displayName }));
    setSessionUser({ email, displayName });
    try {
      await api.resetSampleMission();
    } catch (err) {
      console.warn('Sample mission could not be initialized:', err);
    }
    void api.recordAudit('auth', 'Logged in', { display_name: displayName });
    window.history.pushState({}, '', '/');
    setIsLoginView(false);
  }, []);

  if (isLoginView) {
    return <><CursorFollower /><LoginPage onContinue={continueToWorkspace} /></>;
  }

  return (
    <div className="ops-app-shell">
      <CursorFollower />

      <Header
        health={health}
        checkingHealth={checkingHealth}
        onRefreshHealth={fetchHealth}
        missions={missions}
        activeMissionId={activeMissionId}
        onSelectMission={setActiveMissionId}
        onOpenCreateMission={() => setIsCreateMissionOpen(true)}
        onLogout={logout}
        displayName={sessionUser.displayName}
        email={sessionUser.email}
      />

      {errorBanner && (
        <div className="ops-banner-error">
          <div className="flex-row items-center gap-2">
            <AlertCircle size={14} />
            <span>{errorBanner}</span>
          </div>
          <button
            type="button"
            className="ops-btn-icon-subtle text-white"
            onClick={() => setErrorBanner(null)}
          >
            &times;
          </button>
        </div>
      )}

      <div className="ops-workspace-container">
        <Sidebar
          health={health}
          activeMission={activeMission}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenCreateMission={() => setIsCreateMissionOpen(true)}
        />

        <main className="ops-main-viewport">
          {activeTab === 'canvas' && (
            <div className="ops-canvas-layout">
              <div className="ops-canvas-pane">
                {!activeMission ? (
                  <div className="ops-no-mission-state"><div><span className="ops-kicker">New workspace</span><h2>Your first mission starts here.</h2><p>There is no shared sample plan in this workspace. Create a mission from your own event brief to begin building the graph.</p><button type="button" className="ops-btn-primary" onClick={() => setIsCreateMissionOpen(true)}>Create first mission</button></div></div>
                ) : loadingMission && nodes.length === 0 ? (
                  <div className="ops-loading-state">
                    <span className="ops-spin" />
                    <span>Loading Task Graph from SQLite...</span>
                  </div>
                ) : (
                  <WorkflowCanvas
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={handleConnect}
                    onNodeClick={handleNodeClick}
                    onEdgeClick={handleEdgeClick}
                    onDeleteEdge={handleDeleteEdge}
                    onPaneClick={handlePaneClick}
                    onNodeDragStop={handleNodeDragStop}
                    onAddTaskClick={openAddTaskModal}
                    onResetSampleClick={handleResetSample}
                    selectedEdgeId={selectedEdgeId}
                  />
                )}
                <AICommandPanel
                  missionId={activeMissionId}
                  preview={aiPreview}
                  isOpen={isAICommandOpen}
                  isLoading={aiLoading}
                  error={aiError}
                  onToggle={() => setIsAICommandOpen((value) => !value)}
                  onPreview={handleAIPreview}
                  onApply={handleAIApply}
                  onCancel={() => { setAIPreview(null); setAIError(null); }}
                  lastApplied={aiApplyResult}
                />
              </div>
              <InspectorPanel
                selectedTask={selectedTask}
                activeMission={activeMission}
                onClose={() => setSelectedTask(null)}
                onEditTask={openEditTaskModal}
                onDeleteTask={handleDeleteTask}
                onQuickStatusChange={handleQuickStatusChange}
                onAddTaskClick={openAddTaskModal}
              />
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="ops-placeholder-panel">
              <div className="ops-panel-card">
                <div className="ops-panel-card-header">
                  <h2 className="ops-panel-title">Timeline & Critical Path Schedule</h2>
                  <span className="ops-badge-subtle">DAG Topological Sort</span>
                </div>
                <p className="ops-panel-desc">
                  Topological dependency traversal for mission: <strong>{activeMission?.goal}</strong>.
                </p>
                <div className="ops-terminal-box">
                  <code>&gt; Active Graph Nodes: {nodes.length} | Edges: {edges.length}</code>
                  <br />
                  <code>&gt; Predecessor checks verified: Cycles strictly rejected by Kahn's algorithm.</code>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="ops-placeholder-panel">
              <div className="ops-panel-card">
                <div className="ops-panel-card-header">
                  <h2 className="ops-panel-title">Task Matrix ({activeMission?.tasks.length || 0} Total)</h2>
                  <button
                    type="button"
                    className="ops-btn-toolbar ops-btn-toolbar-primary"
                    onClick={openAddTaskModal}
                  >
                    + Add Task
                  </button>
                </div>
                <div className="ops-task-matrix-table">
                  <div className="ops-table-row ops-table-head">
                    <span>Task Name</span>
                    <span>Assignee</span>
                    <span>Category</span>
                    <span>Status</span>
                  </div>
                  {activeMission?.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="ops-table-row cursor-pointer"
                      onClick={() => {
                        setSelectedTask(task);
                        setActiveTab('canvas');
                      }}
                    >
                      <span className="font-semibold text-white">{task.title}</span>
                      <span>{task.owner || 'Unassigned'}</span>
                      <span className="font-mono text-xs">{task.category.toUpperCase()}</span>
                      <span className={`ops-badge-status status-${task.status}`}>
                        {task.status.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logistics' && (
            <div className="ops-placeholder-panel">
              <div className="ops-panel-card">
                <div className="ops-panel-card-header">
                  <h2 className="ops-panel-title">Logistics & Vendor Matrix</h2>
                  <span className="ops-badge-subtle">Contracts & Permits</span>
                </div>
                <p className="ops-panel-desc">
                  Vendor tracking matrix for active mission venue permits, AV suppliers, and catering agreements.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'ai-copilot' && (
            <div className="ops-placeholder-panel">
              <div className="ops-panel-card">
                <div className="ops-panel-card-header">
                  <div className="flex-row items-center gap-2">
                    <Cpu size={16} className="text-accent" />
                    <h2 className="ops-panel-title">AI Execution Agent (Gemma 4 / GenAI)</h2>
                  </div>
                  <span className="ops-badge-accent">Standby</span>
                </div>
                <p className="ops-panel-desc">
                  The task-graph data model and dependency validation are fully locked and persisted in SQLite. The AI reasoning engine will plug into this graph model in the subsequent milestone.
                </p>
                <div className="ops-terminal-box">
                  <code># Graph Model: Ready for Google GenAI tool-calling & autonomous subtask decomposition</code>
                  <br />
                  <code># Verified: Cycle detection, persistent positions, and CRUD mutations operational.</code>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="ops-placeholder-panel">
              <div className="ops-panel-card">
                <div className="ops-panel-card-header">
                  <h2 className="ops-panel-title">Workspace Configuration</h2>
                  <span className="ops-badge-subtle">System v0.1</span>
                </div>
                <div className="ops-settings-list">
                  <div className="ops-setting-item">
                    <div>
                      <div className="ops-setting-name">API Server URL</div>
                      <div className="ops-setting-sub">FastAPI backend endpoint</div>
                    </div>
                    <code className="ops-code-pill">{api.getBaseUrl()}</code>
                  </div>
                  <div className="ops-setting-item">
                    <div>
                      <div className="ops-setting-name">Database Backend</div>
                      <div className="ops-setting-sub">Local relational storage</div>
                    </div>
                    <code className="ops-code-pill">SQLite (WAL mode enabled)</code>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="ops-placeholder-panel">
              <div className="ops-panel-card ops-audit-panel">
                <div className="ops-panel-card-header"><div><span className="ops-kicker">Workspace history</span><h2 className="ops-panel-title">Audit log</h2></div><span className="ops-badge-subtle">Latest 100 events</span></div>
                <p className="ops-panel-desc">Authentication and workflow actions recorded with the acting workspace identity and UTC timestamp.</p>
                <div className="ops-audit-list">
                  {auditEvents.length === 0 && <div className="ops-empty-state">No audit events recorded for this workspace yet.</div>}
                  {auditEvents.map((event) => <div className="ops-audit-row" key={event.id}><div className="ops-audit-main"><strong>{event.action}</strong><span>{event.workspace_user}</span></div><div className="ops-audit-meta"><span>{event.event_type}</span><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time></div></div>)}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <StatusBar
        health={health}
        checkingHealth={checkingHealth}
      />

      {/* Modals */}
      <CreateMissionModal
        isOpen={isCreateMissionOpen}
        onClose={() => setIsCreateMissionOpen(false)}
        onSubmit={handleCreateMission}
      />

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        taskToEdit={taskToEdit}
        onSubmit={handleTaskModalSubmit}
      />
    </div>
  );
}

export default App;
