import { useParams, useLocation, useNavigate } from 'react-router-dom';
import type { VerdictDTO } from '../api/client';

const COMPONENT_LABELS: Record<string, string> = {
  correctness: 'Правильность',
  sequence: 'Последовательность',
  efficiency: 'Эффективность',
  safety: 'Безопасность',
  timing: 'Тайминг',
  semantics: 'Семантика (ИИ)',
  reasoning: 'Рассуждения (ИИ)',
};

const FEEDBACK_LABELS: Record<string, string> = {
  SEQUENCE_ERROR: 'Ошибка последовательности',
  OUT_OF_RANGE: 'Выход за пределы',
  SAFETY_VIOLATION: 'Нарушение безопасности',
  TIMING: 'Тайминг',
  SEMANTIC: 'Семантическая ошибка',
};

export default function ResultsScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const verdict = (location.state as { verdict?: VerdictDTO })?.verdict;

  if (!verdict) {
    return (
      <div style={{ minHeight: '100vh', background: '#1a1a2e', color: '#eee', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <p>Результаты не найдены</p>
        <button onClick={() => navigate('/')} style={btnStyle}>На главную</button>
      </div>
    );
  }

  const isPassed = verdict.verdict === 'PASSED';
  const scoreColor = isPassed ? '#4caf50' : '#f44336';

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a2e', color: '#eee', padding: '2rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>Результаты</h1>

        {/* Score Card */}
        <div style={{ background: '#16213e', borderRadius: '12px', padding: '2rem', marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{
            fontSize: '4rem',
            fontWeight: 'bold',
            color: scoreColor,
            marginBottom: '0.5rem',
          }}>
            {verdict.score}
          </div>
          <div style={{ fontSize: '1.5rem', color: isPassed ? '#4caf50' : '#f44336' }}>
            {isPassed ? 'СЦЕНАРИЙ ПРОЙДЕН' : verdict.verdict === 'TIMEOUT' ? 'ВРЕМЯ ВЫШЛО' : 'СЦЕНАРИЙ НЕ ПРОЙДЕН'}
          </div>
          <div style={{ color: '#888', marginTop: '0.5rem' }}>
            Попытка: {verdict.attempt} | Сессия: {sessionId}
          </div>
          {verdict.aiUsed && (
            <div style={{ marginTop: '0.5rem', padding: '4px 12px', background: '#0f3460', borderRadius: '12px', display: 'inline-block', fontSize: '0.8rem' }}>
              ИИ-оценка использована
            </div>
          )}
        </div>

        {/* Component Breakdown */}
        <div style={{ background: '#16213e', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
          <h3>Разбивка по компонентам</h3>
          {Object.entries(verdict.componentScores).map(([comp, score]) => (
            <div key={comp} style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>{COMPONENT_LABELS[comp] || comp}</span>
                <span>{(score * 100).toFixed(0)}%</span>
              </div>
              <div style={{ background: '#0f0f1e', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(score * 100, 100)}%`,
                  height: '100%',
                  background: score > 0.7 ? '#4caf50' : score > 0.4 ? '#ff9800' : '#f44336',
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* Achievements */}
        {verdict.achievements.length > 0 && (
          <div style={{ background: '#16213e', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
            <h3>Достижения</h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {verdict.achievements.map((ach, i) => (
                <span key={i} style={{ padding: '6px 16px', background: '#0f3460', borderRadius: '20px', border: '1px solid #e94560', color: '#e94560' }}>
                  {ach}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Feedback */}
        {verdict.feedback.length > 0 && (
          <div style={{ background: '#16213e', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
            <h3>Обратная связь</h3>
            {verdict.feedback.map((fb, i) => (
              <div key={i} style={{
                padding: '10px',
                marginBottom: '8px',
                background: '#0f0f1e',
                borderRadius: '6px',
                borderLeft: `3px solid ${
                  fb.type === 'SAFETY_VIOLATION' ? '#f44336' :
                  fb.type === 'SEQUENCE_ERROR' ? '#ff9800' :
                  fb.type === 'OUT_OF_RANGE' ? '#ff9800' :
                  '#2196f3'
                }`,
              }}>
                <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '2px' }}>
                  {FEEDBACK_LABELS[fb.type] || fb.type.replace(/_/g, ' ')}
                </div>
                <div>{fb.text}</div>
                {fb.hint && <div style={{ color: '#aaa', fontSize: '0.85rem', marginTop: '4px' }}>💡 {fb.hint}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button onClick={() => navigate('/')} style={{ ...btnStyle, background: '#0f3460', border: '2px solid #e94560', color: '#e94560', fontSize: '1.1rem', padding: '12px 32px' }}>
            Новый сценарий
          </button>
        </div>
      </div>
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
