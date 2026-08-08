import { create } from 'zustand';
import { apiClient, type GraphDTO, type SessionDTO, type ScenarioDTO } from '../api/client';

interface JournalEntry {
  timestamp: number;
  node: string;
  action: string;
  value: number | null;
  result: string;
  chain: { node: string; changed: string[] }[];
}

interface SimState {
  graph: GraphDTO | null;
  scenarios: ScenarioDTO[];
  currentScenario: ScenarioDTO | null;
  session: SessionDTO | null;
  journal: JournalEntry[];
  loading: boolean;
  error: string | null;

  loadGraph: () => Promise<void>;
  loadScenarios: () => Promise<void>;
  selectScenario: (id: string) => Promise<void>;
  startSession: (scenarioId: string) => Promise<void>;
  applyAction: (node: string, action: string, value?: number) => Promise<void>;
  endSession: () => Promise<void>;
  clearError: () => void;
}

export const useSimStore = create<SimState>((set, get) => ({
  graph: null,
  scenarios: [],
  currentScenario: null,
  session: null,
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

  startSession: async (scenarioId: string) => {
    set({ loading: true, error: null, journal: [] });
    try {
      const graph = await apiClient.getGraph();
      const session = await apiClient.startSession(scenarioId);
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
        graph,
        loading: false,
        journal: [
          ...state.journal,
          {
            timestamp: Date.now(),
            node: step.node,
            action: step.action,
            value: step.value,
            result: step.validationResult,
            chain: step.chain,
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
      set({ session: null, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
