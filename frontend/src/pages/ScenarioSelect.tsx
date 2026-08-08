import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSimStore } from '../store/simStore';
import { logout, getUser } from '../auth/oidc';
import type { ScenarioDTO } from '../api/client';

export default function ScenarioSelect() {
  const navigate = useNavigate();
  const { scenarios, loadScenarios, startSession, loading, error } = useSimStore();
  const [username, setUsername] = useState('');
  const [selected, setSelected] = useState<ScenarioDTO | null>(null);

  useEffect(() => {
    loadScenarios();
    getUser().then((u) => {
      if (u?.profile?.preferred_username) setUsername(u.profile.preferred_username);
      localStorage.setItem('userId', u?.profile?.preferred_username || 'student');
    });
  }, []);

  const handleStart = async () => {
    if (!selected) return;
    await startSession(selected.id);
    const session = useSimStore.getState().session;
    if (session) navigate(`/operator/${session.id}`);
  };

  const difficultyColor = (d: number) => {
    if (d <= 1) return '#4caf50';
    if (d === 2) return '#ff9800';
    return '#f44336';
  };

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a2e', color: '#eee', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>КТК ЭЛОУ-АВ — Выбор сценария</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {username && <span style={{ color: '#aaa' }}>Пользователь: {username}</span>}
          <button onClick={logout} style={btnStyle}>Выйти</button>
        </div>
      </div>

      {error && <div style={errorStyle}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {scenarios.map((sc) => (
          <div
            key={sc.id}
            onClick={() => setSelected(sc)}
            style={{
              ...cardStyle,
              border: selected?.id === sc.id ? '2px solid #e94560' : '1px solid #333',
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem' }}>{sc.name}</h3>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ ...badgeStyle, background: difficultyColor(sc.difficulty) }}>
                Сложность: {sc.difficulty}/3
              </span>
              <span style={badgeStyle}>{sc.timeoutSec / 60} мин</span>
              <span style={badgeStyle}>Проходной балл: {sc.passingScore}</span>
            </div>
            <p style={{ color: '#aaa', fontSize: '0.9rem', margin: '0.5rem 0' }}>
              Фаз: {sc.phases.length} | Установка: {sc.install}
            </p>
            <div style={{ marginTop: '0.5rem' }}>
              {sc.phases.map((ph) => (
                <div key={ph.id} style={{ fontSize: '0.85rem', color: '#888', padding: '2px 0' }}>
                  • {ph.title} ({ph.expectedActions.length} действий)
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div style={{ position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)' }}>
          <button
            onClick={handleStart}
            disabled={loading}
            style={{ ...btnStyle, fontSize: '1.1rem', padding: '14px 48px', background: '#0f3460', border: '2px solid #e94560', color: '#e94560' }}
          >
            {loading ? 'Запуск...' : `Начать: ${selected.name}`}
          </button>
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '8px 20px',
  background: '#16213e',
  color: '#eee',
  border: '1px solid #333',
  borderRadius: '6px',
  cursor: 'pointer',
};

const cardStyle: React.CSSProperties = {
  background: '#16213e',
  borderRadius: '12px',
  padding: '1.5rem',
  cursor: 'pointer',
  transition: 'border 0.2s',
};

const badgeStyle: React.CSSProperties = {
  padding: '2px 10px',
  borderRadius: '12px',
  fontSize: '0.8rem',
  background: '#333',
};

const errorStyle: React.CSSProperties = {
  background: '#f44336',
  color: '#fff',
  padding: '10px 20px',
  borderRadius: '8px',
  marginBottom: '1rem',
};
