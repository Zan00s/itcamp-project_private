import axios from 'axios';
import { getUserManager } from '../auth/oidc';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  try {
    const user = await getUserManager().getUser();
    if (user?.access_token) {
      config.headers['Authorization'] = `Bearer ${user.access_token}`;
    }
    if (user?.profile?.preferred_username) {
      config.headers['X-User-Id'] = user.profile.preferred_username;
    }
  } catch {
    // ignore
  }
  return config;
});

export interface NodeDTO {
  id: string;
  type: string;
  name: string;
  mode: string;
  parameters: Record<string, number>;
  paramLabels: Record<string, string>;
  actions: ActionDTO[];
  inputs: string[];
  outputs: string[];
}

export interface ActionDTO {
  id: string;
  label: string;
  param: string | null;
  min: number | null;
  max: number | null;
}

export interface EdgeDTO {
  id: string;
  from: string;
  to: string;
  fromPort: string;
  toPort: string;
  type: string;
}

export interface GraphDTO {
  nodes: NodeDTO[];
  edges: EdgeDTO[];
}

export interface ScenarioDTO {
  id: string;
  name: string;
  install: string;
  timeoutSec: number;
  difficulty: number;
  phases: PhaseDTO[];
  passingScore: number;
  bankHints?: { key: string; text: string }[];
}

export interface PhaseDTO {
  id: string;
  title: string;
  expectedActions: ExpectedActionDTO[];
}

export interface ExpectedActionDTO {
  node: string;
  action: string;
  value: number | null;
}

export interface SessionDTO {
  id: string;
  scenarioId: string;
  userId: string;
  attempt: number;
  active: boolean;
}

export interface ActionRequestDTO {
  node: string;
  action: string;
  value?: number | null;
}

export interface ChainLinkDTO {
  node: string;
  changed: string[];
}

export interface NodeStateDTO {
  mode: string;
  parameters: Record<string, number>;
}

export interface SimulationStepDTO {
  node: string;
  action: string;
  value: number | null;
  validationResult: string;
  chain: ChainLinkDTO[];
  finalState: Record<string, NodeStateDTO>;
  stabilized: boolean;
}

export interface FeedbackDTO {
  actionId: string | null;
  type: string;
  text: string;
  hint: string | null;
}

export interface VerdictDTO {
  sessionId: string;
  scenarioId: string;
  attempt: number;
  verdict: string;
  score: number;
  componentScores: Record<string, number>;
  achievements: string[];
  feedback: FeedbackDTO[];
  aiUsed: boolean;
}

export interface SessionInfoDTO {
  id: string;
  scenarioId: string;
  userId: string;
  attempt: number;
  active: boolean;
  startedAt: string;
  endedAt: string | null;
  durationSec: number;
  verdict: VerdictDTO | null;
}

export const apiClient = {
  async getGraph(install = 'ELOU-AV'): Promise<GraphDTO> {
    const { data } = await api.get('/graph', { params: { install } });
    return data;
  },

  async listScenarios(): Promise<ScenarioDTO[]> {
    const { data } = await api.get('/scenarios');
    return data;
  },

  async getScenario(id: string): Promise<ScenarioDTO> {
    const { data } = await api.get(`/scenarios/${id}`);
    return data;
  },

  async getHints(scenarioId: string): Promise<Record<string, string>> {
    const { data } = await api.get(`/scenarios/${scenarioId}/hints`);
    return data;
  },

  async startSession(scenarioId: string, attempt = 1): Promise<SessionDTO> {
    const { data } = await api.post('/sessions', { scenarioId, attempt });
    return data;
  },

  async getSession(id: string): Promise<SessionDTO> {
    const { data } = await api.get(`/sessions/${id}`);
    return data;
  },

  async applyAction(sessionId: string, req: ActionRequestDTO): Promise<SimulationStepDTO> {
    const { data } = await api.post(`/sessions/${sessionId}/actions`, req);
    return data;
  },

  async endSession(sessionId: string): Promise<VerdictDTO> {
    const { data } = await api.post(`/sessions/${sessionId}/end`);
    return data;
  },

  async getSessionState(sessionId: string): Promise<GraphDTO> {
    const { data } = await api.get(`/sessions/${sessionId}/state`);
    return data;
  },

  async listAllSessions(): Promise<SessionInfoDTO[]> {
    const { data } = await api.get('/sessions');
    return data;
  },

  async getContextHint(sessionId: string): Promise<{ text: string; phase: string; hint?: string }> {
    const { data } = await api.get(`/sessions/${sessionId}/hint`);
    return data;
  },

  async createScenario(req: any): Promise<ScenarioDTO> {
    const { data } = await api.post('/scenarios', req);
    return data;
  },

  async updateScenario(id: string, req: any): Promise<ScenarioDTO> {
    const { data } = await api.put(`/scenarios/${id}`, req);
    return data;
  },

  async deleteScenario(id: string): Promise<void> {
    await api.delete(`/scenarios/${id}`);
  },

  async validateScenario(id: string): Promise<{ valid: boolean; errors: string[] }> {
    const { data } = await api.post(`/scenarios/${id}/validate`);
    return data;
  },

  async generateScenarioDraft(req: { topic?: string; difficulty?: number; timeoutSec?: number }): Promise<{ scenario?: any; error?: string; rawText?: string }> {
    const { data } = await api.post('/ai/scenario-draft', req);
    return data;
  },

  async explainAction(req: { node?: string; action?: string; value?: number; chain?: any[] }): Promise<{ text: string; isAI: boolean; error: boolean }> {
    const { data } = await api.post('/ai/explain-action', req);
    return data;
  },

  async analyzeSession(sessionId: string): Promise<{ text: string; recommendations: string[]; isAI: boolean; error: boolean }> {
    const { data } = await api.post('/ai/session-analysis', { sessionId });
    return data;
  },
};
