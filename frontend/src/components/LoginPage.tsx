import React, { useMemo, useState } from 'react';
import { ArrowRight, Check, Eye, EyeOff, Layers, LockKeyhole, Mail, UserRound } from 'lucide-react';

interface LoginPageProps {
  onContinue: (email: string, displayName: string) => void;
}

type AuthMode = 'sign-in' | 'sign-up';
interface LocalAccount { email: string; displayName: string; passwordHash: string; }

const ACCOUNT_KEY = 'missioncontrol.localAccounts';

async function hashPassword(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function readAccounts(): LocalAccount[] {
  try { return JSON.parse(localStorage.getItem(ACCOUNT_KEY) || '[]') as LocalAccount[]; } catch { return []; }
}

export const LoginPage: React.FC<LoginPageProps> = ({ onContinue }) => {
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const title = useMemo(() => mode === 'sign-in' ? 'Welcome back' : 'Create your workspace', [mode]);
  const switchMode = (next: AuthMode) => { setMode(next); setError(null); setPassword(''); setConfirmPassword(''); };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) { setError('Enter a valid work email.'); return; }
    if (password.length < 8) { setError('Use at least 8 characters for your password.'); return; }
    if (mode === 'sign-up' && !displayName.trim()) { setError('Add your name so the workspace knows who is operating.'); return; }
    if (mode === 'sign-up' && password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setIsSubmitting(true);
    try {
      const accounts = readAccounts();
      const existing = accounts.find((account) => account.email === normalizedEmail);
      const passwordHash = await hashPassword(password);
      if (mode === 'sign-up') {
        if (existing) { setError('An account already exists for this email. Sign in instead.'); return; }
        const account = { email: normalizedEmail, displayName: displayName.trim(), passwordHash };
        localStorage.setItem(ACCOUNT_KEY, JSON.stringify([...accounts, account]));
        onContinue(account.email, account.displayName);
      } else {
        if (!existing || existing.passwordHash !== passwordHash) { setError('We could not match that email and password.'); return; }
        onContinue(existing.email, existing.displayName);
      }
    } finally { setIsSubmitting(false); }
  };

  return (
    <main className="ops-login-shell">
      <section className="ops-login-visual" aria-label="MissionControl overview">
        <div className="ops-login-mark"><Layers size={20} /> <span>MissionControl AI</span><span className="ops-badge-subtle">PRIVATE WORKSPACE</span></div>
        <div className="ops-login-visual-main">
          <div className="ops-login-kicker">Event operations / execution intelligence</div>
          <h1 className="ops-login-heading">Make the work move.</h1>
          <p className="ops-login-copy">Coordinate dependencies, align people, and turn a complex event brief into a workflow your team can actually execute.</p>
          <div className="ops-login-graph" aria-hidden="true"><span className="ops-login-node" /><span className="ops-login-node" /><span className="ops-login-node" /><span className="ops-login-node" /></div>
          <div className="ops-login-proof"><span><Check size={13} /> Dependency-aware</span><span><Check size={13} /> Gemini-ready</span><span><Check size={13} /> Built for operators</span></div>
        </div>
        <div className="ops-login-legal">Local workspace accounts · Connect your production identity provider before external rollout</div>
      </section>

      <section className="ops-login-form-pane">
        <form className="ops-login-form" onSubmit={handleSubmit}>
          <div className="ops-login-kicker">Workspace access</div>
          <h1>{title}</h1>
          <p>{mode === 'sign-in' ? 'Continue to your event execution workspace.' : 'Create a local workspace account to start planning.'}</p>
          <div className="ops-auth-tabs" role="tablist" aria-label="Authentication mode"><button type="button" role="tab" aria-selected={mode === 'sign-in'} className={mode === 'sign-in' ? 'is-active' : ''} onClick={() => switchMode('sign-in')}>Sign in</button><button type="button" role="tab" aria-selected={mode === 'sign-up'} className={mode === 'sign-up' ? 'is-active' : ''} onClick={() => switchMode('sign-up')}>Sign up</button></div>
          <div className="ops-login-fields">
            {mode === 'sign-up' && <div className="ops-form-group"><label htmlFor="login-name" className="ops-form-label">FULL NAME</label><div className="ops-header-search" style={{ width: '100%' }}><UserRound size={15} aria-hidden="true" /><input id="login-name" autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" /></div></div>}
            <div className="ops-form-group"><label htmlFor="login-email" className="ops-form-label">WORK EMAIL</label><div className="ops-header-search" style={{ width: '100%' }}><Mail size={15} aria-hidden="true" /><input id="login-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></div></div>
            <div className="ops-form-group"><label htmlFor="login-password" className="ops-form-label">PASSWORD</label><div className="ops-header-search" style={{ width: '100%' }}><LockKeyhole size={15} aria-hidden="true" /><input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /><button type="button" className="ops-input-action" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></div>
            {mode === 'sign-up' && <div className="ops-form-group"><label htmlFor="login-confirm-password" className="ops-form-label">CONFIRM PASSWORD</label><div className="ops-header-search" style={{ width: '100%' }}><LockKeyhole size={15} aria-hidden="true" /><input id="login-confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat your password" /></div></div>}
            {error && <div className="ops-login-error" role="alert">{error}</div>}
            <button className="ops-btn-primary ops-login-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Preparing workspace…' : mode === 'sign-in' ? 'Enter workspace' : 'Create workspace'} <ArrowRight size={15} /></button>
          </div>
          <p className="ops-login-note">Accounts are stored locally in this demo build. No password leaves this browser; connect a production identity provider before external users access the workspace.</p>
        </form>
      </section>
    </main>
  );
};
