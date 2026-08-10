import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';

interface ServiceStatus {
  name: string;
  status: string;
  detail?: string;
}

export default function AdminPanel() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    checkServices();
  }, []);

  const checkServices = async () => {
    setChecking(true);
    const results: ServiceStatus[] = [];

    // Backend: try API call (relative URL, goes through nginx proxy)
    try {
      await apiClient.listScenarios();
      results.push({ name: 'Backend API', status: 'OK' });
    } catch (e: any) {
      const code = e?.response?.status;
      results.push({ name: 'Backend API', status: code ? `${code}` : 'DOWN', detail: e?.message });
    }

    // Backend actuator health (relative URL)
    try {
      const res = await fetch('/actuator/health');
      if (res.ok) {
        const json = await res.json();
        results.push({ name: 'Backend Health', status: json.status === 'UP' ? 'OK' : json.status });
      } else {
        results.push({ name: 'Backend Health', status: `${res.status}` });
      }
    } catch {
      results.push({ name: 'Backend Health', status: 'DOWN' });
    }

    // Frontend: if this page loaded, frontend is up
    results.push({ name: 'Frontend', status: 'OK' });

    // Keycloak: check via backend proxy (avoids CORS)
    try {
      const res = await fetch('/api/health/keycloak');
      if (res.ok) {
        const json = await res.json();
        results.push({ name: 'Keycloak', status: json.status === 'UP' ? 'OK' : json.status });
      } else {
        results.push({ name: 'Keycloak', status: `${res.status}` });
      }
    } catch {
      results.push({ name: 'Keycloak', status: 'НЕДОСТУПЕН' });
    }

    setServices(results);
    setChecking(false);
  };

  const statusColor = (s: string) => {
    if (s === 'OK' || s === 'UP') return '#4caf50';
    if (s === 'DOWN' || s === 'НЕДОСТУПЕН') return '#f44336';
    return '#ff9800';
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Админ-панель</h2>
      <p style={{ color: '#aaa' }}>Состояние сервисов и системный мониторинг</p>

      <div style={{ background: '#16213e', borderRadius: '12px', padding: '1.5rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Сервисы</h3>
          <button onClick={checkServices} disabled={checking} style={btnStyle}>
            {checking ? 'Проверка...' : 'Обновить'}
          </button>
        </div>
        {services.map((s) => (
          <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #222' }}>
            <span>{s.name}</span>
            <span style={{ color: statusColor(s.status) }}>{s.status}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div style={{ background: '#16213e', borderRadius: '12px', padding: '1.5rem' }}>
          <h3>Управление</h3>
          <ul style={{ color: '#aaa', lineHeight: 1.8 }}>
            <li>Управление пользователями (через Keycloak)</li>
            <li>Управление ролями</li>
            <li>Просмотр всех сессий</li>
            <li>Управление сценариями</li>
            <li>Конфигурация ИИ-модулей</li>
          </ul>
        </div>
        <div style={{ background: '#16213e', borderRadius: '12px', padding: '1.5rem' }}>
          <h3>Ссылки</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <a href="/actuator/health" target="_blank" style={{ color: '#e94560' }}>Проверка backend →</a>
            <a href="/api/scenarios" target="_blank" style={{ color: '#e94560' }}>API: Сценарии →</a>
            <a href="/api/graph" target="_blank" style={{ color: '#e94560' }}>API: Граф →</a>
          </div>
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = { padding: '6px 16px', background: '#0f3460', color: '#e94560', border: '1px solid #e94560', borderRadius: '6px', cursor: 'pointer' };
