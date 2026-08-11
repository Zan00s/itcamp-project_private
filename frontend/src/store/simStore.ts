import { create } from 'zustand';
import { apiClient, type GraphDTO, type SessionDTO, type ScenarioDTO } from '../api/client';

export type SessionMode = 'training' | 'exam';

interface JournalEntry {
  timestamp: number;
  node: string;
  action: string;
  value: number | null;
  result: string;
  chain: { node: string; changed: string[] }[];
  eventType?: string;
  isAuto?: boolean;
}

interface SimState {
  graph: GraphDTO | null;
  scenarios: ScenarioDTO[];
  currentScenario: ScenarioDTO | null;
  session: SessionDTO | null;
  mode: SessionMode;
  journal: JournalEntry[];
  loading: boolean;
  error: string | null;

  loadGraph: () => Promise<void>;
  loadScenarios: () => Promise<void>;
  selectScenario: (id: string) => Promise<void>;
  startSession: (scenarioId: string, mode: SessionMode) => Promise<void>;
  applyAction: (node: string, action: string, value?: number) => Promise<void>;
  endSession: () => Promise<void>;
  resetForNewAttempt: () => void;
  clearError: () => void;
  pollEvents: () => Promise<void>;
}

export const useSimStore = create<SimState>((set, get) => ({
  graph: null,
  scenarios: [],
  currentScenario: null,
  session: null,
  mode: 'training',
  journal: [],
  loading: false,
  error: null,

  loadGraph: async () => {
    set({ loading: true, error: null });
    try {
      const graph = await apiClient.getGraph();
      set({ graph, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  loadScenarios: async () => {
    set({ loading: true, error: null });
    try {
      const scenarios = await apiClient.listScenarios();
      set({ scenarios, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  selectScenario: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const scenario = await apiClient.getScenario(id);
      set({ currentScenario: scenario, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  startSession: async (scenarioId: string, mode: SessionMode) => {
    set({ loading: true, error: null, journal: [], session: null, mode });
    try {
      const session = await apiClient.startSession(scenarioId);
      const graph = await apiClient.getSessionState(session.id);
      set({ graph, session, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  applyAction: async (node: string, action: string, value?: number) => {
    const { session } = get();
    if (!session) return;
    set({ loading: true, error: null });
    try {
      const step = await apiClient.applyAction(session.id, { node, action, value });
      const graph = await apiClient.getSessionState(session.id);

      set((state) => ({
        graph: graph && graph.nodes ? graph : state.graph,
        loading: false,
        journal: [
          ...state.journal,
          {
            timestamp: Date.now(),
            node: step.node,
            action: step.action,
            value: step.value,
            result: step.validationResult,
            chain: step.chain || [],
          },
        ],
      }));
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  endSession: async () => {
    const { session } = get();
    if (!session) return;
    set({ loading: true, error: null });
    try {
      await apiClient.endSession(session.id);
      set({ session: null, journal: [], loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  resetForNewAttempt: () => {
    set({ session: null, journal: [], error: null });
  },

  clearError: () => set({ error: null }),

  pollEvents: async () => {
    const { session } = get();
    if (!session) return;
    try {
      const events = await apiClient.getSessionEvents(session.id);
      if (!events || events.length === 0) return;
      set((state) => {
        const knownTimestamps = new Set(state.journal.filter(j => j.isAuto).map(j => j.timestamp));
        const newEvents: JournalEntry[] = events
          .filter(e => !knownTimestamps.has(e.timestamp))
          .map(e => ({
            timestamp: e.timestamp,
            node: e.node,
            action: e.action,
            value: e.value,
            result: e.result || 'Alarm',
            chain: [],
            eventType: e.eventType,
            isAuto: true,
          }));
        if (newEvents.length === 0) return {};
        return { journal: [...state.journal, ...newEvents].sort((a, b) => a.timestamp - b.timestamp) };
      });
    } catch {
      // ignore polling errors
    }
  },
}));
