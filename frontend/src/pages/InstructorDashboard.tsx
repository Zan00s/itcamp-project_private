import { useEffect, useState } from 'react';
import { apiClient, type SessionInfoDTO } from '../api/client';

const SCENARIO_NAMES: Record<string, string> = {
  startup: 'Пуск установки',
  shutdown: 'Остановка установки',
  emergency_pump_failure: 'Нештатная ситуация: отказ насоса',
};

const COMPONENT_LABELS: Record<string, string> = {
  correctness: 'Правильность',
  sequence: 'Последовательность',
  efficiency: 'Эффективность',
  safety: 'Безопасность',
  timing: 'Тайминг',
  semantics: 'Семантика (ИИ)',
  reasoning: 'Рассуждения (ИИ)',
};

const VERDICT_COLORS: Record<string, string> = {
  PASSED: '#4caf50',
  FAILED: '#f44336',
  TIMEOUT: '#ff9800',
};

const VERDICT_LABELS: Record<string, string> = {
  PASSED: 'Пройден',
  FAILED: 'Не пройден',
  TIMEOUT: 'Время вышло',
};

export default function InstructorDashboard() {
  const [sessions, setSessions] = useState<SessionInfoDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SessionInfoDTO | null>(null);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  const refresh = async () => {
    try {
      setSessions(await apiClient.listAllSessions());
    } catch (e: any) {
      setError(e.message);
    }
  };

  const completed = sessions.filter(s => s.verdict);
  const active = sessions.filter(s => s.active && !s.verdict);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Панель преподавателя</h2>
      <p style={{ color: '#aaa' }}>Мониторинг сессий и результатов студентов</p>

      {error && <div style={errorStyle}>{error}</div>}

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={statCard}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#e94560' }}>{sessions.length}</div>
          <div style={{ color: '#888', fontSize: '0.85rem' }}>Всего сессий</div>
        </div>
        <div style={statCard}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ff9800' }}>{active.length}</div>
          <div style={{ color: '#888', fontSize: '0.85rem' }}>Активных</div>
        </div>
        <div style={statCard}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#4caf50' }}>{completed.filter(s => s.verdict?.verdict === 'PASSED').length}</div>
          <div style={{ color: '#888', fontSize: '0.85rem' }}>Пройдено</div>
        </div>
        <div style={statCard}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f44336' }}>{completed.filter(s => s.verdict?.verdict === 'FAILED').length}</div>
          <div style={{ color: '#888', fontSize: '0.85rem' }}>Не пройдено</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div style={{ background: '#16213e', borderRadius: '12px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Результаты сессий</h3>
            <button onClick={refresh} style={btnStyle}>Обновить</button>
          </div>

          {sessions.length === 0 && (
            <p style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>Нет завершённых сессий. Студенты ещё не проходили сценарии.</p>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #333' }}>
                <th style={th}>Студент</th>
                <th style={th}>Сценарий</th>
                <th style={th}>Попытка</th>
                <th style={th}>Балл</th>
                <th style={th}>Результат</th>
                <th style={th}>Статус</th>
                <th style={th}>Время</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setSelected(s)}
                  style={{
                    borderBottom: '1px solid #222',
                    cursor: 'pointer',
                    background: selected?.id === s.id ? '#0f3460' : 'transparent',
                  }}
                >
                  <td style={td}>{s.userId}</td>
                  <td style={td}>{SCENARIO_NAMES[s.scenarioId] || s.scenarioId}</td>
                  <td style={td}>#{s.attempt}</td>
                  <td style={td}>{s.verdict ? <strong style={{ color: VERDICT_COLORS[s.verdict.verdict] }}>{s.verdict.score}</strong> : '—'}</td>
                  <td style={td}>
                    {s.verdict ? (
                      <span style={{ color: VERDICT_COLORS[s.verdict.verdict] }}>
                        {VERDICT_LABELS[s.verdict.verdict] || s.verdict.verdict}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={td}>
                    <span style={{ color: s.active ? '#ff9800' : '#888' }}>
                      {s.active ? 'Активна' : 'Завершена'}
                    </span>
                  </td>
                  <td style={td}>{new Date(s.startedAt).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ background: '#16213e', borderRadius: '12px', padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem' }}>Детали</h3>
          {!selected && <p style={{ color: '#666' }}>Выберите сессию из таблицы</p>}
          {selected && (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ color: '#888', fontSize: '0.85rem' }}>Студент</div>
                <div style={{ fontWeight: 'bold' }}>{selected.userId}</div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ color: '#888', fontSize: '0.85rem' }}>Сценарий</div>
                <div>{SCENARIO_NAMES[selected.scenarioId] || selected.scenarioId}</div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ color: '#888', fontSize: '0.85rem' }}>Попытка</div>
                <div>#{selected.attempt}</div>
              </div>
              {selected.verdict && (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ color: '#888', fontSize: '0.85rem' }}>Балл</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: VERDICT_COLORS[selected.verdict.verdict] }}>
                      {selected.verdict.score} / 100
                    </div>
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '4px' }}>Компоненты оценки</div>
                    {Object.entries(selected.verdict.componentScores).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span>{COMPONENT_LABELS[k] || k}:</span>
                        <span>{(v * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                  {selected.verdict.feedback.length > 0 && (
                    <div>
                      <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '4px' }}>Обратная связь</div>
                      {selected.verdict.feedback.map((f, i) => (
                        <div key={i} style={{ fontSize: '0.8rem', padding: '4px 8px', background: '#0f0f1e', borderRadius: '4px', marginBottom: '4px' }}>
                          {f.text}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              {!selected.verdict && (
                <div style={{ padding: '12px', background: '#0f0f1e', borderRadius: '8px', color: '#ff9800' }}>
                  Сессия ещё не завершена
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px', color: '#888', fontSize: '0.85rem' };
const td: React.CSSProperties = { padding: '8px', fontSize: '0.9rem' };
const btnStyle: React.CSSProperties = { padding: '6px 16px', background: '#0f3460', color: '#e94560', border: '1px solid #e94560', borderRadius: '6px', cursor: 'pointer' };
const statCard: React.CSSProperties = { background: '#16213e', borderRadius: '12px', padding: '1rem 1.5rem', textAlign: 'center', flex: 1 };
const errorStyle: React.CSSProperties = { background: '#f44336', color: '#fff', padding: '10px 20px', borderRadius: '8px', marginBottom: '1rem' };
