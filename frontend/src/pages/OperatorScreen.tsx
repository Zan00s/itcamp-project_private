import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSimStore } from '../store/simStore';
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

const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  feed_pump: { x: 100, y: 90 },
  preheater: { x: 370, y: 110 },
  dehydrator: { x: 680, y: 85 },
  output: { x: 970, y: 95 },
  tank: { x: 710, y: 260 },
  regulator: { x: 420, y: 275 },
  furnace: { x: 380, y: 370 },
};

export default function OperatorScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { graph, currentScenario, journal, loading, error, loadGraph, selectScenario, applyAction } = useSimStore();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [actionValue, setActionValue] = useState<string>('');
  const [verdict, setVerdict] = useState<VerdictDTO | null>(null);
  const journalRef = useRef<HTMLDivElement>(null);
  const [showHint, setShowHint] = useState<string | null>(null);
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [contextHint, setContextHint] = useState<string | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (sessionId) {
      apiClient.getSession(sessionId).then((s) => {
        selectScenario(s.scenarioId);
      });
      loadGraph();
    }
  }, [sessionId]);

  useEffect(() => {
    if (journalRef.current) {
      journalRef.current.scrollTop = journalRef.current.scrollHeight;
    }
  }, [journal]);

  const handleAction = async (nodeId: string, actionId: string) => {
    const node = graph?.nodes.find((n) => n.id === nodeId);
    const action = node?.actions.find((a) => a.id === actionId);
    if (action?.param && action.min !== null && action.max !== null) {
      const val = parseFloat(actionValue);
      if (isNaN(val)) {
        alert(`Введите значение от ${action.min} до ${action.max}`);
        return;
      }
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
    try {
      const v = await apiClient.endSession(sessionId);
      setVerdict(v);
    } catch (e: any) {
      console.error(e);
    }
  };

  const fetchContextHint = async () => {
    if (!sessionId) return;
    try {
      const res = await apiClient.getContextHint(sessionId);
      setContextHint(res.text);
    } catch {
      setContextHint('Не удалось получить подсказку');
    }
  };

  const fetchAiExplanation = async () => {
    if (!sessionId || journal.length === 0) return;
    const lastEntry = journal[journal.length - 1];
    setAiLoading(true);
    try {
      const res = await apiClient.explainAction({
        node: lastEntry.node,
        action: actionLabel(lastEntry.action),
        value: lastEntry.value ?? undefined,
        chain: lastEntry.chain,
      });
      setAiExplanation(res.text);
    } catch {
      setAiExplanation('МадИИна недоступна');
    }
    setAiLoading(false);
  };

  if (verdict) {
    navigate(`/results/${sessionId}`, { state: { verdict } });
    return null;
  }

  const selectedNodeData = graph?.nodes.find((n) => n.id === selectedNode);

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a2e', color: '#eee', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '0.75rem 2rem', background: '#16213e', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>КТК ЭЛОУ-АВТ — Оператор</h2>
          {currentScenario && <span style={{ color: '#aaa', fontSize: '0.85rem' }}>{currentScenario.name}</span>}
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={fetchContextHint} style={btnStyle}>Контекстная подсказка</button>
          <button onClick={() => setShowHint(showHint === 'hints' ? null : 'hints')} style={btnStyle}>Подсказки по фазам</button>
          <button onClick={handleEnd} style={{ ...btnStyle, background: '#f44336', color: '#fff' }}>Завершить</button>
        </div>
      </div>

      {error && <div style={{ background: '#f44336', padding: '8px 2rem', color: '#fff' }}>{error}</div>}
      {contextHint && (
        <div style={{ background: '#0f3460', padding: '10px 2rem', color: '#e94560', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>💡 {contextHint}</span>
          <button onClick={() => setContextHint(null)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}>×</button>
        </div>
      )}
      {aiExplanation && (
        <div style={{ background: '#2d1b4e', padding: '10px 2rem', color: '#b39ddb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>🤖 МадИИна: {aiExplanation}</span>
          <button onClick={() => setAiExplanation(null)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Main content: P&ID + Actions + Journal */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* P&ID Diagram */}
        <div style={{ flex: 2, padding: '1rem', overflow: 'auto', position: 'relative' }}>
          {currentScenario && (
            <div style={{ marginBottom: '0.5rem', padding: '8px 12px', background: '#0f3460', borderRadius: '8px', border: '1px solid #e94560' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: '#e94560', fontWeight: 'bold' }}>Фазы:</span>
                {currentScenario.phases.map((ph, i) => (
                  <span key={ph.id} style={{ color: '#aaa', fontSize: '0.85rem' }}>
                    {i + 1}. {ph.title}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div style={{ overflowX: 'auto', paddingBottom: '8px' }}>
            <Mnemoscheme graph={graph} selectedNode={selectedNode} highlightedNodes={highlightedNodes} onSelect={setSelectedNode} />
          </div>
        </div>

        {/* Actions Panel */}
        <div style={{ width: '300px', background: '#16213e', padding: '1rem', overflow: 'auto', borderLeft: '1px solid #333' }}>
          <h3 style={{ marginTop: 0 }}>Действия</h3>
          {!selectedNodeData && <p style={{ color: '#888' }}>Выберите узел на схеме</p>}
          {selectedNodeData && (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <strong>{selectedNodeData.name}</strong>
                <div style={{ fontSize: '0.85rem', color: '#aaa' }}>
                  Тип: {TYPE_LABELS[selectedNodeData.type] || selectedNodeData.type} | Режим: {MODE_LABELS[selectedNodeData.mode] || selectedNodeData.mode}
                </div>
              </div>
              <div style={{ marginBottom: '0.75rem', padding: '8px', background: '#0f0f1e', borderRadius: '6px' }}>
                {Object.entries(selectedNodeData.parameters).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: '#888' }}>{selectedNodeData.paramLabels?.[k] || k}:</span>
                    <span>{v.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              {selectedNodeData.actions.map((action) => {
                const isStart = action.id === 'start';
                const isStop = action.id === 'stop';
                const isRunning = selectedNodeData.mode === 'RUNNING';
                const isStopped = selectedNodeData.mode === 'STOPPED';
                const disabled = (isStart && isRunning) || (isStop && isStopped);

                return (
                  <div key={action.id} style={{ marginBottom: '0.75rem' }}>
                    {action.param && (
                      <input
                        type="number"
                        placeholder={`${action.min} - ${action.max}`}
                        value={actionValue}
                        onChange={(e) => setActionValue(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          background: '#0f0f1e',
                          border: '1px solid #333',
                          borderRadius: '4px',
                          color: '#eee',
                          marginBottom: '4px',
                          boxSizing: 'border-box',
                        }}
                      />
                    )}
                    <button
                      onClick={() => handleAction(selectedNodeData.id, action.id)}
                      disabled={loading || disabled}
                      style={{
                        ...btnStyle,
                        width: '100%',
                        padding: '8px',
                        background: isStart ? '#1b5e20' : isStop ? '#b71c1c' : '#0f3460',
                        border: isStart ? '1px solid #4caf50' : isStop ? '1px solid #f44336' : '1px solid #e94560',
                        color: isStart ? '#a5d6a7' : isStop ? '#ef9a9a' : '#e94560',
                        opacity: disabled ? 0.4 : 1,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {action.label}
                      {disabled && ' (недоступно)'}
                    </button>
                  </div>
                );
              })}
              {journal.length > 0 && (
                <button
                  onClick={fetchAiExplanation}
                  disabled={aiLoading}
                  style={{ ...btnStyle, width: '100%', background: '#4a148c', border: '1px solid #b39ddb', color: '#b39ddb', marginTop: '0.5rem' }}
                >
                  {aiLoading ? 'МадИИна анализирует...' : '🤖 МадИИна-пояснение действия'}
                </button>
              )}
            </>
          )}
        </div>

        {/* Journal Panel */}
        <div style={{ width: '350px', background: '#16213e', padding: '1rem', overflow: 'auto', borderLeft: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginTop: 0 }}>Журнал событий</h3>
          <div ref={journalRef} style={{ flex: 1, overflow: 'auto' }}>
            {journal.length === 0 && <p style={{ color: '#888' }}>Нет событий</p>}
            {journal.map((entry, idx) => (
              <div key={idx} style={{
                padding: '8px',
                marginBottom: '4px',
                background: '#0f0f1e',
                borderRadius: '6px',
                borderLeft: `3px solid ${entry.result === 'Applied' ? '#4caf50' : entry.result === 'Clamped' ? '#ff9800' : '#f44336'}`,
              }}>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </div>
                <div style={{ fontSize: '0.9rem' }}>
                  <strong>{NODE_LABELS[entry.node] || entry.node}</strong>: {actionLabel(entry.action)}
                  {entry.value !== null && ` = ${entry.value.toFixed(1)}`}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#aaa' }}>
                  Результат: {RESULT_LABELS[entry.result] || entry.result}
                </div>
                {entry.chain.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#8bc34a', marginTop: '4px', padding: '4px 8px', background: '#1b2818', borderRadius: '4px' }}>
                    <span style={{ color: '#8bc34a', fontWeight: 'bold' }}>Каскадное влияние:</span>
                    {entry.chain.map((c, ci) => (
                      <span key={ci}>
                        {ci > 0 && ' → '}
                        <span style={{ color: '#e94560' }}>{NODE_LABELS[c.node] || c.node}</span>
                        <span style={{ color: '#aaa' }}>({c.changed.map(paramLabel).join(', ')})</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hints Modal */}
      {showHint === 'hints' && currentScenario && (
        <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', background: '#16213e', padding: '2rem', borderRadius: '12px', border: '1px solid #333', zIndex: 100, minWidth: '400px' }}>
          <h3>Подсказки по фазам</h3>
          {currentScenario.phases.map((ph) => (
            <div key={ph.id} style={{ marginBottom: '1rem' }}>
              <strong style={{ color: '#e94560' }}>{ph.title}</strong>
              <p style={{ color: '#aaa', margin: '4px 0' }}>
                {currentScenario.bankHints?.find((h: any) => h.key === ph.id)?.text || 'Нет подсказки'}
              </p>
            </div>
          ))}
          <button onClick={() => setShowHint(null)} style={btnStyle}>Закрыть</button>
        </div>
      )}
    </div>
  );
}

function Mnemoscheme({
  graph,
  selectedNode,
  highlightedNodes,
  onSelect,
}: {
  graph: any;
  selectedNode: string | null;
  highlightedNodes: Set<string>;
  onSelect: (id: string) => void;
}) {
  const svgW = 1040;
  const svgH = 440;

  const getNode = (nodeId: string) => graph?.nodes.find((n: any) => n.id === nodeId);
  const nodeColor = (n: any) => n ? (MODE_COLORS[n.mode] || '#555') : '#555';
  const isRunning = (nodeId: string) => getNode(nodeId)?.mode === 'RUNNING';

  const paramBox = (x: number, y: number, label: string, value: number, unit: string, running: boolean) => {
    const vcolor = running ? '#4caf50' : '#666';
    return (
      <g>
        <rect x={x} y={y} width="88" height="28" rx="3" fill="#0a0f1a" stroke="#1e2d3d" strokeWidth="1" />
        <text x={x + 4} y={y + 11} fill="#5a7a8a" fontSize="7" fontFamily="monospace">{label}</text>
        <text x={x + 4} y={y + 23} fill={vcolor} fontSize="11" fontFamily="monospace" fontWeight="bold">
          {value.toFixed(1)} {unit}
        </text>
      </g>
    );
  };

  const instrumentTag = (x: number, y: number, tag: string, label: string) => (
    <g>
      <circle cx={x} cy={y} r="13" fill="#0d1520" stroke="#3a5a7a" strokeWidth="1.5" />
      <line x1={x - 13} y1={y} x2={x - 20} y2={y} stroke="#3a5a7a" strokeWidth="1" />
      <text x={x} y={y - 1} textAnchor="middle" fill="#8ab4d8" fontSize="7" fontWeight="bold">{tag}</text>
      <text x={x} y={y + 8} textAnchor="middle" fill="#6a8aaa" fontSize="6">{label}</text>
    </g>
  );

  return (
    <svg width={svgW} height={svgH} style={{ background: '#0d1117', borderRadius: '8px', minWidth: svgW, border: '1px solid #1a2332' }}>
      <defs>
        {/* Grid pattern */}
        <pattern id="scadaGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#141b2a" strokeWidth="0.5" />
        </pattern>
        {/* Flow animation for active pipes */}
        <pattern id="flowActive" width="16" height="2" patternUnits="userSpaceOnUse">
          <line x1="0" y1="1" x2="8" y2="1" stroke="#4caf50" strokeWidth="2" />
        </pattern>
        {/* Arrow marker */}
        <marker id="pidArrow" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L8,3 z" fill="#3a5a7a" />
        </marker>
      </defs>

      {/* Grid background */}
      <rect width={svgW} height={svgH} fill="url(#scadaGrid)" />

      {/* Title bar */}
      <rect x="0" y="0" width={svgW} height="24" fill="#161e2e" />
      <text x="12" y="16" fill="#8ab4d8" fontSize="11" fontWeight="bold" fontFamily="monospace">
        МНЕМОСХЕМА ЭЛОУ-АВТ — P&amp;ID
      </text>
      <text x={svgW - 12} y="16" textAnchor="end" fill="#5a7a8a" fontSize="9" fontFamily="monospace">
        {new Date().toLocaleTimeString('ru-RU')}
      </text>

      {/* === Pipelines === */}
      {/* Main process line: Вход → Н-82 → А-19 → Э-1 → Выход */}
      {/* Вход → Н-82 */}
      <line x1="30" y1="120" x2="130" y2="120" stroke="#2a3a5a" strokeWidth="6" />
      {isRunning('feed_pump') && <line x1="30" y1="120" x2="130" y2="120" stroke="url(#flowActive)" strokeWidth="4" />}
      <text x="32" y="110" fill="#5a7a8a" fontSize="9" fontFamily="monospace">НЕФТЬ ВХОД</text>
      <polygon points="130,120 122,116 122,124" fill="#3a5a7a" />

      {/* Н-82 → А-19 */}
      <line x1="250" y1="120" x2="370" y2="120" stroke="#2a3a5a" strokeWidth="6" />
      {isRunning('feed_pump') && <line x1="250" y1="120" x2="370" y2="120" stroke="url(#flowActive)" strokeWidth="4" />}
      <polygon points="370,120 362,116 362,124" fill="#3a5a7a" />

      {/* А-19 → Э-1 */}
      <line x1="550" y1="120" x2="680" y2="120" stroke="#2a3a5a" strokeWidth="6" />
      {isRunning('preheater') && <line x1="550" y1="120" x2="680" y2="120" stroke="url(#flowActive)" strokeWidth="4" />}
      <polygon points="680,120 672,116 672,124" fill="#3a5a7a" />

      {/* Э-1 → Выход (товарная нефть) */}
      <line x1="840" y1="120" x2="970" y2="120" stroke="#2a3a5a" strokeWidth="6" />
      {isRunning('dehydrator') && <line x1="840" y1="120" x2="970" y2="120" stroke="url(#flowActive)" strokeWidth="4" />}
      <polygon points="970,120 962,116 962,124" fill="#3a5a7a" />
      <text x="940" y="110" fill="#5a7a8a" fontSize="9" fontFamily="monospace">ТОВАР</text>

      {/* Э-1 → Е-16 (дренаж воды вниз) */}
      <line x1="760" y1="180" x2="760" y2="260" stroke="#2a3a5a" strokeWidth="5" />
      {isRunning('dehydrator') && <line x1="760" y1="180" x2="760" y2="260" stroke="url(#flowActive)" strokeWidth="3" />}
      <polygon points="760,260 756,252 764,252" fill="#3a5a7a" />
      <text x="768" y="225" fill="#3a6a8a" fontSize="8" fontFamily="monospace">→ вода</text>

      {/* Е-16 → Р-11 (наregулятор) */}
      <line x1="700" y1="300" x2="520" y2="300" stroke="#2a3a5a" strokeWidth="5" />
      {isRunning('tank') && <line x1="700" y1="300" x2="520" y2="300" stroke="url(#flowActive)" strokeWidth="3" />}
      <polygon points="520,300 528,296 528,304" fill="#3a5a7a" />

      {/* Р-11 → слив */}
      <line x1="420" y1="300" x2="340" y2="300" stroke="#2a3a5a" strokeWidth="5" />
      {isRunning('regulator') && <line x1="420" y1="300" x2="340" y2="300" stroke="url(#flowActive)" strokeWidth="3" />}
      <text x="310" y="290" fill="#5a7a8a" fontSize="8" fontFamily="monospace">→ слив</text>

      {/* === Equipment symbols (ISA P&ID) === */}
      {graph?.nodes.map((node: any) => {
        const pos = NODE_POSITIONS[node.id];
        if (!pos) return null;
        const color = nodeColor(node);
        const isSel = selectedNode === node.id;
        const isHi = highlightedNodes.has(node.id);
        const label = NODE_LABELS[node.id] || node.name;
        const selStroke = isSel ? '#e94560' : isHi ? '#ffeb3b' : color;
        const selW = (isSel || isHi) ? 3 : 1.5;

        /* Centrifugal pump (ISA symbol: circle with triangle from bottom) */
        if (node.type === 'feed_pump') {
          const p = node.parameters;
          return (
            <g key={node.id} onClick={() => onSelect(node.id)} style={{ cursor: 'pointer' }}>
              {/* Pump body */}
              <circle cx={pos.x + 60} cy={pos.y + 30} r="28" fill="#111a2a" stroke={selStroke} strokeWidth={selW} />
              {/* Triangle (discharge) */}
              <polygon points={`${pos.x + 60},${pos.y + 2} ${pos.x + 48},${pos.y + 22} ${pos.x + 72},${pos.y + 22}`} fill="none" stroke={selStroke} strokeWidth={selW} />
              {/* Suction (bottom line to center) */}
              <line x1={pos.x + 60} y1={pos.y + 30} x2={pos.x + 60} y2={pos.y + 58} stroke={selStroke} strokeWidth={selW} />
              <text x={pos.x + 60} y={pos.y + 35} textAnchor="middle" fill="#c0c8d0" fontSize="10" fontWeight="bold">{label}</text>
              <text x={pos.x + 60} y={pos.y + 76} textAnchor="middle" fill={color} fontSize="8" fontFamily="monospace">{MODE_LABELS[node.mode] || ''}</text>
              {/* Instrument: FIT (Flow Indicator Transmitter) */}
              {instrumentTag(pos.x + 15, pos.y + 55, 'FIT', '101')}
              {/* Param boxes */}
              {paramBox(pos.x - 10, pos.y + 90, 'МОЩНОСТЬ', p.power_percent || 0, '%', node.mode === 'RUNNING')}
              {paramBox(pos.x + 88, pos.y + 90, 'РАСХОД', p.flow_rate || 0, 'м³/ч', node.mode === 'RUNNING')}
            </g>
          );
        }

        /* Shell-and-tube heat exchanger (ISA: rectangle with tube ends) */
        if (node.type === 'preheater') {
          const p = node.parameters;
          return (
            <g key={node.id} onClick={() => onSelect(node.id)} style={{ cursor: 'pointer' }}>
              {/* Shell */}
              <rect x={pos.x} y={pos.y + 10} width="180" height="50" rx="6" fill="#111a2a" stroke={selStroke} strokeWidth={selW} />
              {/* Tube bundle lines */}
              {[0, 1, 2, 3].map(i => (
                <line key={i} x1={pos.x + 8} y1={pos.y + 20 + i * 10} x2={pos.x + 172} y2={pos.y + 20 + i * 10} stroke={color} strokeWidth="0.8" opacity="0.5" />
              ))}
              {/* Tube ends (bonnets) */}
              <rect x={pos.x - 8} y={pos.y + 14} width="8" height="42" fill="#0a1220" stroke={selStroke} strokeWidth={selW} />
              <rect x={pos.x + 180} y={pos.y + 14} width="8" height="42" fill="#0a1220" stroke={selStroke} strokeWidth={selW} />
              <text x={pos.x + 90} y={pos.y + 42} textAnchor="middle" fill="#c0c8d0" fontSize="11" fontWeight="bold">{label}</text>
              <text x={pos.x + 90} y={pos.y + 78} textAnchor="middle" fill={color} fontSize="8" fontFamily="monospace">{MODE_LABELS[node.mode] || ''}</text>
              {/* Instrument: TIC (Temperature Indicator Controller) */}
              {instrumentTag(pos.x + 160, pos.y, 'TIC', '201')}
              {paramBox(pos.x + 20, pos.y + 90, 'ТЕМПЕРАТУРА', p.temperature || 0, '°C', node.mode === 'RUNNING')}
            </g>
          );
        }

        /* Electrodehydrator (vessel with electrode bars) */
        if (node.type === 'electrodehydrator') {
          const p = node.parameters;
          return (
            <g key={node.id} onClick={() => onSelect(node.id)} style={{ cursor: 'pointer' }}>
              {/* Vessel body */}
              <rect x={pos.x} y={pos.y} width="160" height="75" rx="10" fill="#111a2a" stroke={selStroke} strokeWidth={selW} />
              {/* Electrode bars (horizontal lines inside) */}
              {[20, 35, 50].map(dy => (
                <line key={dy} x1={pos.x + 15} y1={pos.y + dy} x2={pos.x + 145} y2={pos.y + dy} stroke="#ff9800" strokeWidth="1.5" opacity="0.6" />
              ))}
              {/* HV symbol */}
              <text x={pos.x + 80} y={pos.y + 16} textAnchor="middle" fill="#ff9800" fontSize="8" fontFamily="monospace">≈ HV</text>
              <text x={pos.x + 80} y={pos.y + 67} textAnchor="middle" fill="#c0c8d0" fontSize="11" fontWeight="bold">{label}</text>
              <text x={pos.x + 80} y={pos.y + 96} textAnchor="middle" fill={color} fontSize="8" fontFamily="monospace">{MODE_LABELS[node.mode] || ''}</text>
              {/* Instruments */}
              {instrumentTag(pos.x + 145, pos.y + 5, 'WIT', '301')}
              {instrumentTag(pos.x + 145, pos.y + 70, 'SIT', '302')}
              {paramBox(pos.x - 20, pos.y + 110, 'ВОДА', p.water_content || 0, '%', node.mode === 'RUNNING')}
              {paramBox(pos.x + 88, pos.y + 110, 'СОЛИ', p.salt_mg_l || 0, 'мг/л', node.mode === 'RUNNING')}
            </g>
          );
        }

        /* Tank/Drum (horizontal cylinder) */
        if (node.type === 'tank') {
          const p = node.parameters;
          return (
            <g key={node.id} onClick={() => onSelect(node.id)} style={{ cursor: 'pointer' }}>
              {/* Cylinder body */}
              <rect x={pos.x} y={pos.y} width="100" height="55" rx="27" fill="#111a2a" stroke={selStroke} strokeWidth={selW} />
              <text x={pos.x + 50} y={pos.y + 25} textAnchor="middle" fill="#c0c8d0" fontSize="10" fontWeight="bold">{label}</text>
              <text x={pos.x + 50} y={pos.y + 40} textAnchor="middle" fill={color} fontSize="7" fontFamily="monospace">{MODE_LABELS[node.mode] || ''}</text>
              {/* Level indicator (fill bar inside) */}
              <rect x={pos.x + 8} y={pos.y + 10} width="84" height="35" rx="17" fill="none" stroke="#1e2d3d" strokeWidth="0.5" />
              <rect x={pos.x + 8} y={pos.y + 45 - (p.level || 0) * 0.35} width="84" height={(p.level || 0) * 0.35} rx="17" fill="#1565c0" opacity="0.3" />
              {instrumentTag(pos.x - 20, pos.y + 10, 'LIT', '401')}
              {paramBox(pos.x - 10, pos.y + 75, 'УРОВЕНЬ', p.level || 0, '%', node.mode === 'RUNNING')}
            </g>
          );
        }

        /* Control valve (ISA: bow-tie with actuator) */
        if (node.type === 'regulator') {
          const p = node.parameters;
          const vpos = p.valve_pos || 0;
          return (
            <g key={node.id} onClick={() => onSelect(node.id)} style={{ cursor: 'pointer' }}>
              {/* Actuator (top) */}
              <rect x={pos.x + 25} y={pos.y - 15} width="20" height="12" rx="2" fill="#0a1220" stroke={selStroke} strokeWidth={selW} />
              <line x1={pos.x + 35} y1={pos.y - 3} x2={pos.x + 35} y2={pos.y + 5} stroke={selStroke} strokeWidth={selW} />
              {/* Valve body (bow-tie) */}
              <polygon points={`${pos.x + 10},${pos.y + 5} ${pos.x + 35},${pos.y + 25} ${pos.x + 10},${pos.y + 45}`} fill="#111a2a" stroke={selStroke} strokeWidth={selW} />
              <polygon points={`${pos.x + 60},${pos.y + 5} ${pos.x + 35},${pos.y + 25} ${pos.x + 60},${pos.y + 45}`} fill="#111a2a" stroke={selStroke} strokeWidth={selW} />
              {/* Stem position indicator */}
              <line x1={pos.x + 35} y1={pos.y + 5} x2={pos.x + 35} y2={pos.y + 25 - vpos * 0.2} stroke="#4caf50" strokeWidth="2" opacity="0.7" />
              <text x={pos.x + 35} y={pos.y + 60} textAnchor="middle" fill="#c0c8d0" fontSize="10" fontWeight="bold">{label}</text>
              <text x={pos.x + 35} y={pos.y + 73} textAnchor="middle" fill={color} fontSize="7" fontFamily="monospace">{MODE_LABELS[node.mode] || ''}</text>
              {instrumentTag(pos.x + 65, pos.y + 5, 'FIC', '501')}
              {paramBox(pos.x - 10, pos.y + 85, 'КЛАПАН', vpos, '%', node.mode === 'RUNNING')}
            </g>
          );
        }

        /* Output flange */
        if (node.type === 'output') {
          const p = node.parameters;
          return (
            <g key={node.id} onClick={() => onSelect(node.id)} style={{ cursor: 'pointer' }}>
              <rect x={pos.x} y={pos.y} width="60" height="50" rx="4" fill="#111a2a" stroke={selStroke} strokeWidth={selW} />
              {/* Flange rings */}
              <line x1={pos.x + 10} y1={pos.y} x2={pos.x + 10} y2={pos.y + 50} stroke={selStroke} strokeWidth="1" />
              <line x1={pos.x + 50} y1={pos.y} x2={pos.x + 50} y2={pos.y + 50} stroke={selStroke} strokeWidth="1" />
              <text x={pos.x + 30} y={pos.y + 22} textAnchor="middle" fill="#c0c8d0" fontSize="9" fontWeight="bold">{label}</text>
              <text x={pos.x + 30} y={pos.y + 35} textAnchor="middle" fill={color} fontSize="7" fontFamily="monospace">{MODE_LABELS[node.mode] || ''}</text>
              {paramBox(pos.x - 5, pos.y + 60, 'ВОДА', p.water_content || 0, '%', node.mode === 'RUNNING')}
            </g>
          );
        }

        /* Furnace (shown as fired heater symbol) */
        if (node.type === 'furnace') {
          const p = node.parameters;
          return (
            <g key={node.id} onClick={() => onSelect(node.id)} style={{ cursor: 'pointer' }}>
              <rect x={pos.x} y={pos.y} width="90" height="55" rx="4" fill="#111a2a" stroke={selStroke} strokeWidth={selW} />
              {/* Flame symbol */}
              <path d={`M ${pos.x + 35} ${pos.y + 45} Q ${pos.x + 30} ${pos.y + 30} ${pos.x + 40} ${pos.y + 20} Q ${pos.x + 50} ${pos.y + 30} ${pos.x + 45} ${pos.y + 45}`} fill="none" stroke="#ff6600" strokeWidth="1.5" />
              <text x={pos.x + 45} y={pos.y + 52} textAnchor="middle" fill="#c0c8d0" fontSize="9" fontWeight="bold">{label}</text>
              <text x={pos.x + 45} y={pos.y + 73} textAnchor="middle" fill={color} fontSize="7" fontFamily="monospace">{MODE_LABELS[node.mode] || ''}</text>
              {paramBox(pos.x - 5, pos.y + 85, 'ТЕМП', p.temperature || 0, '°C', node.mode === 'RUNNING')}
            </g>
          );
        }

        return null;
      })}

      {/* Legend bar at bottom */}
      <rect x="0" y={svgH - 28} width={svgW} height="28" fill="#111a2a" />
      <text x="12" y={svgH - 12} fill="#5a7a8a" fontSize="8" fontFamily="monospace">
        ● Работает
      </text>
      <circle cx="10" cy={svgH - 15} r="4" fill="#4caf50" />
      <text x="80" y={svgH - 12} fill="#5a7a8a" fontSize="8" fontFamily="monospace">Остановлен</text>
      <circle cx="78" cy={svgH - 15} r="4" fill="#888" />
      <text x="155" y={svgH - 12} fill="#5a7a8a" fontSize="8" fontFamily="monospace">Авария</text>
      <circle cx="153" cy={svgH - 15} r="4" fill="#f44336" />
      <text x="220" y={svgH - 12} fill="#3a6a8a" fontSize="8" fontFamily="monospace">→ поток нефти</text>
      <text x="340" y={svgH - 12} fill="#8ab4d8" fontSize="8" fontFamily="monospace">○ прибор (ISA)</text>
    </svg>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '6px 16px',
  background: '#0f3460',
  color: '#eee',
  border: '1px solid #333',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.9rem',
};
