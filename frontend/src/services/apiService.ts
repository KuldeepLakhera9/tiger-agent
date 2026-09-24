import { BENCHMARK_DATA } from '../data/benchmarkCases';
import type {
  AnalyticsOverview,
  BenchmarkCase,
  CaseSummary,
  GraphResponse,
  HistoricalCase,
  TimelineEvent,
} from '../types/fraud';

const API_BASE = (import.meta.env.VITE_API_URL as string) || '/api';

export const apiService = {
  async getCases(): Promise<CaseSummary[]> {
    try {
      const res = await fetch(`${API_BASE}/cases`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        return (await res.json()) as CaseSummary[];
      }
    } catch {
      // Backend not running; fallback to pre-computed benchmark dataset
    }
    return BENCHMARK_DATA.casesSummary as CaseSummary[];
  },

  async getCase(caseId: string): Promise<BenchmarkCase | null> {
    try {
      const res = await fetch(`${API_BASE}/cases/${caseId}`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        return (await res.json()) as BenchmarkCase;
      }
    } catch {
      // Fallback
    }
    const full = BENCHMARK_DATA.fullCases as Record<string, BenchmarkCase>;
    return full[caseId] || null;
  },

  async getGraph(caseId: string): Promise<GraphResponse | null> {
    try {
      const res = await fetch(`${API_BASE}/cases/${caseId}/graph`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        return (await res.json()) as GraphResponse;
      }
    } catch {
      // Fallback
    }
    const graphs = BENCHMARK_DATA.graphs as Record<string, GraphResponse>;
    return graphs[caseId] || null;
  },

  async getTimeline(caseId: string): Promise<TimelineEvent[]> {
    try {
      const res = await fetch(`${API_BASE}/cases/${caseId}/timeline`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        return (await res.json()) as TimelineEvent[];
      }
    } catch {
      // Fallback
    }
    const timelines = BENCHMARK_DATA.timelines as Record<string, TimelineEvent[]>;
    return timelines[caseId] || [];
  },

  async getAnalytics(): Promise<AnalyticsOverview> {
    try {
      const res = await fetch(`${API_BASE}/analytics`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        return (await res.json()) as AnalyticsOverview;
      }
    } catch {
      // Fallback
    }
    return BENCHMARK_DATA.analytics as AnalyticsOverview;
  },

  async getHistoricalCases(): Promise<HistoricalCase[]> {
    try {
      const res = await fetch(`${API_BASE}/historical`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        return (await res.json()) as HistoricalCase[];
      }
    } catch {
      // Fallback
    }
    return BENCHMARK_DATA.historicalCases as HistoricalCase[];
  },
};