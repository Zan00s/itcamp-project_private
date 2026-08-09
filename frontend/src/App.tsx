import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getUserManager } from './auth/oidc';
import Dashboard from './pages/Dashboard';
import OperatorScreen from './pages/OperatorScreen';
import ResultsScreen from './pages/ResultsScreen';
import LoginScreen from './pages/LoginScreen';
import CallbackPage from './pages/CallbackPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    getUserManager().getUser().then((u) => setAuthed(!!u && !u.expired)).catch(() => setAuthed(false));
  }, []);

  if (authed === null) return <div style={{ minHeight: '100vh', background: '#1a1a2e', color: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Загрузка...</div>;
  if (!authed) return <Navigate to="/login" />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/callback" element={<CallbackPage />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/operator/:sessionId" element={<ProtectedRoute><OperatorScreen /></ProtectedRoute>} />
        <Route path="/results/:sessionId" element={<ProtectedRoute><ResultsScreen /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
