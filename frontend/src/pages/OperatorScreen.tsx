import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '@consta/uikit/Card';
import { Text } from '@consta/uikit/Text';
import { Button } from '@consta/uikit/Button';
import { TextField } from '@consta/uikit/TextField';
import { Modal } from '@consta/uikit/Modal';
import { IconExit } from '@consta/icons/IconExit';
import { IconLightningBolt } from '@consta/icons/IconLightningBolt';
import { IconInfo } from '@consta/icons/IconInfo';
import { IconChatStroked } from '@consta/icons/IconChatStroked';
import { IconCollapse } from '@consta/icons/IconCollapse';
import { IconExpand } from '@consta/icons/IconExpand';
import { useSimStore } from '../store/simStore';
import { apiClient, type VerdictDTO } from '../api/client';

const MODE_LABELS: Record<string, string> = {
  STOPPED: 'Остановлен',
  RUNNING: 'Работает',
  ALARM: 'Авария',
  MAINTENANCE: 'Обслуживание',
};

const TYPE_LABELS: Record<string, string> = {
  feed_pump: 'Насос',
  preheater: 'Смеситель',
  electrodehydrator: 'Электродегидратор',
  tank: 'Ёмкость',
  regulator: 'Регулятор',
  output: 'Выход',
  heat_exchanger: 'Теплообменник',
  column: 'Колонна',
};

const RESULT_LABELS: Record<string, string> = {
  Applied: 'Применено',
  Clamped: 'Ограничено',
  Rejected: 'Отклонено',
  Alarm: 'Авария',
};

const NODE_LABELS: Record<string, string> = {
  feed_pump: 'Н-82',
  preheater: 'А-19',
  dehydrator: 'Э-1',
  tank: 'Е-16',
  regulator: 'Р-11',
  output: 'Выход',
  heat_exchanger: 'Т-1',
  column: 'К-1',
};

const ACTION_LABELS: Record<string, string> = {
  start: 'Пуск',
  stop: 'Остановка',
  set_power: 'Мощность, %',
  set_temp: 'Температура, °C',
  set_valve: 'Задвижка, %',
  set_voltage: 'Подача напряжения',
  increase_drain: 'Увеличить сброс в Е-16',
  set_drain: 'Расход слива, м³/ч',
};

function actionLabel(actionId: string): string {
  return ACTION_LABELS[actionId] || actionId;
}

const PARAM_LABELS: Record<string, string> = {
  power_percent: 'Мощность',
  flow_rate: 'Расход',
  pressure_out: 'Давление',
  temperature: 'Температура',
  inlet_flow: 'Вх.расход',
  inlet_temp: 'Вх.темп',
  pressure: 'Давление',
  level_mm: 'Уровень, мм',
  voltage_on: 'Напряжение',
  water_content: 'Вода',
  salt_mg_l: 'Соли',
  level: 'Уровень',
  drain_flow: 'Слив',
  outlet_flow: 'Расх.вых',
  valve_pos: 'Задвижка',
  top_temp: 'Темп.верх',
  bottom_temp: 'Темп.низ',
};

function paramLabel(key: string): string {
  return PARAM_LABELS[key] || key;
}

function formatTime(sec: number): string {
  if (sec <= 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function OperatorScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { graph, currentScenario, journal, loading, error, selectScenario, applyAction } = useSimStore();
  const sessionMode = useSimStore(s => s.mode);
  const isExam = sessionMode === 'exam';
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [actionValues, setActionValues] = useState<Record<string, string>>({});
  const [verdict, setVerdict] = useState<VerdictDTO | null>(null);
  const journalRef = useRef<HTMLDivElement>(null);
  const [showHint, setShowHint] = useState(false);
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [contextHint, setContextHint] = useState<string | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [journalCollapsed, setJournalCollapsed] = useState(false);
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const endedRef = useRef(false);

  useEffect(() => {
    if (sessionId) {
      apiClient.getSession(sessionId).then(async (s) => {
        selectScenario(s.scenarioId);
        const g = await apiClient.getSessionState(sessionId);
        useSimStore.setState({ graph: g });
      });
    }
  }, [sessionId]);

  useEffect(() => {
    if (journalRef.current) journalRef.current.scrollTop = journalRef.current.scrollHeight;
  }, [journal]);

  useEffect(() => {
    if (!sessionId || !currentScenario) return;
    setRemainingSec(currentScenario.timeoutSec);
    const interval = setInterval(() => {
      setRemainingSec(prev => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(interval);
          if (!endedRef.current) {
            endedRef.current = true;
            apiClient.endSession(sessionId).then(v => setVerdict(v)).catch(() => navigate('/'));
          }
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionId, currentScenario]);

  useEffect(() => {
    if (!sessionId) return;
    const handleBeforeUnload = () => {
      if (endedRef.current) return;
      endedRef.current = true;
      const url = `${import.meta.env.VITE_API_BASE || '/api'}/sessions/${sessionId}/end`;
      navigator.sendBeacon(url);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const pollInterval = setInterval(() => {
      useSimStore.getState().pollEvents();
      apiClient.getSessionState(sessionId).then(g => useSimStore.setState({ graph: g })).catch(() => {});
    }, 5000);
    return () => clearInterval(pollInterval);
  }, [sessionId]);

  const handleAction = async (nodeId: string, actionId: string) => {
    const node = graph?.nodes.find((n) => n.id === nodeId);
    const action = node?.actions.find((a) => a.id === actionId);
    if (action?.param && action.min !== null && action.max !== null) {
      const val = parseFloat(actionValues[actionId] || '');
      if (isNaN(val)) { alert(`Введите значение от ${action.min} до ${action.max}`); return; }
      await applyAction(nodeId, actionId, val);
    } else {
      await applyAction(nodeId, actionId);
    }
    setActionValues(prev => { const n = { ...prev }; delete n[actionId]; return n; });
    const latest = useSimStore.getState().journal;
    if (latest.length > 0) {
      const lastEntry = latest[latest.length - 1];
      const affected = new Set<string>([lastEntry.node]);
      lastEntry.chain.forEach((c) => affected.add(c.node));
      setHighlightedNodes(affected);
      setTimeout(() => setHighlightedNodes(new Set()), 3000);
    }
  };

  const handleEnd = async () => {
    if (!sessionId) return;
    endedRef.current = true;
    try { const v = await apiClient.endSession(sessionId); setVerdict(v); }
    catch (e: any) { console.error(e); }
  };

  const fetchContextHint = async () => {
    if (!sessionId || isExam) return;
    try { const res = await apiClient.getContextHint(sessionId); setContextHint(res.text); }
    catch { setContextHint('Не удалось получить подсказку'); }
  };

  const fetchAiExplanation = async () => {
    if (!sessionId || journal.length === 0 || isExam) return;
    const lastEntry = journal[journal.length - 1];
    setAiLoading(true);
    try {
      const res = await apiClient.explainAction({ node: lastEntry.node, action: actionLabel(lastEntry.action), value: lastEntry.value ?? undefined, chain: lastEntry.chain });
      setAiExplanation(res.text);
    } catch { setAiExplanation('МадИИна недоступна'); }
    setAiLoading(false);
  };

  if (verdict) {
    navigate(`/results/${sessionId}`, { state: { verdict } });
    return null;
  }

  const selectedNodeData = graph?.nodes.find((n) => n.id === selectedNode);
  const timeColor = remainingSec < 60 ? '#ff4d4f' : remainingSec < 300 ? '#faad14' : isExam ? '#ff4d4f' : '#52c41a';

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', display: 'flex', flexDirection: 'column' }}>
      <Card verticalSpace="s" horizontalSpace="xl" style={{ borderRadius: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div>
            <Text as="h2" size="l" weight="bold" style={{ margin: 0 }}>КТК ЭЛОУ-АВТ - Оператор</Text>
            {currentScenario && <Text as="span" size="s" view="ghost"> {currentScenario.name}</Text>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderRadius: 4, background: isExam ? '#fff1f0' : '#f6ffed', border: `1px solid ${isExam ? '#ffa39e' : '#b7eb8f'}` }}>
            <Text size="s" weight="bold" style={{ color: isExam ? '#ff4d4f' : '#52c41a' }}>
              {isExam ? 'ЭКЗАМЕН' : 'ТРЕНИРОВКА'}
            </Text>
            <Text size="m" weight="bold" style={{ color: timeColor, fontFamily: 'monospace', minWidth: 60 }}>
              {formatTime(remainingSec)}
            </Text>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!isExam && (
            <>
              <Button label="Контекстная подсказка" size="s" view="ghost" iconLeft={IconLightningBolt} onClick={fetchContextHint} />
              <Button label="Подсказки по фазам" size="s" view="ghost" iconLeft={IconInfo} onClick={() => setShowHint(!showHint)} />
            </>
          )}
          <Button label="Завершить" size="s" view="primary" iconLeft={IconExit} onClick={handleEnd} />
        </div>
      </Card>

      {error && (
        <Card verticalSpace="s" horizontalSpace="xl" style={{ borderRadius: 0, background: '#fff1f0', borderColor: '#ffa39e' }}>
          <Text view="alert">{error}</Text>
        </Card>
      )}
      {!isExam && contextHint && (
        <Card verticalSpace="s" horizontalSpace="xl" style={{ borderRadius: 0, background: '#e6f7ff', borderColor: '#91d5ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text size="m">💡 {contextHint}</Text>
          <Button label="" size="xs" view="ghost" onClick={() => setContextHint(null)} />
        </Card>
      )}
      {!isExam && aiExplanation && (
        <Card verticalSpace="s" horizontalSpace="xl" style={{ borderRadius: 0, background: '#f9f0ff', borderColor: '#d3adf3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text size="m" style={{ color: '#722ed1' }}>🤖 МадИИна: {aiExplanation}</Text>
          <Button label="" size="xs" view="ghost" onClick={() => setAiExplanation(null)} />
        </Card>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, padding: 16, overflow: 'auto' }}>
          {currentScenario && (
            <Card verticalSpace="s" horizontalSpace="m" style={{ marginBottom: 8, background: '#e6f7ff', borderColor: '#91d5ff' }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <Text size="s" weight="bold" style={{ color: '#1677ff' }}>Фазы:</Text>
                {currentScenario.phases.map((ph, i) => (
                  <Text key={ph.id} size="s" view="ghost">{i + 1}. {ph.title}</Text>
                ))}
              </div>
            </Card>
          )}
          <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
            <Mnemoscheme graph={graph} selectedNode={selectedNode} highlightedNodes={highlightedNodes} onSelect={setSelectedNode} />
          </div>
        </div>

        <Card verticalSpace="l" horizontalSpace="l" style={{ width: 280, borderRadius: 0, borderLeft: '1px solid #e8e8e8', overflow: 'auto' }}>
          <Text as="h3" size="l" weight="semibold" style={{ marginTop: 0 }}>Действия</Text>
          {!selectedNodeData && <Text as="p" size="m" view="ghost">Выберите узел на схеме</Text>}
          {selectedNodeData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <Text size="m" weight="semibold">{NODE_LABELS[selectedNodeData.id] || selectedNodeData.name}</Text>
                <Text size="s" view="ghost">Тип: {TYPE_LABELS[selectedNodeData.type] || selectedNodeData.type} | Режим: {MODE_LABELS[selectedNodeData.mode] || selectedNodeData.mode}</Text>
              </div>
              <Card verticalSpace="s" horizontalSpace="m" style={{ background: '#f5f5f5' }}>
                {Object.entries(selectedNodeData.parameters).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text size="s" view="ghost">{selectedNodeData.paramLabels?.[k] || paramLabel(k)}:</Text>
                    <Text size="s" weight="semibold">{v.toFixed(2)}</Text>
                  </div>
                ))}
              </Card>
              {selectedNodeData.actions.map((action) => {
                const isStart = action.id === 'start';
                const isStop = action.id === 'stop';
                const isRunning = selectedNodeData.mode === 'RUNNING';
                const isStopped = selectedNodeData.mode === 'STOPPED';
                const disabled = (isStart && isRunning) || (isStop && isStopped);
                const btnLabel = actionLabel(action.id);
                return (
                  <div key={action.id}>
                    {action.param && (
                      <TextField
                        type="number"
                        placeholder={`${action.min} - ${action.max}`}
                        value={actionValues[action.id] || ''}
                        onChange={(value) => setActionValues(prev => ({ ...prev, [action.id]: value || '' }))}
                        style={{ marginBottom: 4 }}
                      />
                    )}
                    <Button
                      label={disabled ? `${btnLabel} (недоступно)` : btnLabel}
                      size="m"
                      view={isStart ? 'primary' : isStop ? 'secondary' : 'ghost'}
                      width="full"
                      disabled={disabled || loading}
                      onClick={() => handleAction(selectedNodeData.id, action.id)}
                    />
                  </div>
                );
              })}
              {!isExam && journal.length > 0 && (
                <Button
                  label={aiLoading ? 'МадИИна анализирует...' : '🤖 МадИИна-пояснение действия'}
                  size="s"
                  view="primary"
                  iconLeft={IconChatStroked}
                  width="full"
                  loading={aiLoading}
                  onClick={fetchAiExplanation}
                />
              )}
            </div>
          )}
        </Card>

        {!journalCollapsed && (
          <Card verticalSpace="l" horizontalSpace="l" style={{ width: 320, borderRadius: 0, borderLeft: '1px solid #e8e8e8', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text as="h3" size="l" weight="semibold" style={{ marginTop: 0 }}>Журнал событий</Text>
              <Button label="" size="xs" view="ghost" iconLeft={IconCollapse} onClick={() => setJournalCollapsed(true)} title="Свернуть журнал" />
            </div>
            <div ref={journalRef} style={{ flex: 1, overflow: 'auto' }}>
              {journal.length === 0 && <Text as="p" size="s" view="ghost">Нет событий</Text>}
              {journal.map((entry, idx) => {
                const isAlarm = entry.isAuto && (entry.eventType === 'ALARM');
                const isWarning = entry.isAuto && (entry.eventType === 'WARNING');
                const borderColor = isAlarm ? '#ff4d4f' : isWarning ? '#faad14' : entry.result === 'Applied' ? '#52c41a' : entry.result === 'Clamped' ? '#faad14' : '#ff4d4f';
                const bg = isAlarm ? '#fff2f0' : isWarning ? '#fffbe6' : '#f5f5f5';
                return (
                <Card key={idx} verticalSpace="s" horizontalSpace="m" style={{ marginBottom: 4, background: bg, borderLeft: `3px solid ${borderColor}` }}>
                  <Text size="xs" view="ghost">{new Date(entry.timestamp).toLocaleTimeString()}</Text>
                  {entry.isAuto && (isAlarm
                    ? <Text size="xs" weight="semibold" style={{ color: '#ff4d4f' }}>⚠ АВАРИЯ</Text>
                    : <Text size="xs" weight="semibold" style={{ color: '#faad14' }}>⚠ ПРЕДУПРЕЖДЕНИЕ</Text>
                  )}
                  <Text size="m"><strong>{NODE_LABELS[entry.node] || entry.node}</strong>: {actionLabel(entry.action)}{entry.value !== null && ` = ${entry.value.toFixed(1)}`}</Text>
                  {!entry.isAuto && <Text size="xs" view="ghost">Результат: {RESULT_LABELS[entry.result] || entry.result}</Text>}
                  {entry.chain.length > 0 && (
                    <div style={{ marginTop: 4, padding: 4, background: '#f0f9eb', borderRadius: 4 }}>
                      <Text size="xs" weight="semibold" style={{ color: '#52c41a' }}>Каскадное влияние:</Text>
                      {entry.chain.map((c, ci) => (
                        <Text key={ci} size="xs">
                          {ci > 0 && ' → '}
                          <span style={{ color: '#1677ff' }}>{NODE_LABELS[c.node] || c.node}</span>
                          <span style={{ color: '#888' }}>({c.changed.map(paramLabel).join(', ')})</span>
                        </Text>
                      ))}
                    </div>
                  )}
                </Card>
                );
              })}
            </div>
          </Card>
        )}
        {journalCollapsed && (
          <Card verticalSpace="s" horizontalSpace="s" style={{ width: 48, borderRadius: 0, borderLeft: '1px solid #e8e8e8', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, gap: 4 }}>
            <Button label="" size="xs" view="ghost" iconLeft={IconExpand} onClick={() => setJournalCollapsed(false)} title="Развернуть журнал" />
            <Text size="xs" view="ghost" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', marginTop: 4 }}>Журнал ({journal.length})</Text>
          </Card>
        )}
      </div>

      {!isExam && showHint && currentScenario && (
        <Modal isOpen={showHint} onClickOutside={() => setShowHint(false)}>
          <Card verticalSpace="l" horizontalSpace="l" style={{ minWidth: 400 }}>
            <Text as="h3" size="l" weight="semibold" style={{ marginBottom: 12 }}>Подсказки по фазам</Text>
            {currentScenario.phases.map((ph) => (
              <div key={ph.id} style={{ marginBottom: 12 }}>
                <Text size="m" weight="semibold" style={{ color: '#1677ff' }}>{ph.title}</Text>
                <Text size="s" view="ghost">
                  {currentScenario.bankHints?.find((h: any) => h.key === ph.id)?.text || 'Нет подсказки'}
                </Text>
              </div>
            ))}
            <Button label="Закрыть" size="s" view="ghost" onClick={() => setShowHint(false)} />
          </Card>
        </Modal>
      )}
    </div>
  );
}

interface SchemeColors {
  bg: string;
  pipe: string; pipeSignal: string; arrow: string;
  equipFill: string; equipStroke: string; equipDark: string;
  textMain: string; textSec: string;
  instrBg: string; instrBorder: string; instrDivider: string;
  paramBg: string; paramBorder: string;
  activeGreen: string; stoppedGray: string; alarmRed: string; warnOrange: string;
  select: string; highlight: string;
  water: string; hv: string;
}

const SCHEME_COLORS: SchemeColors = {
  bg: '#FAFAF7',
  pipe: '#5A2923', pipeSignal: '#666666', arrow: '#5A2923',
  equipFill: '#D8DCE0', equipStroke: '#444444', equipDark: '#B8BEC4',
  textMain: '#111111', textSec: '#555555',
  instrBg: '#FFFFFF', instrBorder: '#333333', instrDivider: '#333333',
  paramBg: '#FFFFFF', paramBorder: '#1565C0',
  activeGreen: '#2E7D32', stoppedGray: '#888888', alarmRed: '#C62828', warnOrange: '#E65100',
  select: '#1565C0', highlight: '#E65100',
  water: '#1565C0', hv: '#E65100',
};

const FONT_FAMILY = 'Arial, Helvetica, sans-serif';

function Mnemoscheme({ graph, selectedNode, highlightedNodes, onSelect }: {
  graph: any;
  selectedNode: string | null;
  highlightedNodes: Set<string>;
  onSelect: (id: string) => void;
}) {
  const c = SCHEME_COLORS;
  const svgW = 1100;
  const svgH = 760;
  const pipeY = 180;

  const getNode = (nodeId: string) => graph?.nodes.find((n: any) => n.id === nodeId);
  const isRunning = (nodeId: string) => getNode(nodeId)?.mode === 'RUNNING';
  const isAlarm = (nodeId: string) => getNode(nodeId)?.mode === 'ALARM';
  const statusColor = (n: any) => n ? (n.mode === 'RUNNING' ? c.activeGreen : n.mode === 'ALARM' ? c.alarmRed : c.stoppedGray) : c.stoppedGray;

  // ГОСТ 21.404-85: прибор на щите = кружок с горизонтальной чертой
  // Верх: буквенный код (измеряемая величина + функция), низ: позиционный номер
  const gostInstrument = (x: number, y: number, letters: string, num: string, alarm = false) => (
    <g>
      <circle cx={x} cy={y} r="14" fill={c.instrBg} stroke={alarm ? c.alarmRed : c.instrBorder} strokeWidth="1.5" />
      <line x1={x - 14} y1={y} x2={x + 14} y2={y} stroke={c.instrDivider} strokeWidth="1" />
      <text x={x} y={y - 3} textAnchor="middle" fill={c.textMain} fontSize="7" fontWeight="bold" fontFamily={FONT_FAMILY}>{letters}</text>
      <text x={x} y={y + 9} textAnchor="middle" fill={c.textSec} fontSize="6" fontFamily={FONT_FAMILY}>{num}</text>
    </g>
  );

  // Отборное устройство: сплошная тонкая линия (ГОСТ) от трубы к прибору
  const tapLine = (x1: number, y1: number, x2: number, y2: number) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c.pipeSignal} strokeWidth="1" />
  );

  // Прибор на трубе: сплошная линия отбора + кружок ГОСТ
  const instrumentOnPipe = (tapX: number, tapY: number, bx: number, by: number, letters: string, num: string, alarm = false) => (
    <g>
      {tapLine(tapX, tapY, bx, by)}
      {gostInstrument(bx, by, letters, num, alarm)}
    </g>
  );

  // SCADA-блок значения параметра: белый прямоугольник с синей рамкой
  const paramBlock = (x: number, y: number, tag: string, value: number, unit: string, running: boolean) => {
    const vcolor = running ? c.activeGreen : c.textSec;
    return (
      <g>
        <rect x={x} y={y} width="78" height="30" rx="2" fill={c.paramBg} stroke={c.paramBorder} strokeWidth="1" />
        <text x={x + 39} y={y + 11} textAnchor="middle" fill={c.textSec} fontSize="7" fontWeight="bold" fontFamily={FONT_FAMILY}>{tag}</text>
        <text x={x + 39} y={y + 24} textAnchor="middle" fill={vcolor} fontSize="10" fontWeight="bold" fontFamily={FONT_FAMILY}>{value.toFixed(1)} {unit}</text>
      </g>
    );
  };

  const flowLabel = (x: number, y: number, text: string) => (
    <g>
      <rect x={x} y={y} width={text.length * 6.5 + 8} height="16" rx="2" fill={c.instrBg} stroke={c.paramBorder} strokeWidth="0.8" />
      <text x={x + 4} y={y + 11} fill={c.textMain} fontSize="8" fontFamily={FONT_FAMILY}>{text}</text>
    </g>
  );

  const pipe = (x1: number, y1: number, x2: number, y2: number, running: boolean, w = 5) => (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c.pipe} strokeWidth={w} strokeLinecap="round" />
      {running && <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c.activeGreen} strokeWidth={w - 3} strokeDasharray="6 3" opacity="0.6" />}
    </g>
  );

  const arrow = (x: number, y: number, dir: 'right' | 'down' | 'left' | 'up') => {
    const sz = 7;
    if (dir === 'right') return <polygon points={`${x},${y} ${x - sz},${y - sz} ${x - sz},${y + sz}`} fill={c.arrow} />;
    if (dir === 'down') return <polygon points={`${x},${y} ${x - sz},${y - sz} ${x + sz},${y - sz}`} fill={c.arrow} />;
    if (dir === 'left') return <polygon points={`${x},${y} ${x + sz},${y - sz} ${x + sz},${y + sz}`} fill={c.arrow} />;
    return <polygon points={`${x},${y} ${x - sz},${y + sz} ${x + sz},${y + sz}`} fill={c.arrow} />;
  };

  // ГОСТ: клапан = два треугольника, регулирующий - с приводом
  const valveSymbol = (x: number, y: number, open: boolean, vertical = false) => {
    const s = 10;
    if (vertical) {
      return (
        <g>
          <polygon points={`${x - s},${y} ${x + s},${y} ${x},${y - s}`} fill={c.equipDark} stroke={c.equipStroke} strokeWidth="1.2" />
          <polygon points={`${x - s},${y} ${x + s},${y} ${x},${y + s}`} fill={c.equipDark} stroke={c.equipStroke} strokeWidth="1.2" />
          {open && <rect x={x - 2} y={y - s - 6} width="4" height="6" fill={c.activeGreen} />}
        </g>
      );
    }
    return (
      <g>
        <polygon points={`${x},${y - s} ${x},${y + s} ${x - s},${y}`} fill={c.equipDark} stroke={c.equipStroke} strokeWidth="1.2" />
        <polygon points={`${x},${y - s} ${x},${y + s} ${x + s},${y}`} fill={c.equipDark} stroke={c.equipStroke} strokeWidth="1.2" />
        {open && <rect x={x + s + 1} y={y - 2} width="6" height="4" fill={c.activeGreen} />}
      </g>
    );
  };

  // ГОСТ: исполнительный механизм (регулятор прямого действия)
  const actuatorSymbol = (x: number, y: number, active: boolean) => (
    <g>
      <circle cx={x} cy={y} r="6" fill={c.equipDark} stroke={c.equipStroke} strokeWidth="1" />
      {active && <circle cx={x} cy={y} r="3" fill={c.activeGreen} />}
    </g>
  );

  const dh = getNode('dehydrator')?.parameters;
  const dhLow = (dh?.level_mm || 4000) < 3500;

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="xMidYMid meet" style={{ background: c.bg, borderRadius: 4, width: '100%', height: 'auto', maxWidth: svgW, minHeight: 300, border: '1px solid #CCCCCC' }}>
      {/* === HEADER === */}
      <text x="14" y="20" fill={c.textMain} fontSize="12" fontWeight="bold" fontFamily={FONT_FAMILY}>МНЕМОСХЕМА ЭЛОУ-АВТ - P&amp;ID</text>
      <text x={svgW - 14} y="20" textAnchor="end" fill={c.textSec} fontSize="9" fontFamily={FONT_FAMILY}>{new Date().toLocaleTimeString('ru-RU')}</text>
      <line x1="0" y1="28" x2={svgW} y2="28" stroke="#CCCCCC" strokeWidth="1" />

      {/* === FLOW LABELS === */}
      {flowLabel(10, 166, 'Вода')}
      {flowLabel(950, 166, 'Обезвож. нефть')}

      {/* === MAIN PIPELINE: Вода → Н-82 → А-19 → Э-1 → Выход → Т-1 → К-1 === */}
      {pipe(20, pipeY, 112, pipeY, isRunning('feed_pump'))}
      {arrow(108, pipeY, 'right')}
      {pipe(168, pipeY, 320, pipeY, isRunning('feed_pump'))}
      {arrow(316, pipeY, 'right')}
      {pipe(480, pipeY, 600, pipeY, isRunning('preheater'))}
      {arrow(596, pipeY, 'right')}
      {pipe(760, pipeY, 820, pipeY, isRunning('dehydrator'))}
      {arrow(816, pipeY, 'right')}
      {/* Т-1 → К-1 */}
      {pipe(940, pipeY + 25, 940, 110, isRunning('heat_exchanger'), 4)}
      {pipe(940, 110, 1000, 110, isRunning('heat_exchanger'), 4)}
      {pipe(1000, 110, 1000, 160, isRunning('column'), 4)}
      {arrow(1000, 156, 'down')}
      {flowLabel(950, 96, 'На К-1')}

      {/* === Э-1 drain down to Е-16 === */}
      {pipe(680, 215, 680, 370, isRunning('dehydrator'), 4)}
      {arrow(680, 366, 'down')}
      {flowLabel(690, 280, 'Сол. вода')}

      {/* === Е-16 → Р-11 (left) === */}
      {pipe(630, 395, 540, 395, isRunning('tank'), 4)}
      {arrow(544, 395, 'left')}
      {flowLabel(548, 378, 'Нефть')}

      {/* === Е-16 drain down → Стоки === */}
      {pipe(680, 425, 680, 520, isRunning('tank'), 4)}
      {arrow(680, 516, 'down')}
      {flowLabel(650, 532, 'Стоки')}

      {/* === ГОСТ INSTRUMENTS ON MAIN PIPE === */}
      {/* FR-495A: расход воды (на трубе Н-82→А-19) */}
      {instrumentOnPipe(220, pipeY, 220, 130, 'FR', '495А')}
      {paramBlock(181, 102, 'FR-495A', getNode('feed_pump')?.parameters?.flow_rate || 0, 'м³/ч', isRunning('feed_pump'))}

      {/* FQR-3K-30: интегратор расхода воды (ниже) */}
      {instrumentOnPipe(260, pipeY, 260, 130, 'FQR', '3К-30')}
      {paramBlock(221, 102, 'FQR-30', getNode('feed_pump')?.parameters?.flow_rate || 0, 'м³/ч', isRunning('feed_pump'))}

      {/* FR-492: расход нефти в Э-1 (на трубе А-19→Э-1) */}
      {instrumentOnPipe(500, pipeY, 500, 130, 'FR', '492')}
      {paramBlock(461, 102, 'FR-492', getNode('preheater')?.parameters?.inlet_flow || 0, 'м³/ч', isRunning('preheater'))}

      {/* TR-41-12: температура в Э-1 (на трубе А-19→Э-1) */}
      {instrumentOnPipe(540, pipeY, 540, 130, 'TR', '41-12')}
      {paramBlock(501, 102, 'TR-41', getNode('preheater')?.parameters?.temperature || 0, '°C', isRunning('preheater'))}

      {/* PRA-312: давление на выходе ЭЛОУ (на трубе Э-1→выход) */}
      {instrumentOnPipe(820, pipeY, 820, 130, 'PRA', '312')}
      {paramBlock(781, 102, 'PRA-312', dh?.pressure || 0, 'кгс', isRunning('dehydrator'))}

      {/* === ГОСТ INSTRUMENTS ON DRAIN PIPE (Э-1→Е-16) === */}
      {/* LRCA-641: уровень раздела фаз в Э-1 (с регулированием и сигнализацией) */}
      {instrumentOnPipe(680, 300, 730, 300, 'LRCA', '641', dhLow)}
      {paramBlock(748, 286, 'LRCA-641', dh?.level_mm || 0, 'мм', isRunning('dehydrator'))}

      {/* LSA-641A: блокировка по уровню < 3500мм */}
      {instrumentOnPipe(680, 330, 730, 330, 'LSA', '641А', dhLow)}
      {dhLow && <text x={752} y={334} fill={c.alarmRed} fontSize="7" fontWeight="bold" fontFamily={FONT_FAMILY}>БЛОК!</text>}

      {/* === ГОСТ INSTRUMENTS ON Е-16 === */}
      {/* LRCA-645: уровень в Е-16 (на трубе Е-16→Р-11) */}
      {instrumentOnPipe(580, 395, 580, 450, 'LRCA', '645')}
      {paramBlock(541, 462, 'LRCA-645', getNode('tank')?.parameters?.level || 0, '%', isRunning('tank'))}

      {/* PRC-313: давление в Е-16 (на трубе Е-16→Стоки) */}
      {instrumentOnPipe(680, 470, 730, 470, 'PRC', '313')}
      {paramBlock(748, 456, 'PRC-313', getNode('tank')?.parameters?.drain_flow || 0, 'м³/ч', isRunning('tank'))}

      {/* === EQUIPMENT === */}
      {graph?.nodes.map((node: any) => {
        const isSel = selectedNode === node.id;
        const isHi = highlightedNodes.has(node.id);
        const stColor = statusColor(node);
        const selStroke = isSel ? c.select : isHi ? c.highlight : c.equipStroke;
        const selW = (isSel || isHi) ? 2.5 : 1.5;
        const label = NODE_LABELS[node.id] || node.name;

        if (node.type === 'feed_pump') {
          const cx = 140, cy = pipeY;
          return (
            <g key={node.id} onClick={() => onSelect(node.id)} style={{ cursor: 'pointer' }}>
              <circle cx={cx} cy={cy} r="26" fill={c.equipFill} stroke={selStroke} strokeWidth={selW} />
              <circle cx={cx} cy={cy} r="20" fill="none" stroke={c.equipStroke} strokeWidth="0.8" />
              <polygon points={`${cx - 13},${cy - 11} ${cx - 13},${cy + 11} ${cx + 13},${cy}`} fill="none" stroke={selStroke} strokeWidth="1.5" />
              {isRunning('feed_pump') && <circle cx={cx} cy={cy} r="5" fill={c.activeGreen} opacity="0.8" />}
              {isAlarm('feed_pump') && <circle cx={cx + 18} cy={cy - 18} r="4" fill={c.alarmRed} />}
              <text x={cx} y={cy + 44} textAnchor="middle" fill={c.textMain} fontSize="10" fontWeight="bold" fontFamily={FONT_FAMILY}>{label}</text>
              <text x={cx} y={cy + 56} textAnchor="middle" fill={stColor} fontSize="8" fontFamily={FONT_FAMILY}>{MODE_LABELS[node.mode] || ''}</text>
              {paramBlock(cx - 39, cy + 64, 'Н-82', node.parameters?.power_percent || 0, '%', isRunning('feed_pump'))}
            </g>
          );
        }
        if (node.type === 'preheater') {
          const x = 320, y = 155;
          return (
            <g key={node.id} onClick={() => onSelect(node.id)} style={{ cursor: 'pointer' }}>
              <rect x={x} y={y} width="160" height="50" rx="8" fill={c.equipFill} stroke={selStroke} strokeWidth={selW} />
              <rect x={x} y={y + 3} width="160" height="44" rx="8" fill="none" stroke={c.equipDark} strokeWidth="0.6" />
              {[0, 1, 2, 3].map(i => <line key={i} x1={x + 10} y1={y + 12 + i * 9} x2={x + 150} y2={y + 12 + i * 9} stroke={c.equipDark} strokeWidth="0.8" opacity="0.6" />)}
              <rect x={x - 6} y={y + 6} width="6" height="38" fill={c.equipDark} stroke={c.equipStroke} strokeWidth="0.8" />
              <rect x={x + 160} y={y + 6} width="6" height="38" fill={c.equipDark} stroke={c.equipStroke} strokeWidth="0.8" />
              <text x={x + 80} y={y + 30} textAnchor="middle" fill={c.textMain} fontSize="11" fontWeight="bold" fontFamily={FONT_FAMILY}>{label}</text>
              <text x={x + 80} y={y + 72} textAnchor="middle" fill={stColor} fontSize="8" fontFamily={FONT_FAMILY}>{MODE_LABELS[node.mode] || ''}</text>
            </g>
          );
        }
        if (node.type === 'electrodehydrator') {
          const p = node.parameters;
          const x = 600, y = 145;
          const hvActive = (p.voltage_on || 0) > 0.5;
          return (
            <g key={node.id} onClick={() => onSelect(node.id)} style={{ cursor: 'pointer' }}>
              <rect x={x} y={y} width="160" height="70" rx="10" fill={c.equipFill} stroke={selStroke} strokeWidth={selW} />
              <rect x={x} y={y + 3} width="160" height="64" rx="10" fill="none" stroke={c.equipDark} strokeWidth="0.6" />
              {[25, 45, 65].map(dy => <line key={dy} x1={x + 15} y1={y + dy} x2={x + 145} y2={y + dy} stroke={hvActive ? c.hv : c.equipDark} strokeWidth="1.2" opacity={hvActive ? 0.7 : 0.4} />)}
              <text x={x + 80} y={y + 14} textAnchor="middle" fill={hvActive ? c.hv : c.textSec} fontSize="8" fontWeight="bold" fontFamily={FONT_FAMILY}>≈ HV</text>
              <text x={x + 80} y={y + 55} textAnchor="middle" fill={c.textMain} fontSize="11" fontWeight="bold" fontFamily={FONT_FAMILY}>{label}</text>
              <text x={x + 80} y={y + 84} textAnchor="middle" fill={stColor} fontSize="8" fontFamily={FONT_FAMILY}>{MODE_LABELS[node.mode] || ''}</text>
              {dhLow && <circle cx={x + 150} cy={y + 10} r="4" fill={c.alarmRed} />}
            </g>
          );
        }
        if (node.type === 'tank') {
          const p = node.parameters;
          const x = 630, y = 370;
          const lvl = p.level || 0;
          return (
            <g key={node.id} onClick={() => onSelect(node.id)} style={{ cursor: 'pointer' }}>
              <rect x={x} y={y} width="100" height="55" rx="27" fill={c.equipFill} stroke={selStroke} strokeWidth={selW} />
              <rect x={x + 4} y={y + 4} width="92" height="47" rx="23" fill="none" stroke={c.equipDark} strokeWidth="0.6" />
              <rect x={x + 8} y={y + 50 - lvl * 0.4} width="84" height={lvl * 0.4} rx="17" fill={c.water} opacity="0.15" />
              <text x={x + 50} y={y + 26} textAnchor="middle" fill={c.textMain} fontSize="10" fontWeight="bold" fontFamily={FONT_FAMILY}>{label}</text>
              <text x={x + 50} y={y + 40} textAnchor="middle" fill={stColor} fontSize="7" fontFamily={FONT_FAMILY}>{MODE_LABELS[node.mode] || ''}</text>
            </g>
          );
        }
        if (node.type === 'regulator') {
          const x = 460, y = 375;
          return (
            <g key={node.id} onClick={() => onSelect(node.id)} style={{ cursor: 'pointer' }}>
              <rect x={x} y={y} width="80" height="40" rx="4" fill={c.equipFill} stroke={selStroke} strokeWidth={selW} />
              <rect x={x + 4} y={y + 4} width="72" height="32" rx="3" fill="none" stroke={c.equipDark} strokeWidth="0.6" />
              <text x={x + 40} y={y + 20} textAnchor="middle" fill={c.textMain} fontSize="10" fontWeight="bold" fontFamily={FONT_FAMILY}>{label}</text>
              <text x={x + 40} y={y + 33} textAnchor="middle" fill={stColor} fontSize="7" fontFamily={FONT_FAMILY}>{MODE_LABELS[node.mode] || ''}</text>
              {/* ГОСТ: исполнительный механизм на клапане */}
              {actuatorSymbol(x + 40, y - 8, isRunning('regulator'))}
            </g>
          );
        }
        if (node.type === 'heat_exchanger') {
          const p = node.parameters;
          const x = 820, y = 155;
          return (
            <g key={node.id} onClick={() => onSelect(node.id)} style={{ cursor: 'pointer' }}>
              <rect x={x} y={y} width="120" height="50" rx="8" fill={c.equipFill} stroke={selStroke} strokeWidth={selW} />
              <rect x={x} y={y + 3} width="120" height="44" rx="8" fill="none" stroke={c.equipDark} strokeWidth="0.6" />
              {[0, 1, 2].map(i => <line key={i} x1={x + 8} y1={y + 12 + i * 10} x2={x + 112} y2={y + 12 + i * 10} stroke={c.equipDark} strokeWidth="0.8" opacity="0.6" />)}
              <rect x={x - 6} y={y + 6} width="6" height="38" fill={c.equipDark} stroke={c.equipStroke} strokeWidth="0.8" />
              <rect x={x + 120} y={y + 6} width="6" height="38" fill={c.equipDark} stroke={c.equipStroke} strokeWidth="0.8" />
              <text x={x + 60} y={y + 30} textAnchor="middle" fill={c.textMain} fontSize="11" fontWeight="bold" fontFamily={FONT_FAMILY}>{label}</text>
              <text x={x + 60} y={y + 72} textAnchor="middle" fill={stColor} fontSize="8" fontFamily={FONT_FAMILY}>{MODE_LABELS[node.mode] || ''}</text>
              {paramBlock(x + 21, y + 82, 'Т-1', p.temperature || 0, '°C', isRunning('heat_exchanger'))}
            </g>
          );
        }
        if (node.type === 'column') {
          const p = node.parameters;
          const cx = 1000, cy = 250;
          const colH = 180;
          return (
            <g key={node.id} onClick={() => onSelect(node.id)} style={{ cursor: 'pointer' }}>
              <ellipse cx={cx} cy={cy - colH / 2} rx="35" ry="12" fill={c.equipFill} stroke={selStroke} strokeWidth={selW} />
              <rect x={cx - 35} y={cy - colH / 2} width="70" height={colH} fill={c.equipFill} stroke={selStroke} strokeWidth={selW} />
              <line x1={cx - 35} y1={cy - colH / 2} x2={cx + 35} y2={cy - colH / 2} stroke={c.equipDark} strokeWidth="0.6" />
              {[0, 1, 2, 3, 4].map(i => <line key={i} x1={cx - 30} y1={cy - colH / 2 + 20 + i * 28} x2={cx + 30} y2={cy - colH / 2 + 20 + i * 28} stroke={c.equipDark} strokeWidth="0.6" opacity="0.5" />)}
              <ellipse cx={cx} cy={cy + colH / 2} rx="35" ry="12" fill={c.equipFill} stroke={selStroke} strokeWidth={selW} />
              <text x={cx} y={cy + 4} textAnchor="middle" fill={c.textMain} fontSize="11" fontWeight="bold" fontFamily={FONT_FAMILY}>{label}</text>
              <text x={cx} y={cy + 20} textAnchor="middle" fill={stColor} fontSize="8" fontFamily={FONT_FAMILY}>{MODE_LABELS[node.mode] || ''}</text>
              {paramBlock(cx - 39, cy + colH / 2 + 18, 'К-1', p.top_temp || 0, '°C', isRunning('column'))}
            </g>
          );
        }
        return null;
      })}

      {/* === INLINE VALVES (ГОСТ: задвижки) === */}
      {/* Задвижка на трубопроводе в А-19 (два треугольника вершинами друг к другу) */}
      {(() => {
        const vx = 250, vy = pipeY;
        const vp = getNode('preheater')?.parameters?.valve_pos ?? 100;
        const open = vp > 50;
        return (
          <g>
            <polygon points={`${vx - 10},${vy - 10} ${vx - 10},${vy + 10} ${vx},${vy}`} fill={c.equipDark} stroke={c.equipStroke} strokeWidth="1.2" />
            <polygon points={`${vx + 10},${vy - 10} ${vx + 10},${vy + 10} ${vx},${vy}`} fill={c.equipDark} stroke={c.equipStroke} strokeWidth="1.2" />
            {open && <rect x={vx - 2} y={vy - 18} width="4" height="8" fill={c.activeGreen} />}
            {!open && vp === 0 && <rect x={vx - 2} y={vy - 18} width="4" height="8" fill={c.alarmRed} />}
            <text x={vx} y={vy - 22} textAnchor="middle" fill={c.textSec} fontSize="7" fontFamily={FONT_FAMILY}>{vp.toFixed(0)}%</text>
          </g>
        );
      })()}
      {valveSymbol(680, 230, isRunning('dehydrator'), true)}

      {/* === LEGEND (ГОСТ) === */}
      <rect x="0" y={svgH - 30} width={svgW} height="30" fill="#F0F0F0" stroke="#CCCCCC" strokeWidth="0.5" />
      <circle cx="14" cy={svgH - 15} r="5" fill={c.instrBg} stroke={c.instrBorder} strokeWidth="1.5" />
      <line x1="9" y1={svgH - 15} x2="19" y2={svgH - 15} stroke={c.instrDivider} strokeWidth="1" />
      <text x="26" y={svgH - 12} fill={c.textSec} fontSize="8" fontFamily={FONT_FAMILY}>КИПиА (на щите)</text>
      <line x1="130" y1={svgH - 15} x2="160" y2={svgH - 15} stroke={c.pipe} strokeWidth="4" />
      <text x="166" y={svgH - 12} fill={c.textSec} fontSize="8" fontFamily={FONT_FAMILY}>тех. трубопровод</text>
      <line x1="280" y1={svgH - 15} x2="310" y2={svgH - 15} stroke={c.pipeSignal} strokeWidth="1" />
      <text x="316" y={svgH - 12} fill={c.textSec} fontSize="8" fontFamily={FONT_FAMILY}>отборное устройство</text>
      <circle cx="430" cy={svgH - 15} r="4" fill={c.activeGreen} />
      <text x="440" y={svgH - 12} fill={c.textSec} fontSize="8" fontFamily={FONT_FAMILY}>работает</text>
      <circle cx="500" cy={svgH - 15} r="4" fill={c.stoppedGray} />
      <text x="510" y={svgH - 12} fill={c.textSec} fontSize="8" fontFamily={FONT_FAMILY}>остановлен</text>
      <circle cx="570" cy={svgH - 15} r="4" fill={c.alarmRed} />
      <text x="580" y={svgH - 12} fill={c.textSec} fontSize="8" fontFamily={FONT_FAMILY}>авария/блокировка</text>
      <polygon points={`680,${svgH - 19} 680,${svgH - 11} 688,${svgH - 15}`} fill={c.equipDark} stroke={c.equipStroke} strokeWidth="0.8" />
      <polygon points={`688,${svgH - 19} 688,${svgH - 11} 680,${svgH - 15}`} fill={c.equipDark} stroke={c.equipStroke} strokeWidth="0.8" />
      <text x="696" y={svgH - 12} fill={c.textSec} fontSize="8" fontFamily={FONT_FAMILY}>клапан</text>
      <text x="750" y={svgH - 12} fill={c.textSec} fontSize="8" fontFamily={FONT_FAMILY}>▶ поток</text>
    </svg>
  );
}
