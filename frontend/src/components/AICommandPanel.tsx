import React, { useRef, useState } from 'react';
import { ArrowUp, Check, ChevronDown, FileUp, LoaderCircle, Sparkles, X, Zap } from 'lucide-react';
import type { AIPreviewResponse, AIApplyResponse } from '../types';

interface AICommandPanelProps {
  missionId: string | null; preview: AIPreviewResponse | null; isOpen: boolean; isLoading: boolean; error: string | null;
  onToggle: () => void; onPreview: (command: string, files: File[]) => Promise<void>; onApply: () => Promise<void>; onCancel: () => void; lastApplied: AIApplyResponse | null;
}
const operationLabel = (op: string) => ({ add_node: 'Add task', update_node: 'Update task', remove_node: 'Remove task', add_edge: 'Connect tasks', remove_edge: 'Disconnect tasks', move_node: 'Move task' }[op] || op);

export const AICommandPanel: React.FC<AICommandPanelProps> = ({ missionId, preview, isOpen, isLoading, error, onToggle, onPreview, onApply, onCancel, lastApplied }) => {
  const [command, setCommand] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!command.trim() || !missionId || isLoading) return; await onPreview(command.trim(), files); };
  const addFiles = (event: React.ChangeEvent<HTMLInputElement>) => { setFiles((current) => [...current, ...Array.from(event.target.files || [])].slice(0, 8)); event.target.value = ''; };
  return (
    <section className={`ops-ai-dock${isOpen ? ' is-open' : ''}`} aria-label="Gemini workflow command panel">
      <button type="button" className="ops-ai-dock-toggle" onClick={onToggle} aria-expanded={isOpen}><span className="ops-ai-dock-toggle-left"><span className="ops-ai-orb"><Sparkles size={13} /></span><span><strong>Gemini command</strong><small>Gemma 4 26B · graph-aware edits</small></span></span><ChevronDown size={15} className={isOpen ? 'ops-chevron-up' : ''} /></button>
      {isOpen && <div className="ops-ai-dock-body">
        <div className="ops-ai-dock-intro"><div><span className="ops-kicker">Operator console</span><h2>Tell the canvas what to change.</h2></div><button type="button" className="ops-btn-icon-subtle" onClick={onToggle} aria-label="Close Gemini command panel"><X size={15} /></button></div>
        <div className="ops-ai-suggestions"><button type="button" onClick={() => setCommand('Add a final readiness review before the event.')}>Add readiness review</button><button type="button" onClick={() => setCommand('Move the announcement task until after registration opens.')}>Change a dependency</button><button type="button" onClick={() => setCommand('Build a plan from the attached brief.')}>Plan from brief</button></div>
        <form className="ops-ai-command-form" onSubmit={submit}>
          <textarea value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Add, remove, rearrange, or connect tasks…" rows={2} aria-label="Gemini workflow command" />
          <input ref={inputRef} type="file" multiple accept="image/*,.txt,.md,.csv,.json,.pdf,.doc,.docx,.rtf" onChange={addFiles} className="ops-file-input" aria-label="Upload planning documents" />
          <button type="button" className="ops-ai-attach" onClick={() => inputRef.current?.click()} aria-label="Upload images or planning documents"><FileUp size={15} /></button>
          <button type="submit" className="ops-ai-send" disabled={!missionId || !command.trim() || isLoading} aria-label="Preview Gemini changes">{isLoading ? <LoaderCircle size={15} className="ops-spin" /> : <ArrowUp size={15} />}</button>
        </form>
        {files.length > 0 && <div className="ops-ai-files" aria-label="Attached files">{files.map((file, index) => <span key={`${file.name}-${index}`} title={file.name}>{file.name}<button type="button" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${file.name}`}><X size={11} /></button></span>)}</div>}
        {error && <div className="ops-ai-error" role="alert">{error}</div>}
        {preview && <div className="ops-ai-preview"><div className="ops-ai-preview-head"><span><Zap size={13} /> Proposed changes</span><span className="ops-ai-model">{preview.model}</span></div><p>{preview.rationale || 'Gemini proposed a targeted graph update.'}</p><ul>{preview.operations.map((operation, index) => <li key={`${operation.op}-${index}`}><span className="ops-ai-op-dot" />{operationLabel(operation.op)}{operation.task?.title ? ` · ${operation.task.title}` : operation.task_id ? ` · ${operation.task_id}` : ''}</li>)}</ul><div className="ops-ai-preview-actions"><button type="button" className="ops-btn-secondary" onClick={onCancel}>Discard</button><button type="button" className="ops-btn-primary" onClick={() => void onApply()}><Check size={14} /> Apply to canvas</button></div></div>}
        {lastApplied && <div className="ops-ai-success" role="status"><Check size={13} /> Changes saved to the workflow.</div>}
      </div>}
    </section>
  );
};
