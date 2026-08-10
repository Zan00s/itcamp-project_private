import { useEffect, useState } from 'react';
import { apiClient, type ScenarioDTO } from '../api/client';

interface PhaseEdit {
  id: string;
  title: string;
  expectedActions: { node: string; action: string; value: number | null }[];
}

interface ScenarioForm {
  name: string;
  timeoutSec: number;
  difficulty: number;
  passingScore: number;
  phases: PhaseEdit[];
  hints: { key: string; text: string }[];
}

const EMPTY_FORM: ScenarioForm = {
  name: '',
  timeoutSec: 1800,
  difficulty: 2,
  passingScore: 70,
  phases: [
    { id: 'ph1', title: '', expectedActions: [] },
  ],
  hints: [],
};

export default function MethodistPanel() {
  const [scenarios, setScenarios] = useState<ScenarioDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ScenarioDTO | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ScenarioForm>(EMPTY_FORM);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [aiDraft, setAiDraft] = useState<any>(null);
  const [aiRawText, setAiRawText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setScenarios(await apiClient.listScenarios());
    } catch (e: any) {
      setError(e.message);
    }
  };

  const startCreate = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setShowForm(true);
    setValidationErrors([]);
  };

  const startEdit = (sc: ScenarioDTO) => {
    setForm({
      name: sc.name,
      timeoutSec: sc.timeoutSec,
      difficulty: sc.difficulty,
      passingScore: sc.passingScore,
      phases: sc.phases.map(p => ({
        id: p.id,
        title: p.title,
        expectedActions: p.expectedActions.map(a => ({ node: a.node, action: a.action, value: a.value })),
      })),
      hints: sc.bankHints?.map(h => ({ key: h.key, text: h.text })) || [],
    });
    setEditing(sc);
    setShowForm(true);
    setValidationErrors([]);
  };

  const validateForm = (): boolean => {
    const errs: string[] = [];
    if (!form.name.trim()) errs.push('Имя сценария обязательно');
    if (form.timeoutSec <= 0) errs.push('Таймаут должен быть положительным');
    if (form.difficulty < 1 || form.difficulty > 3) errs.push('Сложность от 1 до 3');
    if (form.passingScore < 0 || form.passingScore > 100) errs.push('Проходной балл от 0 до 100');
    if (form.phases.length === 0) errs.push('Нужна хотя бы одна фаза');
    form.phases.forEach((ph, i) => {
      if (!ph.title.trim()) errs.push(`Фаза ${i + 1}: название обязательно`);
      if (ph.expectedActions.length === 0) errs.push(`Фаза ${i + 1}: нужно хотя бы одно действие`);
      ph.expectedActions.forEach((a, j) => {
        if (!a.node.trim()) errs.push(`Фаза ${i + 1}, действие ${j + 1}: узел обязателен`);
        if (!a.action.trim()) errs.push(`Фаза ${i + 1}, действие ${j + 1}: действие обязательно`);
      });
    });
    setValidationErrors(errs);
    return errs.length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    try {
      const req = {
        name: form.name,
        install: 'ELOU-AV',
        timeoutSec: form.timeoutSec,
        difficulty: form.difficulty,
        passingScore: form.passingScore,
        phases: form.phases,
        hints: form.hints,
      };
      if (editing) {
        await apiClient.updateScenario(editing.id, req);
      } else {
        await apiClient.createScenario(req);
      }
      setShowForm(false);
      await load();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e.message;
      setValidationErrors([msg]);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить сценарий?')) return;
    try {
      await apiClient.deleteScenario(id);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleAiDraft = async () => {
    setAiLoading(true);
    try {
      const res = await apiClient.generateScenarioDraft({
        topic: form.name || 'Пуск установки',
        difficulty: form.difficulty,
        timeoutSec: form.timeoutSec,
      });
      if (res.error) {
        setValidationErrors([`МадИИна: ${res.error}`]);
        if (res.rawText) setAiRawText(res.rawText);
      } else if (res.scenario) {
        setAiDraft(res.scenario);
      }
    } catch (e: any) {
      setValidationErrors([`ИИ недоступно: ${e.message}`]);
    }
    setAiLoading(false);
  };

  const applyAiDraft = () => {
    if (!aiDraft) return;
    setForm({
      name: aiDraft.name || form.name,
      timeoutSec: aiDraft.timeoutSec || form.timeoutSec,
      difficulty: aiDraft.difficulty || form.difficulty,
      passingScore: form.passingScore,
      phases: (aiDraft.phases || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        expectedActions: (p.expectedActions || []).map((a: any) => ({
          node: a.node,
          action: a.action,
          value: a.value ?? null,
        })),
      })),
      hints: (aiDraft.hints || []).map((h: any) => ({ key: h.key, text: h.text })),
    });
    setAiDraft(null);
  };

  const addPhase = () => {
    setForm(f => ({
      ...f,
      phases: [...f.phases, { id: `ph${f.phases.length + 1}`, title: '', expectedActions: [] }],
    }));
  };

  const addHint = () => {
    const lastPhase = form.phases[form.phases.length - 1];
    setForm(f => ({
      ...f,
      hints: [...f.hints, { key: lastPhase?.id || 'ph1', text: '' }],
    }));
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Панель методиста</h2>
      <p style={{ color: '#aaa' }}>Управление сценариями обучения</p>

      {error && <div style={errorStyle}>{error}</div>}

      {!showForm && (
        <>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <button onClick={startCreate} style={{ ...btnStyle, background: '#1b5e20', border: '1px solid #4caf50', color: '#a5d6a7' }}>
              Создать сценарий
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={{ background: '#16213e', borderRadius: '12px', padding: '1.5rem' }}>
              <h3>Сценарии ({scenarios.length})</h3>
              {scenarios.map((sc) => (
                <div key={sc.id} style={{ padding: '12px', background: '#0f0f1e', borderRadius: '8px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{sc.name}</strong>
                      <div style={{ color: '#aaa', fontSize: '0.85rem' }}>
                        Сложность: {sc.difficulty}/3 | Фаз: {sc.phases.length} | Время: {sc.timeoutSec / 60} мин
                      </div>
                      <div style={{ color: '#666', fontSize: '0.8rem' }}>
                        {sc.phases.map(p => p.title).join(' → ')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => startEdit(sc)} style={{ ...btnStyle, padding: '4px 10px', fontSize: '0.8rem' }}>Изменить</button>
                      <button onClick={() => handleDelete(sc.id)} style={{ ...btnStyle, padding: '4px 10px', fontSize: '0.8rem', background: '#b71c1c', border: '1px solid #f44336', color: '#ef9a9a' }}>Удалить</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: '#16213e', borderRadius: '12px', padding: '1.5rem' }}>
              <h3>ИИ-инструменты</h3>
              <div style={{ padding: '12px', background: '#0f0f1e', borderRadius: '8px', marginBottom: '8px' }}>
                <h4 style={{ margin: '0 0 8px', color: '#b39ddb' }}>🤖 Генерация черновика сценария</h4>
                <p style={{ color: '#666', fontSize: '0.85rem', margin: '0 0 8px' }}>
                  ИИ создаст черновик сценария на основе темы. Потребуется проверка перед сохранением.
                </p>
                <button onClick={() => { startCreate(); }} style={{ ...btnStyle, background: '#4a148c', border: '1px solid #b39ddb', color: '#b39ddb' }}>
                  Начать с черновика от МадИИны
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showForm && (
        <div style={{ background: '#16213e', borderRadius: '12px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>{editing ? 'Редактирование сценария' : 'Новый сценарий'}</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleAiDraft} disabled={aiLoading} style={{ ...btnStyle, background: '#4a148c', border: '1px solid #b39ddb', color: '#b39ddb' }}>
                {aiLoading ? 'МадИИна генерирует...' : '🤖 МадИИна-черновик'}
              </button>
              <button onClick={handleSave} style={{ ...btnStyle, background: '#1b5e20', border: '1px solid #4caf50', color: '#a5d6a7' }}>
                Сохранить
              </button>
              <button onClick={() => setShowForm(false)} style={btnStyle}>Отмена</button>
            </div>
          </div>

          {aiDraft && (
            <div style={{ padding: '12px', background: '#2d1b4e', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #b39ddb' }}>
              <div style={{ color: '#b39ddb', fontWeight: 'bold', marginBottom: '8px' }}>🤖 МадИИна-черновик готов</div>
              <p style={{ color: '#aaa', fontSize: '0.85rem' }}>Имя: {aiDraft.name}, Фаз: {aiDraft.phases?.length}</p>
              <button onClick={applyAiDraft} style={{ ...btnStyle, background: '#4a148c', border: '1px solid #b39ddb', color: '#b39ddb' }}>
                Применить черновик
              </button>
              <button onClick={() => setAiDraft(null)} style={{ ...btnStyle, marginLeft: '4px' }}>Отклонить</button>
            </div>
          )}

          {aiRawText && (
            <div style={{ padding: '12px', background: '#2d1b4e', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #b39ddb' }}>
              <div style={{ color: '#b39ddb', fontWeight: 'bold', marginBottom: '8px' }}>🤖 МадИИна (не удалось разобрать JSON)</div>
              <pre style={{ color: '#aaa', fontSize: '0.8rem', maxHeight: '300px', overflow: 'auto', whiteSpace: 'pre-wrap', margin: 0 }}>
                {aiRawText}
              </pre>
              <button onClick={() => setAiRawText(null)} style={{ ...btnStyle, marginTop: '8px' }}>Закрыть</button>
            </div>
          )}

          {validationErrors.length > 0 && (
            <div style={{ background: '#b71c1c', padding: '10px', borderRadius: '8px', marginBottom: '1rem' }}>
              {validationErrors.map((e, i) => <div key={i} style={{ color: '#ef9a9a', fontSize: '0.85rem' }}>• {e}</div>)}
            </div>
          )}

          {/* Basic fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ color: '#888', fontSize: '0.85rem' }}>Название</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={{ color: '#888', fontSize: '0.85rem' }}>Таймаут, сек</label>
              <input type="number" value={form.timeoutSec} onChange={e => setForm({ ...form, timeoutSec: +e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={{ color: '#888', fontSize: '0.85rem' }}>Сложность (1-3)</label>
              <input type="number" min="1" max="3" value={form.difficulty} onChange={e => setForm({ ...form, difficulty: +e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={{ color: '#888', fontSize: '0.85rem' }}>Проходной балл</label>
              <input type="number" min="0" max="100" value={form.passingScore} onChange={e => setForm({ ...form, passingScore: +e.target.value })} style={inputStyle} />
            </div>
          </div>

          {/* Phases */}
          <h4 style={{ color: '#e94560' }}>Фазы сценария</h4>
          {form.phases.map((ph, pi) => (
            <div key={pi} style={{ padding: '12px', background: '#0f0f1e', borderRadius: '8px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '8px' }}>
                <input
                  placeholder="ID фазы"
                  value={ph.id}
                  onChange={e => {
                    const phases = [...form.phases];
                    phases[pi] = { ...ph, id: e.target.value };
                    setForm({ ...form, phases });
                  }}
                  style={{ ...inputStyle, width: '100px' }}
                />
                <input
                  placeholder="Название фазы"
                  value={ph.title}
                  onChange={e => {
                    const phases = [...form.phases];
                    phases[pi] = { ...ph, title: e.target.value };
                    setForm({ ...form, phases });
                  }}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  onClick={() => setForm({ ...form, phases: form.phases.filter((_, i) => i !== pi) })}
                  style={{ ...btnStyle, background: '#b71c1c', border: '1px solid #f44336', color: '#ef9a9a', padding: '4px 10px' }}
                >Удалить</button>
              </div>
              {ph.expectedActions.map((a, ai) => (
                <div key={ai} style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                  <select
                    value={a.node}
                    onChange={e => {
                      const phases = [...form.phases];
                      phases[pi].expectedActions[ai] = { ...a, node: e.target.value };
                      setForm({ ...form, phases });
                    }}
                    style={{ ...inputStyle, width: '170px' }}
                  >
                    <option value="">— узел —</option>
                    <option value="feed_pump">Н-82 (насос подачи)</option>
                    <option value="preheater">А-19 (теплообменник)</option>
                    <option value="dehydrator">Э-1 (электродегидратор)</option>
                    <option value="tank">Е-16 (ёмкость)</option>
                    <option value="regulator">Р-11 (регулятор)</option>
                    <option value="furnace">Печь подогрева</option>
                    <option value="output">Выходной поток</option>
                  </select>
                  <select
                    value={a.action}
                    onChange={e => {
                      const phases = [...form.phases];
                      phases[pi].expectedActions[ai] = { ...a, action: e.target.value };
                      setForm({ ...form, phases });
                    }}
                    style={{ ...inputStyle, width: '160px' }}
                  >
                    <option value="">— действие —</option>
                    <option value="start">Пуск</option>
                    <option value="stop">Остановка</option>
                    <option value="set_power">Установить мощность, %</option>
                    <option value="set_temp">Установить температуру, °C</option>
                    <option value="set_valve">Положение клапана, %</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Значение"
                    value={a.value ?? ''}
                    onChange={e => {
                      const phases = [...form.phases];
                      phases[pi].expectedActions[ai] = { ...a, value: e.target.value ? +e.target.value : null };
                      setForm({ ...form, phases });
                    }}
                    style={{ ...inputStyle, width: '100px' }}
                  />
                  <button
                    onClick={() => {
                      const phases = [...form.phases];
                      phases[pi].expectedActions = phases[pi].expectedActions.filter((_, i) => i !== ai);
                      setForm({ ...form, phases });
                    }}
                    style={{ ...btnStyle, padding: '4px 8px', fontSize: '0.8rem' }}
                  >×</button>
                </div>
              ))}
              <button
                onClick={() => {
                  const phases = [...form.phases];
                  phases[pi].expectedActions.push({ node: '', action: '', value: null });
                  setForm({ ...form, phases });
                }}
                style={{ ...btnStyle, padding: '4px 10px', fontSize: '0.8rem', marginTop: '4px' }}
              >+ Действие</button>
            </div>
          ))}
          <button onClick={addPhase} style={{ ...btnStyle, marginBottom: '1rem' }}>+ Фаза</button>

          {/* Hints */}
          <h4 style={{ color: '#e94560' }}>Подсказки</h4>
          {form.hints.map((h, hi) => (
            <div key={hi} style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
              <input
                placeholder="Ключ (ID фазы)"
                value={h.key}
                onChange={e => {
                  const hints = [...form.hints];
                  hints[hi] = { ...h, key: e.target.value };
                  setForm({ ...form, hints });
                }}
                style={{ ...inputStyle, width: '120px' }}
              />
              <input
                placeholder="Текст подсказки"
                value={h.text}
                onChange={e => {
                  const hints = [...form.hints];
                  hints[hi] = { ...h, text: e.target.value };
                  setForm({ ...form, hints });
                }}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={() => setForm({ ...form, hints: form.hints.filter((_, i) => i !== hi) })}
                style={{ ...btnStyle, padding: '4px 8px', fontSize: '0.8rem' }}
              >×</button>
            </div>
          ))}
          <button onClick={addHint} style={btnStyle}>+ Подсказка</button>
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = { padding: '6px 16px', background: '#0f3460', color: '#eee', border: '1px solid #333', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' };
const inputStyle: React.CSSProperties = { padding: '6px 8px', background: '#0f0f1e', border: '1px solid #333', borderRadius: '4px', color: '#eee', boxSizing: 'border-box' };
const errorStyle: React.CSSProperties = { background: '#f44336', color: '#fff', padding: '10px 20px', borderRadius: '8px', marginBottom: '1rem' };
