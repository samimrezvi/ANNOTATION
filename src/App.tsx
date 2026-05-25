import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnnotationPage } from './pages/AnnotationPage';
import { LoginPage } from './components/auth/LoginPage';
import type { User } from './types/auth';
import { apiMe } from './utils/api';
import './App.css';

export default function App() {
  const [user, setUser]       = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  // On startup, verify token with backend
  useEffect(() => {
    apiMe()
      .then((u) => { setUser(u); setChecking(false); })
      .catch(() => { setUser(null); setChecking(false); });
  }, []);

  const handleLogout = () => setUser(null);

  if (checking) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100svh', background: '#0a0812', color: '#a855f7',
        fontFamily: 'system-ui', fontSize: '0.9rem', letterSpacing: '0.05em',
      }}>
        Loading BioAnnot…
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <LoginPage onLogin={setUser} />}
        />
        <Route
          path="/"
          element={user
            ? <AnnotationPage user={user} onLogout={handleLogout} />
            : <Navigate to="/login" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
