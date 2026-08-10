import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { apiClient, type SessionInfoDTO } from '../api/client';

const SCENARIO_NAMES: Record<string, string> = {
  startup: 'Пуск установки',
  shutdown: 'Остановка установки',
  emergency_pump_failure: 'Нештатная ситуация: отказ насоса',
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

const COMPONENT_LABELS: Record<string, string> = {
  correctness: 'Корректность',
  timing: 'Скорость',
};

type SortField = 'userId' | 'scenarioId' | 'attempt' | 'score' | 'verdict' | 'status' | 'duration';
type SortDir = 'asc' | 'desc';

function formatDuration(sec: number): string {
  if (sec <= 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h} ч. ${m} мин. ${s} сек.`;
  return `${m} мин. ${s.toString().padStart(2, '0')} сек.`;
}

function exportXlsx(rows: SessionInfoDTO[]) {
  const data = rows.map(s => ({
    'Студент': s.userId,
    'Сценарий': SCENARIO_NAMES[s.scenarioId] || s.scenarioId,
    'Попытка': s.attempt,
    'Балл': s.verdict?.score ?? '',
    'Результат': s.verdict ? VERDICT_LABELS[s.verdict.verdict] || s.verdict.verdict : '',
    'Статус': s.active ? 'Активна' : 'Завершена',
    'Продолжительность': formatDuration(s.durationSec),
  }));

  const ws = XLSX.utils.json_to_sheet(data, {
    header: ['Студент', 'Сценарий', 'Попытка', 'Балл', 'Результат', 'Статус', 'Продолжительность'],
  });
  ws['!cols'] = [{ wch: 20 }, { wch: 28 }, { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 28 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Сессии');
  XLSX.writeFile(wb, 'sessions.xlsx');
}

export default function InstructorDashboard() {
  const [sessions, setSessions] = useState<SessionInfoDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SessionInfoDTO | null>(null);
  const [filters, setFilters] = useState<Record<SortField, string>>({
    userId: '', scenarioId: '', attempt: '', score: '', verdict: '', status: '', duration: '',
  });
  const [sortField, setSortField] = useState<SortField>('userId');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

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

  const getScore = (s: SessionInfoDTO) => s.verdict?.score ?? -1;
  const getVerdict = (s: SessionInfoDTO) => s.verdict?.verdict || '';
  const getStatus = (s: SessionInfoDTO) => s.active ? 'active' : 'done';

  const filtered = sessions.filter(s => {
    if (filters.userId && !s.userId.toLowerCase().includes(filters.userId.toLowerCase())) return false;
    if (filters.scenarioId && !(SCENARIO_NAMES[s.scenarioId] || s.scenarioId).toLowerCase().includes(filters.scenarioId.toLowerCase())) return false;
    if (filters.attempt && !String(s.attempt).includes(filters.attempt)) return false;
    if (filters.score && String(s.verdict?.score ?? '').includes(filters.score)) return false;
    if (filters.verdict && !getVerdict(s).toLowerCase().includes(filters.verdict.toLowerCase())) return false;
    if (filters.status && !getStatus(s).toLowerCase().includes(filters.status.toLowerCase())) return false;
    if (filters.duration && !formatDuration(s.durationSec).toLowerCase().includes(filters.duration.toLowerCase())) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'userId': cmp = a.userId.localeCompare(b.userId); break;
      case 'scenarioId': cmp = (SCENARIO_NAMES[a.scenarioId] || a.scenarioId).localeCompare(SCENARIO_NAMES[b.scenarioId] || b.scenarioId); break;
      case 'attempt': cmp = a.attempt - b.attempt; break;
      case 'score': cmp = getScore(a) - getScore(b); break;
      case 'verdict': cmp = getVerdict(a).localeCompare(getVerdict(b)); break;
      case 'status': cmp = getStatus(a).localeCompare(getStatus(b)); break;
      case 'duration': cmp = a.durationSec - b.durationSec; break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const completed = sessions.filter(s => s.verdict);
  const active = sessions.filter(s => s.active && !s.verdict);

  const fetchAiAnalysis = async () => {
    if (!selected) return;
    setAiLoading(true);
    try {
      const res = await apiClient.analyzeSession(selected.id);
      setAiAnalysis(res.text);
    } catch {
      setAiAnalysis('МадИИна недоступна');
    }
    setAiLoading(false);
  };

  const sortArrow = (field: SortField) => sortField === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Панель преподавателя</h2>
      <p style={{ color: '#aaa' }}>Мониторинг сессий и результатов студентов</p>

      {error && <div style={errorStyle}>{error}</div>}

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={statCard}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff' }}>{sessions.length}</div>
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
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => exportXlsx(sorted)} style={btnStyle}>Выгрузить XLSX</button>
              <button onClick={refresh} style={btnStyle}>Обновить</button>
            </div>
          </div>

          {sessions.length === 0 && (
            <p style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>Нет завершённых сессий. Студенты ещё не проходили сценарии.</p>
          )}

          {sessions.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333' }}>
                  <th style={th} onClick={() => toggleSort('userId')}>Студент{sortArrow('userId')}</th>
                  <th style={th} onClick={() => toggleSort('scenarioId')}>Сценарий{sortArrow('scenarioId')}</th>
                  <th style={th} onClick={() => toggleSort('attempt')}>Попытка{sortArrow('attempt')}</th>
                  <th style={th} onClick={() => toggleSort('score')}>Балл{sortArrow('score')}</th>
                  <th style={th} onClick={() => toggleSort('verdict')}>Результат{sortArrow('verdict')}</th>
                  <th style={th} onClick={() => toggleSort('status')}>Статус{sortArrow('status')}</th>
                  <th style={th} onClick={() => toggleSort('duration')}>Продолжительность{sortArrow('duration')}</th>
                </tr>
                <tr>
                  <th style={th}><input value={filters.userId} onChange={e => setFilters({ ...filters, userId: e.target.value })} style={filterInput} placeholder="фильтр" /></th>
                  <th style={th}><input value={filters.scenarioId} onChange={e => setFilters({ ...filters, scenarioId: e.target.value })} style={filterInput} placeholder="фильтр" /></th>
                  <th style={th}><input value={filters.attempt} onChange={e => setFilters({ ...filters, attempt: e.target.value })} style={filterInput} placeholder="фильтр" /></th>
                  <th style={th}><input value={filters.score} onChange={e => setFilters({ ...filters, score: e.target.value })} style={filterInput} placeholder="фильтр" /></th>
                  <th style={th}><input value={filters.verdict} onChange={e => setFilters({ ...filters, verdict: e.target.value })} style={filterInput} placeholder="фильтр" /></th>
                  <th style={th}><input value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} style={filterInput} placeholder="фильтр" /></th>
                  <th style={th}><input value={filters.duration} onChange={e => setFilters({ ...filters, duration: e.target.value })} style={filterInput} placeholder="фильтр" /></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => (
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
                    <td style={td}>{formatDuration(s.durationSec)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ color: '#888', fontSize: '0.85rem' }}>Продолжительность</div>
                <div>{formatDuration(selected.durationSec)}</div>
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
                    <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '4px' }}>Показатели</div>
                    {(['correctness', 'timing'] as const).map(k => {
                      const v = selected.verdict!.componentScores[k];
                      if (v === undefined) return null;
                      return (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span>{COMPONENT_LABELS[k] || k}:</span>
                          <span>{(v * 100).toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                  {selected.verdict.feedback.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '4px' }}>Обратная связь</div>
                      {selected.verdict.feedback.map((f, i) => (
                        <div key={i} style={{ fontSize: '0.8rem', padding: '4px 8px', background: '#0f0f1e', borderRadius: '4px', marginBottom: '4px' }}>
                          {f.text}
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={fetchAiAnalysis}
                    disabled={aiLoading}
                    style={{ ...btnStyle, width: '100%', background: '#4a148c', border: '1px solid #b39ddb', color: '#b39ddb' }}
                  >
                    {aiLoading ? 'МадИИна анализирует...' : '🤖 МадИИна-разбор результатов'}
                  </button>
                  {aiAnalysis && (
                    <div style={{ marginTop: '8px', padding: '8px', background: '#2d1b4e', borderRadius: '6px', border: '1px solid #b39ddb' }}>
                      <div style={{ color: '#b39ddb', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>🤖 МадИИна-анализ</div>
                      <div style={{ color: '#aaa', fontSize: '0.85rem' }}>{aiAnalysis}</div>
                      <button onClick={() => setAiAnalysis(null)} style={{ ...btnStyle, padding: '2px 8px', fontSize: '0.75rem', marginTop: '4px' }}>Закрыть</button>
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

const th: React.CSSProperties = { textAlign: 'left', padding: '6px', color: '#888', fontSize: '0.85rem', cursor: 'pointer' };const td: React.CSSProperties = { padding: '8px', fontSize: '0.9rem' };
const filterInput: React.CSSProperties = { width: '100%', padding: '3px 6px', background: '#0f0f1e', border: '1px solid #333', borderRadius: '3px', color: '#eee', fontSize: '0.8rem', boxSizing: 'border-box' };
const btnStyle: React.CSSProperties = { padding: '6px 16px', background: '#0f3460', color: '#e94560', border: '1px solid #e94560', borderRadius: '6px', cursor: 'pointer' };
const statCard: React.CSSProperties = { background: '#16213e', borderRadius: '12px', padding: '1rem 1.5rem', textAlign: 'center', flex: 1 };
const errorStyle: React.CSSProperties = { background: '#f44336', color: '#fff', padding: '10px 20px', borderRadius: '8px', marginBottom: '1rem' };
