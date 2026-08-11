import { useLocation, useNavigate } from 'react-router-dom';
import { Card } from '@consta/uikit/Card';
import { Text } from '@consta/uikit/Text';
import { Badge } from '@consta/uikit/Badge';
import { Button } from '@consta/uikit/Button';
import { SnackBar } from '@consta/uikit/SnackBar';
import { IconChatStroked } from '@consta/icons/IconChatStroked';
import type { VerdictDTO } from '../api/client';

export default function ResultsScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const verdict = (location.state as { verdict?: VerdictDTO })?.verdict;

  if (!verdict) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
        <Card verticalSpace="l" horizontalSpace="l" col={1} style={{ textAlign: 'center' }}>
          <Text as="p" size="m" view="ghost" style={{ marginBottom: 16 }}>Результаты не найдены</Text>
          <Button label="На главную" view="primary" onClick={() => navigate('/')} />
        </Card>
      </div>
    );
  }

  const isPassed = verdict.verdict === 'PASSED';
  const isTimeout = verdict.verdict === 'TIMEOUT';
  const scoreColor = isPassed ? '#52c41a' : isTimeout ? '#faad14' : '#ff4d4f';
  const titleText = isPassed ? 'СЦЕНАРИЙ ПРОЙДЕН' : isTimeout ? 'ВРЕМЯ ВЫШЛО' : 'СЦЕНАРИЙ НЕ ПРОЙДЕН';

  return (
    <div style={{ minHeight: '100vh', padding: 24, background: '#f0f2f5' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card col={1} verticalSpace="2xl" horizontalSpace="2xl" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', fontWeight: 'bold', color: scoreColor, lineHeight: 1 }}>
            {verdict.score}
          </div>
          <Text as="div" size="xl" weight="bold" style={{ color: scoreColor, marginTop: 8 }}>
            {titleText}
          </Text>
          <Text as="p" size="m" view="ghost" style={{ marginTop: 8 }}>
            Попытка: {verdict.attempt}
          </Text>
          {verdict.aiUsed && (
            <div style={{ marginTop: 8 }}>
              <Badge iconLeft={IconChatStroked} label="ИИ-оценка использована" status="system" />
            </div>
          )}
        </Card>

        {verdict.achievements.length > 0 && (
          <Card col={1} verticalSpace="l" horizontalSpace="l">
            <Text as="h3" size="l" weight="semibold" style={{ marginBottom: 12 }}>Достижения</Text>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {verdict.achievements.map((ach, i) => (
                <Badge key={i} label={ach} status="normal" view="filled" />
              ))}
            </div>
          </Card>
        )}

        {verdict.feedback.length > 0 && (
          <Card col={1} verticalSpace="l" horizontalSpace="l">
            <Text as="h3" size="l" weight="semibold" style={{ marginBottom: 12 }}>Обратная связь</Text>
            <SnackBar items={verdict.feedback.map((fb, i) => ({
              key: String(i),
              message: fb.text,
              status: fb.type === 'SAFETY_VIOLATION' ? 'error' :
                      fb.type === 'SEQUENCE_ERROR' || fb.type === 'OUT_OF_RANGE' ? 'warning' :
                      'info',
            }))} />
          </Card>
        )}

        <div style={{ textAlign: 'center' }}>
          <Button label="Новый сценарий" size="l" view="primary" onClick={() => navigate('/')} />
        </div>
      </div>
    </div>
  );
}
