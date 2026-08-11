import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@consta/uikit/Card';
import { Badge } from '@consta/uikit/Badge';
import { Button } from '@consta/uikit/Button';
import { Text } from '@consta/uikit/Text';
import { SkeletonBrick } from '@consta/uikit/Skeleton';
import { IconPlay } from '@consta/icons/IconPlay';
import { useSimStore, type SessionMode } from '../store/simStore';
import type { ScenarioDTO } from '../api/client';

export default function ScenarioSelect({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const { scenarios, loadScenarios, startSession, loading, error } = useSimStore();
  const [selected, setSelected] = useState<ScenarioDTO | null>(null);
  const [mode, setMode] = useState<SessionMode>('training');

  useEffect(() => {
    loadScenarios();
  }, []);

  const handleStart = async () => {
    if (!selected) return;
    await startSession(selected.id, mode);
    const session = useSimStore.getState().session;
    if (session) navigate(`/operator/${session.id}`);
  };

  const difficultyStatus = (d: number) => d <= 1 ? 'success' : d === 2 ? 'warning' : 'error';

  const content = (
    <>
      {error && (
        <Card col={1} verticalSpace="s" horizontalSpace="m" style={{ marginBottom: 16, background: '#fff1f0', borderColor: '#ffa39e' }}>
          <Text view="alert">{error}</Text>
        </Card>
      )}
      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
          {[0, 1, 2].map(i => (
            <Card key={i} verticalSpace="l" horizontalSpace="l" col={1}>
              <SkeletonBrick height="150px" width="100%" />
            </Card>
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
        {scenarios.map((sc) => (
          <Card
            key={sc.id}
            verticalSpace="l"
            horizontalSpace="l"
            col={1}
            style={{
              cursor: 'pointer',
              border: selected?.id === sc.id ? '2px solid #1677ff' : undefined,
              transition: 'border 0.2s',
            }}
            onClick={() => setSelected(sc)}
          >
            <Text as="h3" size="l" weight="semibold" style={{ marginBottom: 8 }}>{sc.name}</Text>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <Badge status={difficultyStatus(sc.difficulty)} label={`Сложность: ${sc.difficulty}/3`} />
              <Badge label={`${sc.timeoutSec / 60} мин`} />
              <Badge label={`Проходной: ${sc.passingScore}`} />
              {sc.initialState && sc.initialState.length > 0 && (
                <Badge status="system" label={`Старт с ${sc.initialState.length} узлами`} />
              )}
            </div>
            <Text as="p" size="s" view="ghost" style={{ marginBottom: 4 }}>Фаз: {sc.phases.length}</Text>
            {sc.phases.map((ph) => (
              <Text key={ph.id} as="p" size="xs" view="ghost">
                • {ph.title} ({ph.expectedActions.length} действий)
              </Text>
            ))}
          </Card>
        ))}
      </div>
      {selected && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, background: '#fff', padding: 8, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
            <Button
              label="Тренировка"
              size="m"
              view={mode === 'training' ? 'primary' : 'ghost'}
              onClick={() => setMode('training')}
            />
            <Button
              label="Экзамен"
              size="m"
              view={mode === 'exam' ? 'primary' : 'ghost'}
              onClick={() => setMode('exam')}
            />
            <Button
              label={`Начать: ${selected.name}`}
              size="m"
              view="primary"
              iconLeft={IconPlay}
              loading={loading}
              onClick={handleStart}
            />
          </div>
          {mode === 'exam' && (
            <Text size="s" style={{ color: '#ff4d4f', background: '#fff', padding: '2px 8px', borderRadius: 4 }}>
              Режим экзамена: подсказки и ИИ отключены, ограничение по времени
            </Text>
          )}
        </div>
      )}
    </>
  );

  if (embedded) return <div>{content}</div>;
  return <div style={{ padding: 24 }}>{content}</div>;
}
