import { useEffect, useState } from 'react';

export default function AdminPanel() {
  const [services, setServices] = useState<{ name: string; url: string; status: string }[]>([]);

  useEffect(() => {
    checkServices();
  }, []);

  const checkServices = async () => {
    const list = [
      { name: 'Backend API', url: 'http://localhost:8080/actuator/health', },
      { name: 'Keycloak', url: 'http://localhost:8180/realms/elouav' },
      { name: 'Frontend', url: 'http://localhost:3000' },
    ];
    const results = await Promise.all(
      list.map(async (s) => {
        try {
          const res = await fetch(s.url);
          return { ...s, status: res.ok ? 'OK' : `${res.status}` };
        } catch {
          return { ...s, status: 'DOWN' };
        }
      })
    );
    setServices(results);
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Админ-панель</h2>
      <p style={{ color: '#aaa' }}>Состояние сервисов и системный мониторинг</p>

      <div style={{ background: '#16213e', borderRadius: '12px', padding: '1.5rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Сервисы</h3>
          <button onClick={checkServices} style={btnStyle}>Обновить</button>
        </div>
        {services.map((s) => (
          <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #222' }}>
            <span>{s.name}</span>
            <span style={{ color: s.status === 'OK' ? '#4caf50' : '#f44336' }}>{s.status}</span>
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
            <a href="http://localhost:8180" target="_blank" style={{ color: '#e94560' }}>Keycloak Admin →</a>
            <a href="http://localhost:8080/actuator/health" target="_blank" style={{ color: '#e94560' }}>Backend Health →</a>
            <a href="http://localhost:8080/api/scenarios" target="_blank" style={{ color: '#e94560' }}>API: Сценарии →</a>
            <a href="http://localhost:8080/api/graph" target="_blank" style={{ color: '#e94560' }}>API: Граф →</a>
          </div>
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = { padding: '6px 16px', background: '#0f3460', color: '#e94560', border: '1px solid #e94560', borderRadius: '6px', cursor: 'pointer' };
