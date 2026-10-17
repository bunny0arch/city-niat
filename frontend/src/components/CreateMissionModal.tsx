import React, { useState } from 'react';
import { X, Target } from 'lucide-react';
import type { CreateMissionPayload } from '../types';

interface CreateMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateMissionPayload) => Promise<void>;
}

export const CreateMissionModal: React.FC<CreateMissionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [goal, setGoal] = useState('');
  const [brief, setBrief] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) {
      setError('Mission execution goal is required.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onSubmit({
        goal: goal.trim(),
        brief: brief.trim() || undefined,
      });
      setGoal('');
      setBrief('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create mission.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ops-modal-backdrop">
      <div className="ops-modal-container">
        <div className="ops-modal-header">
          <div className="ops-modal-title">
            <Target size={16} className="text-accent" />
            <span>INITIALIZE NEW EVENT MISSION</span>
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
            <label htmlFor="mission-goal" className="ops-form-label">
              EXECUTION GOAL <span className="text-accent">*</span>
            </label>
            <input
              id="mission-goal"
              type="text"
              className="ops-input"
              placeholder="e.g., Deliver APAC Developer Summit 2026"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              disabled={submitting}
              autoFocus
            />
            <span className="ops-form-hint">
              Define the primary strategic outcome for this execution workspace.
            </span>
          </div>

          <div className="ops-form-group">
            <label htmlFor="mission-brief" className="ops-form-label">
              EVENT BRIEF & SCOPE (OPTIONAL)
            </label>
            <textarea
              id="mission-brief"
              className="ops-textarea"
              rows={4}
              placeholder="Key milestones, expected scale, location, dates, and preliminary requirements..."
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
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
              disabled={submitting || !goal.trim()}
            >
              {submitting ? 'Creating...' : 'Create Mission'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
