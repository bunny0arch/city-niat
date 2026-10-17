import React from 'react';
import { GitBranch, Calendar, CheckSquare, Bot, Truck, Settings, Database, Terminal } from 'lucide-react';
import type { HealthCheckResult } from '../api/client';
import type { MissionDetail } from '../types';

interface SidebarProps { health: HealthCheckResult | null; activeMission: MissionDetail | null; activeTab: string; onSelectTab: (tab: string) => void; onOpenCreateMission: () => void; }

export const Sidebar: React.FC<SidebarProps> = ({ health, activeMission, activeTab, onSelectTab, onOpenCreateMission }) => {
  const tasks = activeMission?.tasks || [];
  const completedCount = tasks.filter((task) => task.status === 'completed').length;
  const inProgressCount = tasks.filter((task) => task.status === 'in_progress').length;
  const blockedCount = tasks.filter((task) => task.status === 'blocked').length;
  const navItems = [
    { id: 'canvas', label: 'Workflow', icon: GitBranch, badge: `${tasks.length}` },
    { id: 'timeline', label: 'Timeline', icon: Calendar },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, badge: `${tasks.length}` },
    { id: 'logistics', label: 'Logistics', icon: Truck },
    { id: 'ai-copilot', label: 'AI command', icon: Bot, badge: 'Ready' },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];
  return (
    <aside className="ops-sidebar">
      <div className="ops-sidebar-section ops-event-card">
        <div className="flex-row items-center justify-between mb-1"><span className="ops-card-label">ACTIVE MISSION</span><button type="button" className="ops-btn-link text-xs text-accent" onClick={onOpenCreateMission}>+ New</button></div>
        <div className="ops-event-name" title={activeMission?.goal || 'No mission'}>{activeMission?.goal || 'No mission selected'}</div>
        <div className="ops-event-details">
          <div className="ops-event-stat"><span className="ops-dim-text">Tasks</span><span className="ops-val-text font-mono">{tasks.length}</span></div>
          <div className="ops-event-stat"><span className="ops-dim-text">Complete</span><span className="ops-val-text text-emerald font-mono">{completedCount}</span></div>
          <div className="ops-event-stat"><span className="ops-dim-text">In flight</span><span className="ops-val-text text-sky font-mono">{inProgressCount}</span></div>
          {blockedCount > 0 && <div className="ops-event-stat"><span className="ops-dim-text">Blocked</span><span className="ops-val-text text-amber font-mono">{blockedCount}</span></div>}
        </div>
      </div>
      <div className="ops-sidebar-section"><div className="ops-section-heading">Workspace</div><nav className="ops-nav" aria-label="Workspace navigation">{navItems.map((item) => { const Icon = item.icon; const isActive = activeTab === item.id; return <button key={item.id} type="button" className={`ops-nav-item ${isActive ? 'ops-nav-active' : ''}`} onClick={() => onSelectTab(item.id)} aria-current={isActive ? 'page' : undefined}><div className="ops-nav-left"><Icon size={15} className="ops-nav-icon" /><span className="ops-nav-label">{item.label}</span></div>{item.badge && <span className="ops-nav-badge">{item.badge}</span>}</button>; })}</nav></div>
      <div className="ops-sidebar-section ops-infra-section"><div className="ops-section-heading">System</div><div className="ops-infra-card"><div className="ops-infra-row"><div className="ops-infra-label"><Database size={12} /><span>Database</span></div><span className="ops-mono-val">SQLite</span></div><div className="ops-infra-row"><div className="ops-infra-label"><Terminal size={12} /><span>Service</span></div><span className="ops-mono-val">{health?.data?.service || 'backend'}</span></div><div className="ops-infra-row"><div className="ops-infra-label"><span className="ops-pulse-mini" /><span>API status</span></div><span className={`ops-mono-val ${health?.data?.status === 'ok' ? 'text-emerald' : 'text-amber'}`}>{health?.data?.status === 'ok' ? 'Online' : 'Offline'}</span></div></div></div>
      <div className="ops-sidebar-footer">MissionControl AI · Phase 2 DAG</div>
    </aside>
  );
};
