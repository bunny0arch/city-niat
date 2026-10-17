import React, { useState } from 'react';
import { ArrowRight, Layers, LockKeyhole, Mail } from 'lucide-react';

interface LoginPageProps {
  onContinue: (email: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onContinue }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Enter your work email and password to continue.');
      return;
    }
    setError(null);
    onContinue(email.trim());
  };

  return (
    <main className="ops-login-shell">
      <section className="ops-login-visual" aria-label="MissionControl overview">
        <div className="ops-login-mark"><Layers size={20} /> <span>MissionControl AI</span></div>
        <div className="ops-login-visual-main">
          <div className="ops-login-kicker">Event operations / execution intelligence</div>
          <h1 className="ops-login-heading">Make the work move.</h1>
          <p className="ops-login-copy">Coordinate dependencies, align people, and turn a complex event brief into a workflow your team can actually execute.</p>
          <div className="ops-login-graph" aria-hidden="true">
            <span className="ops-login-node" /><span className="ops-login-node" /><span className="ops-login-node" /><span className="ops-login-node" />
          </div>
        </div>
        <div className="ops-login-legal">Private workspace · Google GenAI ready · Built for real execution</div>
      </section>

      <section className="ops-login-form-pane">
        <form className="ops-login-form" onSubmit={handleSubmit}>
          <div className="ops-login-kicker">Workspace access</div>
          <h1>Sign in</h1>
          <p>Continue to your event execution workspace.</p>
          <div className="ops-login-fields">
            <div className="ops-form-group">
              <label htmlFor="login-email" className="ops-form-label">WORK EMAIL</label>
              <div className="ops-header-search" style={{ width: '100%' }}>
                <Mail size={15} aria-hidden="true" />
                <input id="login-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" />
              </div>
            </div>
            <div className="ops-form-group">
              <label htmlFor="login-password" className="ops-form-label">PASSWORD</label>
              <div className="ops-header-search" style={{ width: '100%' }}>
                <LockKeyhole size={15} aria-hidden="true" />
                <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" />
              </div>
            </div>
            {error && <div className="ops-login-error" role="alert">{error}</div>}
            <button className="ops-btn-primary ops-login-submit" type="submit">Enter workspace <ArrowRight size={15} /></button>
          </div>
          <p className="ops-login-note">Authentication is currently running as a local workspace session. Connect your production identity provider before enabling this surface for external users.</p>
        </form>
      </section>
    </main>
  );
};
