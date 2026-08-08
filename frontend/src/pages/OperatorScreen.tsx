import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSimStore } from '../store/simStore';
import { apiClient, type VerdictDTO } from '../api/client';

const MODE_COLORS: Record<string, string> = {
  STOPPED: '#555',
  RUNNING: '#4caf50',
  ALARM: '#f44336',
  MAINTENANCE: '#ff9800',
};

const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  feed_pump: { x: 50, y: 200 },
  preheater: { x: 300, y: 200 },
  furnace: { x: 550, y: 100 },
  dehydrator: { x: 800, y: 200 },
  output: { x: 1050, y: 200 },
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
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>КТК ЭЛОУ-АВ — Оператор</h2>
          {currentScenario && <span style={{ color: '#aaa', fontSize: '0.85rem' }}>{currentScenario.name}</span>}
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={() => setShowHint(showHint === 'hints' ? null : 'hints')} style={btnStyle}>Подсказки</button>
          <button onClick={handleEnd} style={{ ...btnStyle, background: '#f44336', color: '#fff' }}>Завершить</button>
        </div>
      </div>

      {error && <div style={{ background: '#f44336', padding: '8px 2rem', color: '#fff' }}>{error}</div>}

      {/* Main content: P&ID + Actions + Journal */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* P&ID Diagram */}
        <div style={{ flex: 2, padding: '1rem', overflow: 'auto', position: 'relative' }}>
          <svg width="1150" height="400" style={{ background: '#0f0f1e', borderRadius: '8px' }}>
            {/* Edges */}
            {graph?.edges.map((edge) => {
              const from = NODE_POSITIONS[edge.from] || { x: 0, y: 0 };
              const to = NODE_POSITIONS[edge.to] || { x: 0, y: 0 };
              return (
                <line
                  key={edge.id}
                  x1={from.x + 120}
                  y1={from.y + 40}
                  x2={to.x}
                  y2={to.y + 40}
                  stroke="#555"
                  strokeWidth="2"
                  markerEnd="url(#arrow)"
                />
              );
            })}
            <defs>
              <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,6 L9,3 z" fill="#555" />
              </marker>
            </defs>
            {/* Nodes */}
            {graph?.nodes.map((node) => {
              const pos = NODE_POSITIONS[node.id] || { x: 0, y: 0 };
              const color = MODE_COLORS[node.mode] || '#555';
              return (
                <g key={node.id} onClick={() => setSelectedNode(node.id)} style={{ cursor: 'pointer' }}>
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width="120"
                    height="80"
                    rx="8"
                    fill="#16213e"
                    stroke={selectedNode === node.id ? '#e94560' : color}
                    strokeWidth="2"
                  />
                  <circle cx={pos.x + 12} cy={pos.y + 12} r="5" fill={color} />
                  <text x={pos.x + 60} y={pos.y + 30} textAnchor="middle" fill="#eee" fontSize="11" fontWeight="bold">
                    {node.name.length > 16 ? node.name.substring(0, 14) + '...' : node.name}
                  </text>
                  <text x={pos.x + 60} y={pos.y + 48} textAnchor="middle" fill="#aaa" fontSize="9">
                    {node.mode}
                  </text>
                  <text x={pos.x + 60} y={pos.y + 62} textAnchor="middle" fill="#aaa" fontSize="8">
                    {Object.entries(node.parameters)
                      .slice(0, 2)
                      .map(([k, v]) => `${k.split('_')[0]}:${v.toFixed(0)}`)
                      .join(' ')}
                  </text>
                </g>
              );
            })}
          </svg>
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
                  Тип: {selectedNodeData.type} | Режим: {selectedNodeData.mode}
                </div>
              </div>
              <div style={{ marginBottom: '0.75rem', padding: '8px', background: '#0f0f1e', borderRadius: '6px' }}>
                {Object.entries(selectedNodeData.parameters).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: '#888' }}>{k}:</span>
                    <span>{v.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              {selectedNodeData.actions.map((action) => (
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
                    disabled={loading}
                    style={{
                      ...btnStyle,
                      width: '100%',
                      padding: '8px',
                      background: '#0f3460',
                      border: '1px solid #e94560',
                      color: '#e94560',
                    }}
                  >
                    {action.label}
                  </button>
                </div>
              ))}
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
                  <strong>{entry.node}</strong>: {entry.action}
                  {entry.value !== null && ` = ${entry.value.toFixed(1)}`}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#aaa' }}>
                  Результат: {entry.result}
                </div>
                {entry.chain.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>
                    Каскад: {entry.chain.map((c) => `${c.node}(${c.changed.join(',')})`).join(' → ')}
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

const btnStyle: React.CSSProperties = {
  padding: '6px 16px',
  background: '#0f3460',
  color: '#eee',
  border: '1px solid #333',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.9rem',
};
