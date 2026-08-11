import { useEffect, useState } from 'react';
import { Card } from '@consta/uikit/Card';
import { Button } from '@consta/uikit/Button';
import { Badge } from '@consta/uikit/Badge';
import { Text } from '@consta/uikit/Text';
import { IconRestart } from '@consta/icons/IconRestart';
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

    try {
      await apiClient.listScenarios();
      results.push({ name: 'Backend API', status: 'OK' });
    } catch (e: any) {
      const code = e?.response?.status;
      results.push({ name: 'Backend API', status: code ? `${code}` : 'DOWN', detail: e?.message });
    }

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

    results.push({ name: 'Frontend', status: 'OK' });

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

  const badgeStatus = (s: string): 'success' | 'error' | 'warning' | 'system' => {
    if (s === 'OK' || s === 'UP') return 'success';
    if (s === 'DOWN' || s === 'НЕДОСТУПЕН') return 'error';
    return 'warning';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <Text as="h2" size="xl" weight="bold" style={{ margin: 0, marginBottom: 4 }}>Админ-панель</Text>
        <Text as="p" size="m" view="ghost">Состояние сервисов и системный мониторинг</Text>
      </div>

      <Card col={1} verticalSpace="l" horizontalSpace="l">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text as="h3" size="l" weight="semibold">Сервисы</Text>
          <Button label={checking ? 'Проверка...' : 'Обновить'} size="s" view="ghost" iconLeft={IconRestart} loading={checking} onClick={checkServices} />
        </div>
        {services.map((s) => (
          <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
            <Text size="m">{s.name}</Text>
            <Badge status={badgeStatus(s.status)} label={s.status} />
          </div>
        ))}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card col={1} verticalSpace="l" horizontalSpace="l">
          <Text as="h3" size="l" weight="semibold" style={{ marginBottom: 8 }}>Управление</Text>
          <ul style={{ color: '#888', lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
            <li>Управление пользователями (через Keycloak)</li>
            <li>Управление ролями</li>
            <li>Просмотр всех сессий</li>
            <li>Управление сценариями</li>
            <li>Конфигурация ИИ-модулей</li>
          </ul>
        </Card>
        <Card col={1} verticalSpace="l" horizontalSpace="l">
          <Text as="h3" size="l" weight="semibold" style={{ marginBottom: 8 }}>Ссылки</Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <a href="/actuator/health" target="_blank" style={{ color: '#1677ff' }}>Проверка backend →</a>
            <a href="/api/scenarios" target="_blank" style={{ color: '#1677ff' }}>API: Сценарии →</a>
            <a href="/api/graph" target="_blank" style={{ color: '#1677ff' }}>API: Граф →</a>
          </div>
        </Card>
      </div>
    </div>
  );
}
