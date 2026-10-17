import React from 'react';
import {
  Terminal,
  Cpu,
  Layers,
  Database,
} from 'lucide-react';
import type { HealthCheckResult } from '../api/client';

interface StatusBarProps {
  health: HealthCheckResult | null;
  checkingHealth: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  health,
  checkingHealth,
}) => {
  const isHealthy = health?.data?.status === 'ok';

  return (
    <footer className="ops-statusbar">
      <div className="ops-statusbar-left">
        <div className="ops-status-item">
          <span
            className={`ops-status-dot ${
              isHealthy ? 'dot-emerald' : 'dot-amber'
            }`}
          />
          <span className="ops-status-key">SYSTEM:</span>
          <span className="ops-status-val">
            {isHealthy ? 'ALL SYSTEMS NORMAL' : 'BACKEND DISCONNECTED'}
          </span>
        </div>

        <div className="ops-status-separator">|</div>

        <div className="ops-status-item">
          <Terminal size={12} className="ops-dim-icon" />
          <span className="ops-status-key">API:</span>
          <span className="ops-status-val font-mono">
            {checkingHealth
              ? 'Pinging...'
              : isHealthy
              ? `GET /api/health [200 OK - ${health?.latencyMs}ms]`
              : 'Connection refused (localhost:8000)'}
          </span>
        </div>
      </div>

      <div className="ops-statusbar-right">
        <div className="ops-status-item">
          <Database size={12} className="ops-dim-icon" />
          <span className="ops-status-key">DB:</span>
          <span className="ops-status-val">SQLite</span>
        </div>

        <div className="ops-status-separator">|</div>

        <div className="ops-status-item">
          <Layers size={12} className="ops-dim-icon" />
          <span className="ops-status-key">CANVAS:</span>
          <span className="ops-status-val">@xyflow/react v12</span>
        </div>

        <div className="ops-status-separator">|</div>

        <div className="ops-status-item">
          <Cpu size={12} className="ops-dim-icon" />
          <span className="ops-status-key">AI ENGINE:</span>
          <span className="ops-status-val">Google GenAI Ready</span>
        </div>
      </div>
    </footer>
  );
};
