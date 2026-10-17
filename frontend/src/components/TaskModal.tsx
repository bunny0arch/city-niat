import React, { useState } from 'react';
import { X, CheckSquare } from 'lucide-react';
import type {
  TaskNode,
  CreateTaskPayload,
  UpdateTaskPayload,
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from '../types';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: TaskNode | null;
  onSubmit: (payload: CreateTaskPayload | UpdateTaskPayload) => Promise<void>;
}

interface TaskModalContentProps {
  onClose: () => void;
  taskToEdit?: TaskNode | null;
  onSubmit: (payload: CreateTaskPayload | UpdateTaskPayload) => Promise<void>;
}

const TaskModalContent: React.FC<TaskModalContentProps> = ({
  onClose,
  taskToEdit,
  onSubmit,
}) => {
  const [title, setTitle] = useState(() => taskToEdit?.title || '');
  const [description, setDescription] = useState(() => taskToEdit?.description || '');
  const [category, setCategory] = useState<TaskCategory>(() => taskToEdit?.category || 'operations');
  const [priority, setPriority] = useState<TaskPriority>(() => taskToEdit?.priority || 'medium');
  const [status, setStatus] = useState<TaskStatus>(() => taskToEdit?.status || 'pending');
  const [owner, setOwner] = useState(() => taskToEdit?.owner || 'Unassigned');
  const [eta, setEta] = useState(() => taskToEdit?.eta || '');
  const [sourceRefsStr, setSourceRefsStr] = useState(() => (taskToEdit?.source_refs || []).join('\n'));
  const [subtasksCompleted, setSubtasksCompleted] = useState<number>(() => taskToEdit?.subtasks_completed || 0);
  const [subtasksTotal, setSubtasksTotal] = useState<number>(() => taskToEdit?.subtasks_total || 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }

    const refs = sourceRefsStr
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      setSubmitting(true);
      setError(null);
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        status,
        owner: owner.trim() || 'Unassigned',
        eta: eta.trim() || 'TBD',
        source_refs: refs,
        subtasks_completed: Number(subtasksCompleted) || 0,
        subtasks_total: Number(subtasksTotal) || 0,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ops-modal-backdrop">
      <div className="ops-modal-container ops-modal-wide">
        <div className="ops-modal-header">
          <div className="ops-modal-title">
            <CheckSquare size={16} className="text-accent" />
            <span>{taskToEdit ? `EDIT TASK [${taskToEdit.id}]` : 'CREATE WORKFLOW TASK'}</span>
          </div>
          <button
            type="button"
            className="ops-btn-icon-subtle"
            onClick={onClose}
            disabled={submitting}
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="ops-modal-body">
          {error && <div className="ops-alert-error">{error}</div>}

          <div className="ops-form-group">
            <label htmlFor="task-title" className="ops-form-label">
              TASK TITLE <span className="text-accent">*</span>
            </label>
            <input
              id="task-title"
              type="text"
              className="ops-input"
              placeholder="e.g., Secure Fire Department Inspection Clearance"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
              autoFocus
            />
          </div>

          <div className="ops-form-row">
            <div className="ops-form-group flex-1">
              <label htmlFor="task-category" className="ops-form-label">CATEGORY</label>
              <select
                id="task-category"
                className="ops-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as TaskCategory)}
                disabled={submitting}
              >
                <option value="venue">VENUE</option>
                <option value="speakers">SPEAKERS</option>
                <option value="marketing">MARKETING</option>
                <option value="operations">OPERATIONS</option>
                <option value="budget">BUDGET</option>
              </select>
            </div>

            <div className="ops-form-group flex-1">
              <label htmlFor="task-priority" className="ops-form-label">PRIORITY</label>
              <select
                id="task-priority"
                className="ops-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                disabled={submitting}
              >
                <option value="low">LOW (P3)</option>
                <option value="medium">MEDIUM (P2)</option>
                <option value="high">HIGH (P1)</option>
                <option value="critical">CRITICAL (P0)</option>
              </select>
            </div>

            <div className="ops-form-group flex-1">
              <label htmlFor="task-status" className="ops-form-label">EXECUTION STATUS</label>
              <select
                id="task-status"
                className="ops-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                disabled={submitting}
              >
                <option value="pending">QUEUED / PENDING</option>
                <option value="in_progress">IN FLIGHT</option>
                <option value="completed">COMPLETED</option>
                <option value="blocked">BLOCKED</option>
              </select>
            </div>
          </div>

          <div className="ops-form-row">
            <div className="ops-form-group flex-1">
              <label htmlFor="task-owner" className="ops-form-label">OWNER / ASSIGNEE</label>
              <input
                id="task-owner"
                type="text"
                className="ops-input"
                placeholder="e.g., Elena Rostova"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="ops-form-group flex-1">
              <label htmlFor="task-eta" className="ops-form-label">TARGET ETA</label>
              <input
                id="task-eta"
                type="text"
                className="ops-input"
                placeholder="e.g., Oct 24, 2026"
                value={eta}
                onChange={(e) => setEta(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="ops-form-group">
            <label htmlFor="task-desc" className="ops-form-label">SCOPE & REQUIREMENTS</label>
            <textarea
              id="task-desc"
              className="ops-textarea"
              rows={3}
              placeholder="Detailed description of requirements, criteria for completion, and operational constraints..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="ops-form-row">
            <div className="ops-form-group flex-1">
              <label htmlFor="task-subtasks-comp" className="ops-form-label">SUBTASKS COMPLETED</label>
              <input
                id="task-subtasks-comp"
                type="number"
                min={0}
                className="ops-input"
                value={subtasksCompleted}
                onChange={(e) => setSubtasksCompleted(parseInt(e.target.value, 10) || 0)}
                disabled={submitting}
              />
            </div>
            <div className="ops-form-group flex-1">
              <label htmlFor="task-subtasks-tot" className="ops-form-label">TOTAL SUBTASKS</label>
              <input
                id="task-subtasks-tot"
                type="number"
                min={0}
                className="ops-input"
                value={subtasksTotal}
                onChange={(e) => setSubtasksTotal(parseInt(e.target.value, 10) || 0)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="ops-form-group">
            <label htmlFor="task-refs" className="ops-form-label">SOURCE REFERENCES & ATTACHMENTS (ONE PER LINE)</label>
            <textarea
              id="task-refs"
              className="ops-textarea font-mono text-xs"
              rows={2}
              placeholder="e.g. Doc Ref #SF-Permits-2026&#10;Floor plan revision 4"
              value={sourceRefsStr}
              onChange={(e) => setSourceRefsStr(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="ops-modal-footer">
            <button
              type="button"
              className="ops-btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="ops-btn-primary"
              disabled={submitting || !title.trim()}
            >
              {submitting ? 'Saving...' : taskToEdit ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  taskToEdit,
  onSubmit,
}) => {
  if (!isOpen) return null;
  return (
    <TaskModalContent
      key={taskToEdit?.id || 'new'}
      onClose={onClose}
      taskToEdit={taskToEdit}
      onSubmit={onSubmit}
    />
  );
};
