import { useEffect, useState } from 'react';
import { Card } from '@consta/uikit/Card';
import { Text } from '@consta/uikit/Text';
import { Button } from '@consta/uikit/Button';
import { TextField } from '@consta/uikit/TextField';
import { Select } from '@consta/uikit/Select';
import { IconAdd } from '@consta/icons/IconAdd';
import { IconTrash } from '@consta/icons/IconTrash';
import { IconCheck } from '@consta/icons/IconCheck';
import { IconClose } from '@consta/icons/IconClose';
import { IconChatStroked } from '@consta/icons/IconChatStroked';
import { apiClient, type ScenarioDTO } from '../api/client';

interface PhaseEdit {
  id: string;
  title: string;
  expectedActions: { node: string; action: string; value: number | null }[];
}

interface InitialStateEdit {
  node: string;
  mode: string;
  parameters: { key: string; value: number }[];
}

interface ScenarioForm {
  name: string;
  timeoutSec: number;
  difficulty: number;
  passingScore: number;
  phases: PhaseEdit[];
  hints: { key: string; text: string }[];
  initialState: InitialStateEdit[];
}

const EMPTY_FORM: ScenarioForm = {
  name: '',
  timeoutSec: 1800,
  difficulty: 2,
  passingScore: 70,
  phases: [{ id: 'ph1', title: '', expectedActions: [] }],
  hints: [],
  initialState: [],
};

const NODE_OPTIONS = [
  { label: 'Н-82 (насос подачи)', value: 'feed_pump' },
  { label: 'А-19 (теплообменник)', value: 'preheater' },
  { label: 'Э-1 (электродегидратор)', value: 'dehydrator' },
  { label: 'Е-16 (ёмкость)', value: 'tank' },
  { label: 'Р-11 (регулятор)', value: 'regulator' },
  { label: 'Печь подогрева', value: 'furnace' },
  { label: 'Выходной поток', value: 'output' },
];

const ACTION_OPTIONS = [
  { label: 'Пуск', value: 'start' },
  { label: 'Остановка', value: 'stop' },
  { label: 'Установить мощность, %', value: 'set_power' },
  { label: 'Установить температуру, °C', value: 'set_temp' },
  { label: 'Положение клапана, %', value: 'set_valve' },
];

const PARAM_OPTIONS = [
  { label: 'Мощность, %', value: 'power_percent' },
  { label: 'Расход, м³/ч', value: 'flow_rate' },
  { label: 'Давление', value: 'pressure_out' },
  { label: 'Температура, °C', value: 'temperature' },
  { label: 'Вход. расход', value: 'inlet_flow' },
  { label: 'Вход. температура', value: 'inlet_temp' },
  { label: 'Содержание воды, %', value: 'water_content' },
  { label: 'Соли, мг/л', value: 'salt_mg_l' },
  { label: 'Уровень, %', value: 'level' },
  { label: 'Слив, м³/ч', value: 'drain_flow' },
  { label: 'Расход выход, м³/ч', value: 'outlet_flow' },
  { label: 'Положение клапана, %', value: 'valve_pos' },
];

const MODE_OPTIONS = [
  { label: 'Работает', value: 'RUNNING' },
  { label: 'Остановлен', value: 'STOPPED' },
];

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
  const [aiContext, setAiContext] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { setScenarios(await apiClient.listScenarios()); }
    catch (e: any) { setError(e.message); }
  };

  const startCreate = () => {
    setForm(EMPTY_FORM); setEditing(null); setShowForm(true); setValidationErrors([]); setAiContext('');
  };

  const startEdit = (sc: ScenarioDTO) => {
    setForm({
      name: sc.name, timeoutSec: sc.timeoutSec, difficulty: sc.difficulty, passingScore: sc.passingScore,
      phases: sc.phases.map(p => ({ id: p.id, title: p.title, expectedActions: p.expectedActions.map(a => ({ node: a.node, action: a.action, value: a.value })) })),
      hints: sc.bankHints?.map(h => ({ key: h.key, text: h.text })) || [],
      initialState: (sc.initialState || []).map(s => ({ node: s.node, mode: s.mode, parameters: Object.entries(s.parameters).map(([key, value]) => ({ key, value })) })),
    });
    setEditing(sc); setShowForm(true); setValidationErrors([]); setAiContext('');
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
        name: form.name, install: 'ELOU-AV', timeoutSec: form.timeoutSec, difficulty: form.difficulty, passingScore: form.passingScore,
        phases: form.phases, hints: form.hints,
        initialState: form.initialState.map(s => ({ node: s.node, mode: s.mode, parameters: Object.fromEntries(s.parameters.map(p => [p.key, p.value])) })),
      };
      if (editing) await apiClient.updateScenario(editing.id, req);
      else await apiClient.createScenario(req);
      setShowForm(false); await load();
    } catch (e: any) {
      setValidationErrors([e?.response?.data?.message || e.message]);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить сценарий?')) return;
    try { await apiClient.deleteScenario(id); await load(); }
    catch (e: any) { setError(e.message); }
  };

  const handleAiDraft = async () => {
    setAiLoading(true);
    try {
      const res = await apiClient.generateScenarioDraft({ topic: form.name || 'Пуск установки', difficulty: form.difficulty, timeoutSec: form.timeoutSec, context: aiContext || undefined });
      if (res.error) { setValidationErrors([`МадИИна: ${res.error}`]); if (res.rawText) setAiRawText(res.rawText); }
      else if (res.scenario) setAiDraft(res.scenario);
    } catch (e: any) { setValidationErrors([`ИИ недоступно: ${e.message}`]); }
    setAiLoading(false);
  };

  const applyAiDraft = () => {
    if (!aiDraft) return;
    setForm({
      name: aiDraft.name || form.name, timeoutSec: aiDraft.timeoutSec || form.timeoutSec, difficulty: aiDraft.difficulty || form.difficulty, passingScore: form.passingScore,
      phases: (aiDraft.phases || []).map((p: any) => ({ id: p.id, title: p.title, expectedActions: (p.expectedActions || []).map((a: any) => ({ node: a.node, action: a.action, value: a.value ?? null })) })),
      hints: (aiDraft.hints || []).map((h: any) => ({ key: h.key, text: h.text })),
      initialState: (aiDraft.initialState || []).map((s: any) => ({ node: s.node, mode: s.mode || 'RUNNING', parameters: Object.entries(s.parameters || {}).map(([key, value]) => ({ key, value: value as number })) })),
    });
    setAiDraft(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <Text as="h2" size="xl" weight="bold" style={{ margin: 0, marginBottom: 4 }}>Панель методиста</Text>
        <Text as="p" size="m" view="ghost">Управление сценариями обучения</Text>
      </div>

      {error && (
        <Card verticalSpace="s" horizontalSpace="m" style={{ background: '#fff1f0', borderColor: '#ffa39e' }}>
          <Text view="alert">{error}</Text>
        </Card>
      )}

      {!showForm && (
        <>
          <Button label="Создать сценарий" view="primary" iconLeft={IconAdd} onClick={startCreate} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card col={1} verticalSpace="l" horizontalSpace="l">
              <Text as="h3" size="l" weight="semibold" style={{ marginBottom: 12 }}>Сценарии ({scenarios.length})</Text>
              {scenarios.map((sc) => (
                <Card key={sc.id} verticalSpace="m" horizontalSpace="m" style={{ marginBottom: 8, background: '#f5f5f5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <Text size="m" weight="semibold">{sc.name}</Text>
                      <Text size="s" view="ghost">Сложность: {sc.difficulty}/3 | Фаз: {sc.phases.length} | Время: {sc.timeoutSec / 60} мин</Text>
                      <Text size="xs" view="ghost">{sc.phases.map(p => p.title).join(' → ')}</Text>
                      {sc.initialState && sc.initialState.length > 0 && (
                        <Text size="xs" style={{ color: '#722ed1' }}>⚡ Старт с {sc.initialState.length} работающими узлами</Text>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Button label="Изменить" size="xs" view="ghost" onClick={() => startEdit(sc)} />
                      <Button label="Удалить" size="xs" view="ghost" iconLeft={IconTrash} onClick={() => handleDelete(sc.id)} />
                    </div>
                  </div>
                </Card>
              ))}
            </Card>
            <Card col={1} verticalSpace="l" horizontalSpace="l">
              <Text as="h3" size="l" weight="semibold" style={{ marginBottom: 12 }}>🤖 ИИ-инструменты</Text>
              <Card verticalSpace="m" horizontalSpace="m" style={{ background: '#f9f0ff', borderColor: '#d3adf3' }}>
                <Text size="m" weight="semibold" style={{ color: '#722ed1', marginBottom: 8 }}>🤖 Генерация черновика сценария</Text>
                <Text size="s" view="ghost" style={{ marginBottom: 8 }}>
                  ИИ создаст черновик сценария. Можно задать контекст - например, «начни с фазы нагрева, насос уже работает на 80%».
                </Text>
                <Button label="Создать с помощью МадИИны" size="s" view="primary" iconLeft={IconChatStroked} onClick={startCreate} />
              </Card>
            </Card>
          </div>
        </>
      )}

      {showForm && (
        <Card col={1} verticalSpace="l" horizontalSpace="l">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text as="h3" size="l" weight="semibold">{editing ? 'Редактирование сценария' : 'Новый сценарий'}</Text>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button label={aiLoading ? 'МадИИна генерирует...' : '🤖 МадИИна-черновик'} size="s" view="primary" iconLeft={IconChatStroked} loading={aiLoading} onClick={handleAiDraft} />
              <Button label="Сохранить" size="s" view="primary" iconLeft={IconCheck} onClick={handleSave} />
              <Button label="Отмена" size="s" view="ghost" iconLeft={IconClose} onClick={() => setShowForm(false)} />
            </div>
          </div>

          {aiDraft && (
            <Card verticalSpace="m" horizontalSpace="m" style={{ marginBottom: 16, background: '#f9f0ff', borderColor: '#d3adf3' }}>
              <Text size="m" weight="semibold" style={{ color: '#722ed1', marginBottom: 8 }}>🤖 МадИИна-черновик готов</Text>
              <Text size="s" view="ghost">Имя: {aiDraft.name}, Фаз: {aiDraft.phases?.length}</Text>
              {aiDraft.initialState?.length > 0 && (
                <Text size="s" view="ghost">Начальное состояние: {aiDraft.initialState.length} узлов уже работают</Text>
              )}
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <Button label="Применить" size="xs" view="primary" onClick={applyAiDraft} />
                <Button label="Отклонить" size="xs" view="ghost" onClick={() => setAiDraft(null)} />
              </div>
            </Card>
          )}

          {aiRawText && (
            <Card verticalSpace="m" horizontalSpace="m" style={{ marginBottom: 16, background: '#f9f0ff', borderColor: '#d3adf3' }}>
              <Text size="m" weight="semibold" style={{ color: '#722ed1', marginBottom: 8 }}>🤖 МадИИна (не удалось разобрать JSON)</Text>
              <pre style={{ fontSize: '0.8rem', maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap', margin: 0, color: '#888' }}>
                {aiRawText}
              </pre>
              <Button label="Закрыть" size="xs" view="ghost" style={{ marginTop: 8 }} onClick={() => setAiRawText(null)} />
            </Card>
          )}

          {validationErrors.length > 0 && (
            <Card verticalSpace="s" horizontalSpace="m" style={{ marginBottom: 16, background: '#fff1f0', borderColor: '#ffa39e' }}>
              {validationErrors.map((e, i) => <Text key={i} size="s" view="alert">• {e}</Text>)}
            </Card>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <TextField label="Название" value={form.name} onChange={(value) => setForm({ ...form, name: value || '' })} />
            <TextField label="Таймаут, сек" type="number" value={String(form.timeoutSec)} onChange={(value) => setForm({ ...form, timeoutSec: Number(value) || 0 })} />
            <TextField label="Сложность (1-3)" type="number" value={String(form.difficulty)} onChange={(value) => setForm({ ...form, difficulty: Math.max(1, Math.min(3, Number(value) || 2)) })} />
            <TextField label="Проходной балл" type="number" value={String(form.passingScore)} onChange={(value) => setForm({ ...form, passingScore: Math.max(0, Math.min(100, Number(value) || 0)) })} />
          </div>

          {/* AI Context */}
          <Card verticalSpace="m" horizontalSpace="m" style={{ marginBottom: 16, background: '#f9f0ff', borderColor: '#d3adf3' }}>
            <Text size="m" weight="semibold" style={{ color: '#722ed1', marginBottom: 4 }}>🤖 Контекст для МадИИны</Text>
            <Text size="s" view="ghost" style={{ marginBottom: 8 }}>
              Опишите желаемый сценарий. Например: «начни с фазы нагрева, насос уже работает на 80%, температура 120°C».
              ИИ создаст сценарий с заданного этапа и предустановленным состоянием узлов.
            </Text>
            <textarea
              value={aiContext}
              onChange={(e) => setAiContext(e.target.value)}
              placeholder="Например: насос Н-82 уже запущен на мощности 80%, теплообменник нагрет до 120°C. Начни сценарий с фазы включения дегидратора."
              style={{ width: '100%', minHeight: 70, padding: 8, borderRadius: 4, border: '1px solid #d3adf3', fontFamily: 'inherit', fontSize: '0.875rem', resize: 'vertical' }}
            />
          </Card>

          {/* Initial State */}
          <Text as="h4" size="m" weight="semibold" style={{ color: '#1677ff', marginBottom: 8 }}>Начальное состояние узлов</Text>
          <Text as="p" size="s" view="ghost" style={{ marginTop: 0, marginBottom: 8 }}>
            Узлы, которые уже работают с заданными параметрами на момент начала сценария. Студент начинает не с холодного старта.
          </Text>
          {form.initialState.map((s, si) => (
            <Card key={si} verticalSpace="s" horizontalSpace="m" style={{ marginBottom: 8, background: '#f5f5f5' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <Select
                  items={NODE_OPTIONS}
                  value={NODE_OPTIONS.find(o => o.value === s.node) || null}
                  onChange={(value) => { const is = [...form.initialState]; is[si] = { ...s, node: value?.value || '' }; setForm({ ...form, initialState: is }); }}
                  getItemKey={(item) => item.value}
                  getItemLabel={(item) => item.label}
                  placeholder="Узел"
                  style={{ width: 200 }}
                />
                <Select
                  items={MODE_OPTIONS}
                  value={MODE_OPTIONS.find(o => o.value === s.mode) || null}
                  onChange={(value) => { const is = [...form.initialState]; is[si] = { ...s, mode: value?.value || 'RUNNING' }; setForm({ ...form, initialState: is }); }}
                  getItemKey={(item) => item.value}
                  getItemLabel={(item) => item.label}
                  placeholder="Режим"
                  style={{ width: 150 }}
                />
                <Button label="Удалить" size="xs" view="ghost" iconLeft={IconTrash} onClick={() => setForm({ ...form, initialState: form.initialState.filter((_, i) => i !== si) })} />
              </div>
              {s.parameters.map((p, pi) => (
                <div key={pi} style={{ display: 'flex', gap: 8, marginBottom: 4, paddingLeft: 16 }}>
                  <Select
                    items={PARAM_OPTIONS}
                    value={PARAM_OPTIONS.find(o => o.value === p.key) || null}
                    onChange={(value) => { const is = [...form.initialState]; is[si].parameters[pi] = { ...p, key: value?.value || '' }; setForm({ ...form, initialState: is }); }}
                    getItemKey={(item) => item.value}
                    getItemLabel={(item) => item.label}
                    placeholder="Параметр"
                    style={{ flex: 1 }}
                  />
                  <TextField type="number" value={String(p.value)} placeholder="Значение" onChange={(value) => { const is = [...form.initialState]; is[si].parameters[pi] = { ...p, value: Number(value) || 0 }; setForm({ ...form, initialState: is }); }} style={{ width: 120 }} />
                  <Button label="" size="xs" view="ghost" iconLeft={IconClose} onClick={() => { const is = [...form.initialState]; is[si].parameters = is[si].parameters.filter((_, i) => i !== pi); setForm({ ...form, initialState: is }); }} />
                </div>
              ))}
              <Button label="+ Параметр" size="xs" view="ghost" iconLeft={IconAdd} onClick={() => { const is = [...form.initialState]; is[si].parameters.push({ key: '', value: 0 }); setForm({ ...form, initialState: is }); }} />
            </Card>
          ))}
          <Button label="+ Узел в начальное состояние" size="s" view="ghost" iconLeft={IconAdd} style={{ marginBottom: 16 }} onClick={() => setForm(f => ({ ...f, initialState: [...f.initialState, { node: '', mode: 'RUNNING', parameters: [] }] }))} />

          <Text as="h4" size="m" weight="semibold" style={{ color: '#1677ff', marginBottom: 8 }}>Фазы сценария</Text>
          {form.phases.map((ph, pi) => (
            <Card key={pi} verticalSpace="m" horizontalSpace="m" style={{ marginBottom: 8, background: '#f5f5f5' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <TextField value={ph.id} placeholder="ID фазы" onChange={(value) => { const phases = [...form.phases]; phases[pi] = { ...ph, id: value || '' }; setForm({ ...form, phases }); }} style={{ width: 120 }} />
                <TextField value={ph.title} placeholder="Название фазы" onChange={(value) => { const phases = [...form.phases]; phases[pi] = { ...ph, title: value || '' }; setForm({ ...form, phases }); }} style={{ flex: 1 }} />
                <Button label="Удалить" size="xs" view="ghost" iconLeft={IconTrash} onClick={() => setForm({ ...form, phases: form.phases.filter((_, i) => i !== pi) })} />
              </div>
              {ph.expectedActions.map((a, ai) => (
                <div key={ai} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <Select
                    items={NODE_OPTIONS}
                    value={NODE_OPTIONS.find(o => o.value === a.node) || null}
                    onChange={(value) => { const phases = [...form.phases]; phases[pi].expectedActions[ai] = { ...a, node: value?.value || '' }; setForm({ ...form, phases }); }}
                    getItemKey={(item) => item.value}
                    getItemLabel={(item) => item.label}
                    placeholder="Узел"
                    style={{ width: 180 }}
                  />
                  <Select
                    items={ACTION_OPTIONS}
                    value={ACTION_OPTIONS.find(o => o.value === a.action) || null}
                    onChange={(value) => { const phases = [...form.phases]; phases[pi].expectedActions[ai] = { ...a, action: value?.value || '' }; setForm({ ...form, phases }); }}
                    getItemKey={(item) => item.value}
                    getItemLabel={(item) => item.label}
                    placeholder="Действие"
                    style={{ width: 200 }}
                  />
                  <TextField type="number" value={a.value != null ? String(a.value) : ''} placeholder="Значение" onChange={(value) => { const phases = [...form.phases]; phases[pi].expectedActions[ai] = { ...a, value: value != null && value !== '' ? Number(value) : null }; setForm({ ...form, phases }); }} style={{ width: 120 }} />
                  <Button label="" size="xs" view="ghost" iconLeft={IconClose} onClick={() => { const phases = [...form.phases]; phases[pi].expectedActions = phases[pi].expectedActions.filter((_, i) => i !== ai); setForm({ ...form, phases }); }} />
                </div>
              ))}
              <Button label="+ Действие" size="xs" view="ghost" iconLeft={IconAdd} onClick={() => { const phases = [...form.phases]; phases[pi].expectedActions.push({ node: '', action: '', value: null }); setForm({ ...form, phases }); }} />
            </Card>
          ))}
          <Button label="+ Фаза" size="s" view="ghost" iconLeft={IconAdd} style={{ marginBottom: 16 }} onClick={() => setForm(f => ({ ...f, phases: [...f.phases, { id: `ph${f.phases.length + 1}`, title: '', expectedActions: [] }] }))} />

          <Text as="h4" size="m" weight="semibold" style={{ color: '#1677ff', marginBottom: 8 }}>Подсказки</Text>
          {form.hints.map((h, hi) => (
            <div key={hi} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <TextField value={h.key} placeholder="Ключ (ID фазы)" onChange={(value) => { const hints = [...form.hints]; hints[hi] = { ...h, key: value || '' }; setForm({ ...form, hints }); }} style={{ width: 150 }} />
              <TextField value={h.text} placeholder="Текст подсказки" onChange={(value) => { const hints = [...form.hints]; hints[hi] = { ...h, text: value || '' }; setForm({ ...form, hints }); }} style={{ flex: 1 }} />
              <Button label="" size="xs" view="ghost" iconLeft={IconClose} onClick={() => setForm({ ...form, hints: form.hints.filter((_, i) => i !== hi) })} />
            </div>
          ))}
          <Button label="+ Подсказка" size="s" view="ghost" iconLeft={IconAdd} onClick={() => { const lastPhase = form.phases[form.phases.length - 1]; setForm(f => ({ ...f, hints: [...f.hints, { key: lastPhase?.id || 'ph1', text: '' }] })) }} />
        </Card>
      )}
    </div>
  );
}
