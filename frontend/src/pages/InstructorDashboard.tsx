import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { Card } from '@consta/uikit/Card';
import { Text } from '@consta/uikit/Text';
import { Button } from '@consta/uikit/Button';
import { Badge } from '@consta/uikit/Badge';
import { Table, TableColumn } from '@consta/uikit/Table';
import { Select } from '@consta/uikit/Select';
import { IconRestart } from '@consta/icons/IconRestart';
import { IconDownload } from '@consta/icons/IconDownload';
import { IconChatStroked } from '@consta/icons/IconChatStroked';
import { apiClient, type SessionInfoDTO, type ScenarioDTO, type ExamAssignmentDTO, type KeycloakUserDTO } from '../api/client';

const SCENARIO_NAMES: Record<string, string> = {
  startup: 'Пуск установки',
  shutdown: 'Остановка установки',
  emergency_pump_failure: 'Нештатная ситуация: отказ насоса Н-82',
};

const VERDICT_LABELS: Record<string, string> = {
  PASSED: 'Пройден',
  FAILED: 'Не пройден',
  TIMEOUT: 'Время вышло',
};

type SortField = 'userId' | 'scenarioId' | 'attempt' | 'score' | 'verdict' | 'status' | 'duration';
type SortDir = 'asc' | 'desc';

function formatDuration(sec: number): string {
  if (sec <= 0) return '-';
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
  const [sortField] = useState<SortField>('userId');
  const [sortDir] = useState<SortDir>('asc');
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [scenarios, setScenarios] = useState<ScenarioDTO[]>([]);
  const [assignments, setAssignments] = useState<ExamAssignmentDTO[]>([]);
  const [assignScenario, setAssignScenario] = useState<ScenarioDTO | null>(null);
  const [assignStudent, setAssignStudent] = useState<KeycloakUserDTO | null>(null);
  const [users, setUsers] = useState<KeycloakUserDTO[]>([]);

  useEffect(() => {
    refresh();
    apiClient.listScenarios().then(setScenarios).catch(() => {});
    apiClient.listKeycloakUsers().then(setUsers).catch(() => {});
    refreshAssignments();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  const refreshAssignments = async () => {
    try { setAssignments(await apiClient.listExamAssignments()); } catch {}
  };

  const handleAssign = async () => {
    if (!assignScenario || !assignStudent) return;
    try {
      await apiClient.assignExam(assignScenario.id, assignStudent.username);
      setAssignStudent(null);
      refreshAssignments();
    } catch (e: any) {
      alert('Ошибка назначения: ' + e.message);
    }
  };

  const handleRemoveAssignment = async (id: string) => {
    try { await apiClient.removeExamAssignment(id); refreshAssignments(); } catch {}
  };

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

  const sorted = [...sessions].sort((a, b) => {
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

  const columns: TableColumn<SessionInfoDTO>[] = [
    {
      title: 'Студент',
      accessor: 'userId',
      align: 'left',
      renderCell: (row) => <Text size="m">{row.userId}</Text>,
    },
    {
      title: 'Сценарий',
      accessor: 'scenarioId',
      align: 'left',
      renderCell: (row) => <Text size="m">{SCENARIO_NAMES[row.scenarioId] || row.scenarioId}</Text>,
    },
    {
      title: 'Попытка',
      accessor: 'attempt',
      align: 'center',
      renderCell: (row) => <Text size="m">#{row.attempt}</Text>,
    },
    {
      title: 'Балл',
      accessor: 'id',
      align: 'center',
      renderCell: (row) => row.verdict ? (
        <Text size="m" weight="bold" style={{ color: row.verdict.verdict === 'PASSED' ? '#52c41a' : row.verdict.verdict === 'TIMEOUT' ? '#faad14' : '#ff4d4f' }}>
          {row.verdict.score}
        </Text>
      ) : <Text view="ghost">-</Text>,
    },
    {
      title: 'Результат',
      accessor: 'active',
      align: 'center',
      renderCell: (row) => row.verdict ? (
        <Badge
          status={row.verdict.verdict === 'PASSED' ? 'success' : row.verdict.verdict === 'TIMEOUT' ? 'warning' : 'error'}
          label={VERDICT_LABELS[row.verdict.verdict] || row.verdict.verdict}
        />
      ) : <Text view="ghost">-</Text>,
    },
    {
      title: 'Статус',
      accessor: 'startedAt',
      align: 'center',
      renderCell: (row) => (
        <Badge status={row.active ? 'warning' : 'system'} label={row.active ? 'Активна' : 'Завершена'} />
      ),
    },
    {
      title: 'Время',
      accessor: 'durationSec',
      align: 'left',
      renderCell: (row) => <Text size="s">{formatDuration(row.durationSec)}</Text>,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <Text as="h2" size="xl" weight="bold" style={{ margin: 0, marginBottom: 4 }}>Панель преподавателя</Text>
        <Text as="p" size="m" view="ghost">Мониторинг сессий и результатов студентов</Text>
      </div>

      {error && (
        <Card verticalSpace="s" horizontalSpace="m" style={{ background: '#fff1f0', borderColor: '#ffa39e' }}>
          <Text view="alert">{error}</Text>
        </Card>
      )}

      <div style={{ display: 'flex', gap: 16 }}>
        <Card verticalSpace="m" horizontalSpace="l" style={{ flex: 1, textAlign: 'center' }}>
          <Text size="2xl" weight="bold">{sessions.length}</Text>
          <Text as="div" size="s" view="ghost">Всего сессий</Text>
        </Card>
        <Card verticalSpace="m" horizontalSpace="l" style={{ flex: 1, textAlign: 'center' }}>
          <Text size="2xl" weight="bold" style={{ color: '#faad14' }}>{active.length}</Text>
          <Text as="div" size="s" view="ghost">Активных</Text>
        </Card>
        <Card verticalSpace="m" horizontalSpace="l" style={{ flex: 1, textAlign: 'center' }}>
          <Text size="2xl" weight="bold" style={{ color: '#52c41a' }}>{completed.filter(s => s.verdict?.verdict === 'PASSED').length}</Text>
          <Text as="div" size="s" view="ghost">Пройдено</Text>
        </Card>
        <Card verticalSpace="m" horizontalSpace="l" style={{ flex: 1, textAlign: 'center' }}>
          <Text size="2xl" weight="bold" style={{ color: '#ff4d4f' }}>{completed.filter(s => s.verdict?.verdict === 'FAILED').length}</Text>
          <Text as="div" size="s" view="ghost">Не пройдено</Text>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <Card col={1} verticalSpace="l" horizontalSpace="l">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text as="h3" size="l" weight="semibold">Результаты сессий</Text>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button label="Выгрузить XLSX" size="s" view="secondary" iconLeft={IconDownload} onClick={() => exportXlsx(sorted)} />
              <Button label="Обновить" size="s" view="ghost" iconLeft={IconRestart} onClick={refresh} />
            </div>
          </div>
          {sessions.length === 0 ? (
            <Text as="p" size="m" view="ghost" style={{ textAlign: 'center', padding: 32 }}>
              Нет завершённых сессий. Студенты ещё не проходили сценарии.
            </Text>
          ) : (
            <Table
              columns={columns as any}
              rows={sorted as any}
              onRowClick={({ id }: { id: string; e: React.MouseEvent }) => {
                const row = sorted.find(s => s.id === id);
                if (row) setSelected(row);
              }}
              zebraStriped="odd"
              borderBetweenRows
              borderBetweenColumns
            />
          )}
        </Card>

        <Card col={1} verticalSpace="l" horizontalSpace="l">
          <Text as="h3" size="l" weight="semibold" style={{ marginBottom: 12 }}>Детали</Text>
          {!selected && <Text as="p" size="m" view="ghost">Выберите сессию из таблицы</Text>}
          {selected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <Text size="s" view="ghost">Студент</Text>
                <Text size="m" weight="semibold">{selected.userId}</Text>
              </div>
              <div>
                <Text size="s" view="ghost">Сценарий</Text>
                <Text size="m">{SCENARIO_NAMES[selected.scenarioId] || selected.scenarioId}</Text>
              </div>
              <div>
                <Text size="s" view="ghost">Попытка</Text>
                <Text size="m">#{selected.attempt}</Text>
              </div>
              <div>
                <Text size="s" view="ghost">Продолжительность</Text>
                <Text size="m">{formatDuration(selected.durationSec)}</Text>
              </div>
              {selected.verdict && (
                <>
                  <div>
                    <Text size="s" view="ghost">Балл</Text>
                    <Text size="xl" weight="bold" style={{ color: selected.verdict.verdict === 'PASSED' ? '#52c41a' : selected.verdict.verdict === 'TIMEOUT' ? '#faad14' : '#ff4d4f' }}>
                      {selected.verdict.score} / 100
                    </Text>
                  </div>
                  {selected.verdict.feedback.length > 0 && (
                    <div>
                      <Text size="s" view="ghost" style={{ marginBottom: 4 }}>Обратная связь</Text>
                      {selected.verdict.feedback.map((f, i) => (
                        <div key={i} style={{ padding: 8, background: '#f5f5f5', borderRadius: 4, marginBottom: 4 }}>
                          <Text size="s">{f.text}</Text>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    label={aiLoading ? 'МадИИна анализирует...' : '🤖 МадИИна-разбор результатов'}
                    size="s"
                    view="primary"
                    iconLeft={IconChatStroked}
                    width="full"
                    loading={aiLoading}
                    onClick={fetchAiAnalysis}
                  />
                  {aiAnalysis && (
                    <Card verticalSpace="s" horizontalSpace="m" style={{ background: '#f9f0ff', borderColor: '#d3adf3' }}>
                      <Text size="s" weight="semibold" style={{ color: '#722ed1', marginBottom: 4 }}>🤖 МадИИна-анализ</Text>
                      <Text size="s" view="ghost">{aiAnalysis}</Text>
                      <Button label="Закрыть" size="xs" view="ghost" style={{ marginTop: 4 }} onClick={() => setAiAnalysis(null)} />
                    </Card>
                  )}
                </>
              )}
              {!selected.verdict && (
                <Card verticalSpace="s" horizontalSpace="m" style={{ background: '#fffbe6', borderColor: '#ffe58f' }}>
                  <Text size="s" style={{ color: '#faad14' }}>Сессия ещё не завершена</Text>
                </Card>
              )}
            </div>
          )}
        </Card>
      </div>

      <Card col={1} verticalSpace="l" horizontalSpace="l">
        <Text as="h3" size="l" weight="semibold" style={{ marginBottom: 12 }}>Назначение экзаменов</Text>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ minWidth: 250 }}>
            <Text size="s" view="ghost" style={{ marginBottom: 4 }}>Сценарий</Text>
            <Select
              items={scenarios}
              value={assignScenario}
              onChange={(value) => setAssignScenario(value as ScenarioDTO | null)}
              getItemKey={(s: ScenarioDTO) => s.id}
              getItemLabel={(s: ScenarioDTO) => s.name}
              placeholder="Выберите сценарий"
            />
          </div>
          <div style={{ minWidth: 250 }}>
            <Text size="s" view="ghost" style={{ marginBottom: 4 }}>Студент</Text>
            <Select
              items={users}
              value={assignStudent}
              onChange={(value) => setAssignStudent(value as KeycloakUserDTO | null)}
              getItemKey={(u: KeycloakUserDTO) => u.id}
              getItemLabel={(u: KeycloakUserDTO) => `${u.username}${u.firstName ? ' - ' + u.firstName + ' ' + u.lastName : ''}`}
              placeholder="Выберите студента"
            />
          </div>
          <Button
            label="Назначить экзамен"
            size="m"
            view="primary"
            onClick={handleAssign}
            disabled={!assignScenario || !assignStudent}
          />
        </div>
        {assignments.length === 0 ? (
          <Text as="p" size="m" view="ghost">Нет назначенных экзаменов</Text>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {assignments.map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
                <div>
                  <Text size="m" weight="semibold">{a.scenarioName}</Text>
                  <Text size="s" view="ghost">Студент: {a.studentId} | Назначил: {a.assignedBy} | {new Date(a.assignedAt).toLocaleString('ru-RU')}</Text>
                </div>
                <Button label="Снять" size="xs" view="ghost" onClick={() => handleRemoveAssignment(a.id)} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
