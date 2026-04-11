import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) { setError('Enter your email first'); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) setError(error.message);
    else setResetSent(true);
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <svg width="40" height="40" viewBox="0 0 40 40" style={{ marginBottom: 10 }}>
            <circle cx="20" cy="20" r="20" fill="var(--primary)" />
            <path d="M12 28V12l8 10 8-10v16" stroke="var(--accent)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: 1 }}>Nura Health</div>
          <div style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 2 }}>Admin</div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 14 }}>
            <label className="nura-label">Email</label>
            <input
              className="nura-input"
              type="email"
              placeholder="admin@nurahealth.com.au"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="nura-label">Password</label>
            <input
              className="nura-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 14, padding: '8px 12px', background: 'rgba(244,67,54,0.08)', borderRadius: 6 }}>
              {error}
            </div>
          )}
          {resetSent && (
            <div style={{ color: 'var(--success)', fontSize: 12, marginBottom: 14, padding: '8px 12px', background: 'rgba(76,175,80,0.08)', borderRadius: 6 }}>
              Password reset email sent.
            </div>
          )}

          <button className="btn-mint" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <button
          onClick={handleForgotPassword}
          style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', width: '100%', textAlign: 'center' }}
        >
          Forgot password?
        </button>
      </div>
    </div>
  );
}
