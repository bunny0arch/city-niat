import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { CheckCircle2, Clock, AlertTriangle, PlayCircle, GitCommit } from 'lucide-react';
import type { FlowNodeData } from '../types';

function CustomEventNodeComponent({ data, selected }: NodeProps) {
  const task = (data as unknown as FlowNodeData)?.task;
  if (!task) return null;
  const status = task.status === 'completed' ? <span className="status-badge status-completed"><CheckCircle2 size={11} /> Complete</span> : task.status === 'in_progress' ? <span className="status-badge status-progress"><PlayCircle size={11} /> In flight</span> : task.status === 'blocked' ? <span className="status-badge status-blocked"><AlertTriangle size={11} /> Blocked</span> : <span className="status-badge status-pending"><Clock size={11} /> Queued</span>;
  const priority = task.priority === 'critical' ? 'P0' : task.priority === 'high' ? 'P1' : task.priority === 'medium' ? 'P2' : 'P3';
  const progressPercent = task.subtasks_total > 0 ? Math.round((task.subtasks_completed / task.subtasks_total) * 100) : task.status === 'completed' ? 100 : task.status === 'in_progress' ? 50 : 0;
  const depCount = task.dependencies?.length || 0;
  return <div className={`ops-node ${selected ? 'ops-node-selected' : ''}`}>
    <Handle type="target" position={Position.Left} className="ops-handle" />
    <div className="ops-node-header"><div className="ops-node-tags"><span className="ops-node-category">{task.category.toUpperCase()}</span><span className={`priority-badge priority-${task.priority}`}>{priority}</span></div>{status}</div>
    <div className="ops-node-title">{task.title}</div>
    {task.description && <p className="ops-node-desc">{task.description}</p>}
    <div className="ops-node-meta-chips"><span className="ops-chip"><GitCommit size={10} />{depCount === 0 ? 'Root task' : `${depCount} dep${depCount > 1 ? 's' : ''}`}</span>{task.source_refs?.length > 0 && <span className="ops-chip">{task.source_refs.length} ref{task.source_refs.length > 1 ? 's' : ''}</span>}</div>
    <div className="ops-node-progress-section"><div className="ops-node-progress-meta"><span>Progress</span><span>{progressPercent}%</span></div><div className="ops-progress-bar"><div className="ops-progress-fill" style={{ width: `${progressPercent}%` }} /></div></div>
    <div className="ops-node-footer"><span className="ops-node-owner">{task.owner || 'Unassigned'}</span><span className="ops-node-eta">{task.eta || 'TBD'}</span></div>
    <Handle type="source" position={Position.Right} className="ops-handle" />
  </div>;
}
export const CustomEventNode = memo(CustomEventNodeComponent);
