import { useEffect, useState } from 'react';
import { apiClient, type ScenarioDTO } from '../api/client';

export default function MethodistPanel() {
  const [scenarios, setScenarios] = useState<ScenarioDTO[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setScenarios(await apiClient.listScenarios());
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Панель методиста</h2>
      <p style={{ color: '#aaa' }}>Управление сценариями обучения</p>

      {error && <div style={errorStyle}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div style={{ background: '#16213e', borderRadius: '12px', padding: '1.5rem' }}>
          <h3>Сценарии ({scenarios.length})</h3>
          {scenarios.map((sc) => (
            <div key={sc.id} style={{ padding: '12px', background: '#0f0f1e', borderRadius: '8px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{sc.name}</strong>
                <span style={{ color: '#888', fontSize: '0.85rem' }}>{sc.id}</span>
              </div>
              <div style={{ color: '#aaa', fontSize: '0.85rem', marginTop: '4px' }}>
                Сложность: {sc.difficulty}/3 | Фаз: {sc.phases.length} | Время: {sc.timeoutSec / 60} мин
              </div>
              <div style={{ color: '#666', fontSize: '0.8rem', marginTop: '4px' }}>
                {sc.phases.map(p => p.title).join(' → ')}
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: '#16213e', borderRadius: '12px', padding: '1.5rem' }}>
          <h3>Функции методиста</h3>
          <ul style={{ color: '#aaa', lineHeight: 1.8 }}>
            <li>Просмотр и редактирование сценариев</li>
            <li>Настройка фаз и ожидаемых действий</li>
            <li>Управление подсказками</li>
            <li>Настройка критериев оценки</li>
            <li>Адаптивные сценарии на основе ИИ</li>
          </ul>
          <div style={{ marginTop: '1rem', padding: '12px', background: '#0f0f1e', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 8px', color: '#e94560' }}>Создать сценарий</h4>
            <p style={{ color: '#666', fontSize: '0.85rem', margin: 0 }}>
              В MVP доступен просмотр. Создание сценариев через JSON-конфиг.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const errorStyle: React.CSSProperties = { background: '#f44336', color: '#fff', padding: '10px 20px', borderRadius: '8px', marginBottom: '1rem' };
