import React, { useEffect, useRef, useState } from 'react';
import { Layers, RefreshCw, Server, Calendar, CheckCircle, AlertCircle, Clock, Plus, ChevronDown, Search, UserRound, LogOut } from 'lucide-react';
import type { HealthCheckResult } from '../api/client';
import type { MissionSummary } from '../types';

interface HeaderProps {
  health: HealthCheckResult | null;
  checkingHealth: boolean;
  onRefreshHealth: () => void;
  missions: MissionSummary[];
  activeMissionId: string | null;
  onSelectMission: (missionId: string) => void;
  onOpenCreateMission: () => void;
  onLogout: () => void;
  displayName: string;
  email: string;
}

function initialsFor(name: string) {
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('');
  return (initials || name.slice(0, 2) || 'U').toUpperCase();
}

export const Header: React.FC<HeaderProps> = ({ health, checkingHealth, onRefreshHealth, missions, activeMissionId, onSelectMission, onOpenCreateMission, onLogout, displayName, email }) => {
  const isHealthy = health?.data?.status === 'ok';
  const [timeStr, setTimeStr] = useState(() => new Date().toISOString().substring(11, 16));
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setTimeStr(new Date().toISOString().substring(11, 16)), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!profileOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [profileOpen]);

  return (
    <header className="ops-header">
      <div className="ops-header-left">
        <div className="ops-brand"><Layers className="ops-brand-icon" size={19} /><span className="ops-brand-title">MissionControl AI</span><span className="ops-badge-subtle">Workspace</span></div>
        <div className="ops-divider-vertical" />
        <div className="ops-mission-selector-wrapper">
          <Calendar size={14} className="ops-dim-icon" />
          <div className="ops-select-container">
            <select aria-label="Active mission" className="ops-header-mission-select" value={activeMissionId || ''} onChange={(event) => onSelectMission(event.target.value)}>
              {missions.length === 0 ? <option value="">No mission selected</option> : missions.map((mission) => <option key={mission.id} value={mission.id}>{mission.goal}</option>)}
            </select>
            <ChevronDown size={12} className="ops-select-chevron" />
          </div>
          <button type="button" className="ops-btn-icon-subtle text-accent" onClick={onOpenCreateMission} title="Create new mission" aria-label="Create new mission"><Plus size={16} /></button>
        </div>
      </div>
      <div className="ops-header-search" aria-label="Search workspace"><Search size={15} /><input aria-label="Search missions and tasks" placeholder="Search missions, tasks, vendors..." /></div>
      <div className="ops-header-right">
        <div className="ops-health-container">
          <div className={`ops-health-pill ${checkingHealth ? 'ops-health-checking' : isHealthy ? 'ops-health-online' : 'ops-health-offline'}`} title="Backend health">
            <span className="ops-status-dot" /><Server size={12} className="ops-health-icon" /><span className="ops-health-label">{checkingHealth ? 'Checking' : isHealthy ? `API ${health?.latencyMs}ms` : 'API offline'}</span>{isHealthy ? <CheckCircle size={11} className="ops-health-state-icon" /> : <AlertCircle size={11} className="ops-health-state-icon" />}
          </div>
          <button type="button" className="ops-btn-icon" onClick={onRefreshHealth} disabled={checkingHealth} title="Recheck backend health"><RefreshCw size={13} className={checkingHealth ? 'ops-spin' : ''} /></button>
        </div>
        <div className="ops-runtime-meta"><Clock size={12} /><span>UTC {timeStr}</span></div>
        <div className="ops-profile-wrap" ref={profileRef}>
          <button type="button" className="ops-account-button" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen} aria-haspopup="menu" title="Open profile menu">
            <span className="ops-avatar">{initialsFor(displayName)}</span><span className="ops-account-name">{displayName}</span><UserRound size={13} className="ops-dim-icon" />
          </button>
          {profileOpen && (
            <div className="ops-profile-menu" role="menu">
              <div className="ops-profile-heading"><span className="ops-avatar ops-avatar-large">{initialsFor(displayName)}</span><div><strong>{displayName}</strong><span>{email}</span></div></div>
              <div className="ops-profile-divider" />
              <div className="ops-profile-status"><span className="ops-status-dot dot-emerald" /> Signed in to this workspace</div>
              <button type="button" className="ops-profile-logout" role="menuitem" onClick={() => { setProfileOpen(false); onLogout(); }}><LogOut size={14} /> Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
