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
import { useThemeMode } from '../theme/ThemeContext';
import { apiClient, type VerdictDTO } from '../api/client';

const MODE_COLORS: Record<string, string> = {
  STOPPED: '#888',
  RUNNING: '#4caf50',
  ALARM: '#f44336',
  MAINTENANCE: '#ff9800',
};

const MODE_LABELS: Record<string, string> = {
  STOPPED: 'Остановлен',
  RUNNING: 'Работает',
  ALARM: 'Авария',
  MAINTENANCE: 'Обслуживание',
};

const TYPE_LABELS: Record<string, string> = {
  feed_pump: 'Насос',
  preheater: 'Теплообменник',
  furnace: 'Печь',
  electrodehydrator: 'Дегидратор',
  tank: 'Ёмкость',
  regulator: 'Регулятор',
  output: 'Выход',
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
  furnace: 'Печь',
  output: 'Выход',
};

const ACTION_LABELS: Record<string, string> = {
  start: 'Пуск',
  stop: 'Остановка',
  set_power: 'Мощность, %',
  set_temp: 'Температура, °C',
  set_valve: 'Клапан, %',
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
  water_content: 'Вода',
  salt_mg_l: 'Соли',
  level: 'Уровень',
  drain_flow: 'Слив',
  outlet_flow: 'Расх.вых',
  valve_pos: 'Клапан',
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
  const { mode } = useThemeMode();
  const { graph, currentScenario, journal, loading, error, selectScenario, applyAction } = useSimStore();
  const sessionMode = useSimStore(s => s.mode);
  const isExam = sessionMode === 'exam';
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [actionValue, setActionValue] = useState<string>('');
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

  const handleAction = async (nodeId: string, actionId: string) => {
    const node = graph?.nodes.find((n) => n.id === nodeId);
    const action = node?.actions.find((a) => a.id === actionId);
    if (action?.param && action.min !== null && action.max !== null) {
      const val = parseFloat(actionValue);
      if (isNaN(val)) { alert(`Введите значение от ${action.min} до ${action.max}`); return; }
      await applyAction(nodeId, actionId, val);
    } else {
      await applyAction(nodeId, actionId);
    }
    setActionValue('');
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
            <Mnemoscheme graph={graph} selectedNode={selectedNode} highlightedNodes={highlightedNodes} onSelect={setSelectedNode} dark={mode === 'dark'} />
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
                        value={actionValue}
                        onChange={(value) => setActionValue(value || '')}
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
              {journal.map((entry, idx) => (
                <Card key={idx} verticalSpace="s" horizontalSpace="m" style={{ marginBottom: 4, background: '#f5f5f5', borderLeft: `3px solid ${entry.result === 'Applied' ? '#52c41a' : entry.result === 'Clamped' ? '#faad14' : '#ff4d4f'}` }}>
                  <Text size="xs" view="ghost">{new Date(entry.timestamp).toLocaleTimeString()}</Text>
                  <Text size="m"><strong>{NODE_LABELS[entry.node] || entry.node}</strong>: {actionLabel(entry.action)}{entry.value !== null && ` = ${entry.value.toFixed(1)}`}</Text>
                  <Text size="xs" view="ghost">Результат: {RESULT_LABELS[entry.result] || entry.result}</Text>
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
              ))}
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
  bg: string; grid: string; header: string;
  equipFill: string; equipDark: string;
  pipe: string; arrow: string;
  textMain: string; textSec: string;
  paramBg: string; paramBorder: string; paramLabel: string;
  instrFill: string; instrStroke: string; instrText: string;
  flow: string; select: string; highlight: string;
  flame: string; hv: string; water: string; valve: string;
  legend: string;
}

const DARK_COLORS: SchemeColors = {
  bg: '#0d1117', grid: '#141b2a', header: '#161e2e',
  equipFill: '#111a2a', equipDark: '#0a1220',
  pipe: '#2a3a5a', arrow: '#3a5a7a',
  textMain: '#c0c8d0', textSec: '#5a7a8a',
  paramBg: '#0a0f1a', paramBorder: '#1e2d3d', paramLabel: '#5a7a8a',
  instrFill: '#0d1520', instrStroke: '#3a5a7a', instrText: '#8ab4d8',
  flow: '#4caf50', select: '#e94560', highlight: '#ffeb3b',
  flame: '#ff6600', hv: '#ff9800', water: '#1565c0', valve: '#4a90d9',
  legend: '#111a2a',
};

const LIGHT_COLORS: SchemeColors = {
  bg: '#c8ced6', grid: '#bcc3cc', header: '#b0b8c2',
  equipFill: '#ffffff', equipDark: '#e8ecf0',
  pipe: '#5a6a7a', arrow: '#4a5a6a',
  textMain: '#1a1a1a', textSec: '#5a6a7a',
  paramBg: '#f0f2f5', paramBorder: '#c8ced6', paramLabel: '#5a6a7a',
  instrFill: '#eef1f5', instrStroke: '#7a8a9a', instrText: '#2a4a6a',
  flow: '#2e7d32', select: '#1565c0', highlight: '#e65100',
  flame: '#d84315', hv: '#e65100', water: '#1565c0', valve: '#1976d2',
  legend: '#dde2e8',
};

function Mnemoscheme({ graph, selectedNode, highlightedNodes, onSelect, dark }: {
  graph: any;
  selectedNode: string | null;
  highlightedNodes: Set<string>;
  onSelect: (id: string) => void;
  dark: boolean;
}) {
  const c = dark ? DARK_COLORS : LIGHT_COLORS;
  const svgW = 1000;
  const svgH = 500;
  const pipeY = 130;

  const getNode = (nodeId: string) => graph?.nodes.find((n: any) => n.id === nodeId);
  const nodeColor = (n: any) => n ? (MODE_COLORS[n.mode] || (dark ? '#555' : '#999')) : (dark ? '#555' : '#999');
  const isRunning = (nodeId: string) => getNode(nodeId)?.mode === 'RUNNING';

  const paramBox = (x: number, y: number, label: string, value: number, unit: string, running: boolean) => {
    const vcolor = running ? c.flow : c.textSec;
    return (
      <g>
        <rect x={x} y={y} width="92" height="28" rx="3" fill={c.paramBg} stroke={c.paramBorder} strokeWidth="1" />
        <text x={x + 4} y={y + 11} fill={c.paramLabel} fontSize="7" fontFamily="monospace">{label}</text>
        <text x={x + 4} y={y + 23} fill={vcolor} fontSize="11" fontFamily="monospace" fontWeight="bold">{value.toFixed(1)} {unit}</text>
      </g>
    );
  };

  const instrumentTag = (x: number, y: number, tag: string, label: string) => (
    <g>
      <circle cx={x} cy={y} r="13" fill={c.instrFill} stroke={c.instrStroke} strokeWidth="1.5" />
      <line x1={x - 13} y1={y} x2={x - 20} y2={y} stroke={c.instrStroke} strokeWidth="1" />
      <text x={x} y={y - 1} textAnchor="middle" fill={c.instrText} fontSize="7" fontWeight="bold">{tag}</text>
      <text x={x} y={y + 8} textAnchor="middle" fill={c.textSec} fontSize="6">{label}</text>
    </g>
  );

  const pipe = (x1: number, y1: number, x2: number, y2: number, running: boolean, w = 6) => (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c.pipe} strokeWidth={w} />
      {running && <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c.flow} strokeWidth={w - 2} strokeDasharray="8 4" />}
    </g>
  );

  const arrow = (x: number, y: number, dir: 'right' | 'down' | 'left' | 'up') => {
    const sz = 6;
    if (dir === 'right') return <polygon points={`${x},${y} ${x - sz},${y - sz} ${x - sz},${y + sz}`} fill={c.arrow} />;
    if (dir === 'down') return <polygon points={`${x},${y} ${x - sz},${y - sz} ${x + sz},${y - sz}`} fill={c.arrow} />;
    if (dir === 'left') return <polygon points={`${x},${y} ${x + sz},${y - sz} ${x + sz},${y + sz}`} fill={c.arrow} />;
    return <polygon points={`${x},${y} ${x - sz},${y + sz} ${x + sz},${y + sz}`} fill={c.arrow} />;
  };

  return (
    <svg width={svgW} height={svgH} style={{ background: c.bg, borderRadius: 8, minWidth: svgW, border: `1px solid ${dark ? '#1a2332' : '#a0a8b0'}` }}>
      <defs>
        <pattern id="scadaGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke={c.grid} strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width={svgW} height={svgH} fill="url(#scadaGrid)" />

      <rect x="0" y="0" width={svgW} height="24" fill={c.header} />
      <text x="12" y="16" fill={c.instrText} fontSize="11" fontWeight="bold" fontFamily="monospace">МНЕМОСХЕМА ЭЛОУ-АВТ - P&amp;ID</text>
      <text x={svgW - 12} y="16" textAnchor="end" fill={c.textSec} fontSize="9" fontFamily="monospace">{new Date().toLocaleTimeString('ru-RU')}</text>

      {/* === MAIN LINE (y=130): Вода → Н-82 → А-19 → Э-1 → Частично обезвоженная нефть === */}
      <text x="20" y="118" fill={c.textSec} fontSize="9" fontFamily="monospace">Вода</text>
      {pipe(20, pipeY, 102, pipeY, isRunning('feed_pump'))}
      {arrow(102, pipeY, 'right')}

      {pipe(158, pipeY, 300, pipeY, isRunning('feed_pump'))}
      {arrow(300, pipeY, 'right')}

      {pipe(460, pipeY, 560, pipeY, isRunning('preheater'))}
      {arrow(560, pipeY, 'right')}

      {pipe(720, pipeY, 860, pipeY, isRunning('dehydrator'))}
      {arrow(860, pipeY, 'right')}
      <text x="868" y="118" fill={c.textSec} fontSize="8" fontFamily="monospace">Частично обезвоженная нефть</text>

      {/* === Below А-19: vertical pipe with blue valve → furnace === */}
      {pipe(380, 155, 380, 175, isRunning('furnace'), 5)}
      {/* Blue valve: two triangles pointing at each other */}
      <polygon points={`365,175 365,195 380,185`} fill={c.valve} stroke={c.valve} strokeWidth="1" />
      <polygon points={`395,175 395,195 380,185`} fill={c.valve} stroke={c.valve} strokeWidth="1" />
      {pipe(380, 195, 380, 235, isRunning('furnace'), 5)}
      {arrow(380, 175, 'up')}
      <text x="395" y="185" fill={c.textSec} fontSize="7" fontFamily="monospace">Нагретая сырая нефть</text>

      {/* === Below Э-1: vertical pipe down to Е-16 === */}
      {pipe(640, 165, 640, 290, isRunning('dehydrator'), 5)}
      {arrow(640, 290, 'down')}
      <text x="648" y="230" fill={c.textSec} fontSize="7" fontFamily="monospace">→ вода</text>

      {/* === Е-16 → Р-11 (left) === */}
      {pipe(590, 317, 500, 317, isRunning('tank'), 5)}
      {arrow(500, 317, 'left')}

      {/* === Below Е-16: vertical pipe down → Стоки === */}
      {pipe(640, 345, 640, 420, isRunning('tank'), 5)}
      {arrow(640, 420, 'down')}
      <text x="618" y="440" fill={c.textSec} fontSize="9" fontFamily="monospace">Стоки</text>

      {/* === EQUIPMENT === */}
      {graph?.nodes.map((node: any) => {
        const isSel = selectedNode === node.id;
        const isHi = highlightedNodes.has(node.id);
        const color = nodeColor(node);
        const selStroke = isSel ? c.select : isHi ? c.highlight : color;
        const selW = (isSel || isHi) ? 3 : 1.5;
        const label = NODE_LABELS[node.id] || node.name;

        if (node.type === 'feed_pump') {
          const p = node.parameters;
          const cx = 130, cy = pipeY;
          return (
            <g key={node.id} onClick={() => onSelect(node.id)} style={{ cursor: 'pointer' }}>
              <circle cx={cx} cy={cy} r="28" fill={c.equipFill} stroke={selStroke} strokeWidth={selW} />
              <polygon points={`${cx - 16},${cy - 14} ${cx - 16},${cy + 14} ${cx + 16},${cy}`} fill="none" stroke={selStroke} strokeWidth={selW} />
              <text x={cx} y={cy + 4} textAnchor="middle" fill={c.textMain} fontSize="9" fontWeight="bold">{label}</text>
              <text x={cx} y={cy + 48} textAnchor="middle" fill={color} fontSize="8" fontFamily="monospace">{MODE_LABELS[node.mode] || ''}</text>
              {instrumentTag(cx - 35, cy + 30, 'FIT', '101')}
              {paramBox(cx - 46, cy + 58, 'МОЩНОСТЬ', p.power_percent || 0, '%', node.mode === 'RUNNING')}
              {paramBox(cx + 46, cy + 58, 'РАСХОД', p.flow_rate || 0, 'м³/ч', node.mode === 'RUNNING')}
            </g>
          );
        }
        if (node.type === 'preheater') {
          const p = node.parameters;
          const x = 300, y = 105;
          return (
            <g key={node.id} onClick={() => onSelect(node.id)} style={{ cursor: 'pointer' }}>
              <rect x={x} y={y} width="160" height="50" rx="6" fill={c.equipFill} stroke={selStroke} strokeWidth={selW} />
              {[0, 1, 2, 3].map(i => <line key={i} x1={x + 8} y1={y + 10 + i * 10} x2={x + 152} y2={y + 10 + i * 10} stroke={color} strokeWidth="0.8" opacity="0.5" />)}
              <rect x={x - 8} y={y + 4} width="8" height="42" fill={c.equipDark} stroke={selStroke} strokeWidth={selW} />
              <rect x={x + 160} y={y + 4} width="8" height="42" fill={c.equipDark} stroke={selStroke} strokeWidth={selW} />
              <text x={x + 80} y={y + 32} textAnchor="middle" fill={c.textMain} fontSize="11" fontWeight="bold">{label}</text>
              <text x={x + 80} y={y + 70} textAnchor="middle" fill={color} fontSize="8" fontFamily="monospace">{MODE_LABELS[node.mode] || ''}</text>
              {instrumentTag(x + 140, y - 10, 'TIC', '201')}
              {paramBox(x + 20, y + 82, 'ТЕМПЕРАТУРА', p.temperature || 0, '°C', node.mode === 'RUNNING')}
            </g>
          );
        }
        if (node.type === 'electrodehydrator') {
          const p = node.parameters;
          const x = 560, y = 95;
          return (
            <g key={node.id} onClick={() => onSelect(node.id)} style={{ cursor: 'pointer' }}>
              <rect x={x} y={y} width="160" height="70" rx="10" fill={c.equipFill} stroke={selStroke} strokeWidth={selW} />
              {[25, 45, 65].map(dy => <line key={dy} x1={x + 15} y1={y + dy} x2={x + 145} y2={y + dy} stroke={c.hv} strokeWidth="1.5" opacity="0.6" />)}
              <text x={x + 80} y={y + 14} textAnchor="middle" fill={c.hv} fontSize="8" fontFamily="monospace">≈ HV</text>
              <text x={x + 80} y={y + 55} textAnchor="middle" fill={c.textMain} fontSize="11" fontWeight="bold">{label}</text>
              <text x={x + 80} y={y + 80} textAnchor="middle" fill={color} fontSize="8" fontFamily="monospace">{MODE_LABELS[node.mode] || ''}</text>
              {instrumentTag(x + 145, y + 5, 'WIT', '301')}
              {instrumentTag(x + 145, y + 60, 'SIT', '302')}
              {paramBox(x - 20, y + 102, 'ВОДА', p.water_content || 0, '%', node.mode === 'RUNNING')}
              {paramBox(x + 88, y + 102, 'СОЛИ', p.salt_mg_l || 0, 'мг/л', node.mode === 'RUNNING')}
            </g>
          );
        }
        if (node.type === 'furnace') {
          const p = node.parameters;
          const x = 340, y = 235;
          return (
            <g key={node.id} onClick={() => onSelect(node.id)} style={{ cursor: 'pointer' }}>
              <rect x={x} y={y} width="80" height="50" rx="4" fill={c.equipFill} stroke={selStroke} strokeWidth={selW} />
              <path d={`M ${x + 25} ${y + 42} Q ${x + 20} ${y + 25} ${x + 30} ${y + 15} Q ${x + 40} ${y + 25} ${x + 35} ${y + 42}`} fill="none" stroke={c.flame} strokeWidth="1.5" />
              <path d={`M ${x + 45} ${y + 42} Q ${x + 40} ${y + 25} ${x + 50} ${y + 15} Q ${x + 60} ${y + 25} ${x + 55} ${y + 42}`} fill="none" stroke={c.flame} strokeWidth="1.5" />
              <text x={x + 40} y={y + 30} textAnchor="middle" fill={c.textMain} fontSize="9" fontWeight="bold">{label}</text>
              <text x={x + 40} y={y + 66} textAnchor="middle" fill={color} fontSize="7" fontFamily="monospace">{MODE_LABELS[node.mode] || ''}</text>
              {instrumentTag(x + 70, y - 5, 'TIC', '601')}
              {paramBox(x - 6, y + 72, 'ТЕМП', p.temperature || 0, '°C', node.mode === 'RUNNING')}
            </g>
          );
        }
        if (node.type === 'tank') {
          const p = node.parameters;
          const x = 590, y = 290;
          return (
            <g key={node.id} onClick={() => onSelect(node.id)} style={{ cursor: 'pointer' }}>
              <rect x={x} y={y} width="100" height="55" rx="27" fill={c.equipFill} stroke={selStroke} strokeWidth={selW} />
              <text x={x + 50} y={y + 25} textAnchor="middle" fill={c.textMain} fontSize="10" fontWeight="bold">{label}</text>
              <text x={x + 50} y={y + 40} textAnchor="middle" fill={color} fontSize="7" fontFamily="monospace">{MODE_LABELS[node.mode] || ''}</text>
              <rect x={x + 8} y={y + 10} width="84" height="35" rx="17" fill="none" stroke={c.paramBorder} strokeWidth="0.5" />
              <rect x={x + 8} y={y + 45 - (p.level || 0) * 0.35} width="84" height={(p.level || 0) * 0.35} rx="17" fill={c.water} opacity="0.3" />
              {instrumentTag(x - 20, y + 10, 'LIT', '401')}
              {paramBox(x - 6, y + 62, 'УРОВЕНЬ', p.level || 0, '%', node.mode === 'RUNNING')}
            </g>
          );
        }
        if (node.type === 'regulator') {
          const p = node.parameters;
          const x = 420, y = 300;
          return (
            <g key={node.id} onClick={() => onSelect(node.id)} style={{ cursor: 'pointer' }}>
              <rect x={x} y={y} width="80" height="45" rx="4" fill={c.equipFill} stroke={selStroke} strokeWidth={selW} />
              <text x={x + 40} y={y + 22} textAnchor="middle" fill={c.textMain} fontSize="10" fontWeight="bold">{label}</text>
              <text x={x + 40} y={y + 36} textAnchor="middle" fill={color} fontSize="7" fontFamily="monospace">{MODE_LABELS[node.mode] || ''}</text>
              {instrumentTag(x + 70, y - 5, 'FIC', '501')}
              {paramBox(x - 6, y + 52, 'КЛАПАН', p.valve_pos || 0, '%', node.mode === 'RUNNING')}
            </g>
          );
        }
        return null;
      })}

      {/* Legend */}
      <rect x="0" y={svgH - 28} width={svgW} height="28" fill={c.legend} />
      <circle cx="10" cy={svgH - 15} r="4" fill={dark ? '#4caf50' : '#2e7d32'} />
      <text x="20" y={svgH - 12} fill={c.textSec} fontSize="8" fontFamily="monospace">Работает</text>
      <circle cx="80" cy={svgH - 15} r="4" fill={dark ? '#888' : '#999'} />
      <text x="90" y={svgH - 12} fill={c.textSec} fontSize="8" fontFamily="monospace">Остановлен</text>
      <circle cx="160" cy={svgH - 15} r="4" fill={dark ? '#f44336' : '#c62828'} />
      <text x="170" y={svgH - 12} fill={c.textSec} fontSize="8" fontFamily="monospace">Авария</text>
      <polygon points={`220,${svgH - 19} 220,${svgH - 11} 228,${svgH - 15}`} fill={c.valve} />
      <text x="234" y={svgH - 12} fill={c.textSec} fontSize="8" fontFamily="monospace">клапан</text>
      <text x="280" y={svgH - 12} fill={c.textSec} fontSize="8" fontFamily="monospace">→ поток</text>
      <text x="340" y={svgH - 12} fill={c.instrText} fontSize="8" fontFamily="monospace">○ КИПиА</text>
    </svg>
  );
}
