import { useState } from 'react';
import type { User } from '../../types/auth';
import { apiLogin } from '../../utils/api';
import './LoginPage.css';

interface Props { onLogin: (user: User) => void; }

const DEMO = [
  { name: 'Dr. Sharma', email: 'sharma@medlab.in', password: 'admin123',  role: 'admin'     },
  { name: 'Riya Patel',  email: 'riya@medlab.in',   password: 'annotate1', role: 'annotator' },
  { name: 'Arun Nair',   email: 'arun@medlab.in',   password: 'review99',  role: 'reviewer'  },
] as const;

export function LoginPage({ onLogin }: Props) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const doLogin = async (em: string, pw: string) => {
    setError('');
    setLoading(true);
    try {
      const user = await apiLogin(em, pw);
      onLogin(user);
    } catch (e) {
      setError((e as Error).message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doLogin(email.trim(), password);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="9" fill="url(#lg)"/>
            <defs>
              <linearGradient id="lg" x1="0" y1="0" x2="32" y2="32">
                <stop offset="0%" stopColor="#7c3aed"/>
                <stop offset="100%" stopColor="#e879f9"/>
              </linearGradient>
            </defs>
            <path d="M7 16L12 9L20 21L24 15" stroke="#fff" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="24" cy="15" r="2.5" fill="#fff"/>
          </svg>
        </div>

        <h1 className="login-title">BioAnnot</h1>
        <p className="login-subtitle">Collaborative Biomedical Annotation Platform</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" required
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@medlab.in" />
          </div>
          <div className="form-field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" required
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" />
          </div>
          {error && <p className="login-error" role="alert">⚠ {error}</p>}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="login-divider"><span>Quick demo access</span></div>

        <div className="demo-users">
          {DEMO.map((u) => (
            <button key={u.email} type="button" className="demo-user-btn"
              onClick={() => doLogin(u.email, u.password)} disabled={loading}>
              <span className="demo-role-badge" data-role={u.role}>{u.role}</span>
              <span className="demo-name">{u.name}</span>
              <span className="demo-email">{u.email}</span>
            </button>
          ))}
        </div>

        <p className="login-note">
          Credentials are verified by the backend. Start the server before logging in.
        </p>
      </div>
    </div>
  );
}
