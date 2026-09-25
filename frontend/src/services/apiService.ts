import { BENCHMARK_DATA } from '../data/benchmarkCases';
import type {
  AnalyticsOverview,
  BenchmarkCase,
  CaseActionRequest,
  CaseActionResponse,
  CaseSummary,
  GraphResponse,
  HistoricalCase,
  SystemHealth,
  TimelineEvent,
} from '../types/fraud';

const API_BASE = (import.meta.env.VITE_API_URL as string) || '/api';

// In-memory simulation cache for offline/Vercel static execution
const localAuditEvents: Record<string, TimelineEvent[]> = {};
const localLifecycleStages: Record<string, string> = {};
const localCaseStatus: Record<string, string> = {};

export const apiService = {
  async getHealth(): Promise<SystemHealth> {
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        return (await res.json()) as SystemHealth;
      }
    } catch {
      // Backend not running; fallback status
    }
    return {
      status: 'healthy',
      service: 'FRAUDGRAPH API (Client Offline Mode)',
      cases_loaded: 20,
      tigergraph: {
        configured: false,
        connected: false,
        graph: 'FraudInvestigation',
        host: 'Local Cache / Offline',
        message: 'Running in offline benchmark fallback mode.',
      },
      mode: 'deterministic_benchmark',
    };
  },

  async getCases(): Promise<CaseSummary[]> {
    try {
      const res = await fetch(`${API_BASE}/cases`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        return (await res.json()) as CaseSummary[];
      }
    } catch {
      // Backend not running; fallback to pre-computed benchmark dataset
    }
    const summaries = BENCHMARK_DATA.casesSummary as CaseSummary[];
    return summaries.map((s) => ({
      ...s,
      status: localCaseStatus[s.case_id] || s.status,
      lifecycle_stage: localLifecycleStages[s.case_id] || 'ACTION_RECOMMENDED',
    }));
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
    const base = full[caseId];
    if (!base) return null;
    return {
      ...base,
      case: {
        ...base.case,
        status: localCaseStatus[caseId] || base.case.status,
      },
      lifecycle_stage: localLifecycleStages[caseId] || 'ACTION_RECOMMENDED',
    };
  },

  async executeCaseAction(caseId: string, req: CaseActionRequest): Promise<CaseActionResponse> {
    try {
      const res = await fetch(`${API_BASE}/cases/${caseId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        return (await res.json()) as CaseActionResponse;
      }
    } catch {
      // Offline fallback simulation
    }

    // Client-side fallback simulation
    const actionName = req.action.toUpperCase();
    const actor = req.actor || 'Fraud Analyst (L1)';
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    let newStage = 'ACTION_APPROVED';
    let newStatus = 'investigating';
    let whatChanged = '';
    let eventTitle = `Action Executed: ${actionName}`;
    let eventDesc = req.notes || '';

    if (actionName === 'VERIFY_WITH_CUSTOMER') {
      newStage = 'REVIEW';
      newStatus = 'investigating';
      eventTitle = 'Controlled Action: Customer Verification (Out-of-Band Challenge)';
      if (!eventDesc) {
        eventDesc =
          'Dispatched SMS verification challenge to cardholder. Simulated response: Cardholder confirmed unauthorized online transaction.';
      }
      whatChanged = 'Customer verification confirmed unauthorized charge. Hypothesis validated.';
    } else if (actionName === 'REQUEST_ADDITIONAL_EVIDENCE') {
      newStage = 'EVIDENCE_GATHERED';
      newStatus = 'investigating';
      eventTitle = 'Controlled Action: Telemetry & Carrier Verification';
      if (!eventDesc) {
        eventDesc = 'Requested ISP routing and proxy IP classification. High-risk residential proxy subnet flagged.';
      }
      whatChanged = 'Additional device/carrier telemetry collected and logged.';
    } else if (actionName === 'BLOCK_CARD' || actionName === 'BLOCK_ALL_CARDS') {
      newStage = 'ACTION_APPROVED';
      newStatus = 'closed_fraud';
      eventTitle = `Intervention: Card Block Enforced (${req.approval_route || 'L1'})`;
      if (!eventDesc) {
        eventDesc = `Card restricted on all authorization channels by ${actor} under policy rule R2/R5.`;
      }
      whatChanged = 'Card locked to cap ongoing exposure.';
    } else if (actionName === 'DECLINE_TRANSACTION') {
      newStage = 'ACTION_APPROVED';
      newStatus = 'closed_fraud';
      eventTitle = 'Intervention: Authorization Declined';
      if (!eventDesc) {
        eventDesc = 'Transaction declined in authorization stream under rule R5.';
      }
      whatChanged = 'Transaction declined. Fraud exposure prevented.';
    } else if (actionName === 'CREATE_CASE') {
      newStage = 'ACTION_APPROVED';
      newStatus = 'open';
      eventTitle = 'Case Management: Formal Investigation Opened';
      if (!eventDesc) {
        eventDesc = 'Internal case formal docket created under policy rule 3a. Assigned to Tier-2 Fraud Ops.';
      }
      whatChanged = 'Formal docket established in fraud registry.';
    } else if (actionName === 'APPROVE_ACTION') {
      newStage = 'ACTION_APPROVED';
      eventTitle = `Policy Approval: ${actor} Signed Off`;
      eventDesc = `Approval authority ${actor} approved recommended action following review of graph evidence.`;
      whatChanged = 'Recommended action approved by appropriate routing authority.';
    } else if (actionName === 'RESOLVE_CASE' || actionName === 'CLOSE_NO_FRAUD') {
      newStage = 'RESOLVED';
      newStatus = actionName === 'CLOSE_NO_FRAUD' ? 'closed_legitimate' : 'closed_fraud';
      eventTitle = `Case Resolution: Closed (${newStatus})`;
      eventDesc = `Case investigation concluded and approved for archive by ${actor}.`;
      whatChanged = `Investigation docket transitioned to ${newStatus} and resolved.`;
    }

    const auditEvent: TimelineEvent = {
      id: `evt-client-sim-${Date.now()}`,
      timestamp: now,
      title: eventTitle,
      description: eventDesc,
      type: eventTitle.includes('Controlled') ? 'controlled_action' : 'action',
      badge: 'AUDIT TRAIL',
      actor,
      stage: newStage,
      decision: actionName,
    };

    if (!localAuditEvents[caseId]) localAuditEvents[caseId] = [];
    localAuditEvents[caseId].push(auditEvent);
    localLifecycleStages[caseId] = newStage;
    localCaseStatus[caseId] = newStatus;

    return {
      success: true,
      case_id: caseId,
      action: actionName,
      new_status: newStatus,
      lifecycle_stage: newStage,
      message: `Action '${actionName}' executed successfully (Client Mode).`,
      audit_event: auditEvent,
      what_changed: whatChanged,
      is_simulated: true,
    };
  },

  async updateCaseLifecycle(caseId: string, stage: string, actor: string = 'Fraud Analyst'): Promise<{ success: boolean; lifecycle_stage: string; audit_event: TimelineEvent }> {
    try {
      const res = await fetch(`${API_BASE}/cases/${caseId}/lifecycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, actor }),
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    localLifecycleStages[caseId] = stage.toUpperCase();
    const auditEvent: TimelineEvent = {
      id: `evt-stage-sim-${Date.now()}`,
      timestamp: now,
      title: `Lifecycle Transition: ${stage.toUpperCase()}`,
      description: `Investigation transitioned to ${stage.toUpperCase()} stage by ${actor}.`,
      type: 'lifecycle',
      badge: 'LIFECYCLE',
      actor,
      stage: stage.toUpperCase(),
    };
    if (!localAuditEvents[caseId]) localAuditEvents[caseId] = [];
    localAuditEvents[caseId].push(auditEvent);
    return { success: true, lifecycle_stage: stage.toUpperCase(), audit_event: auditEvent };
  },

  async resetCase(caseId: string): Promise<BenchmarkCase | null> {
    delete localAuditEvents[caseId];
    delete localLifecycleStages[caseId];
    delete localCaseStatus[caseId];
    try {
      const res = await fetch(`${API_BASE}/cases/${caseId}/reset`, {
        method: 'POST',
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json();
        return data.case as BenchmarkCase;
      }
    } catch {
      // Fallback
    }
    return this.getCase(caseId);
  },

  async runInvestigation(caseId?: string, transactionId?: string): Promise<BenchmarkCase | null> {
    try {
      const res = await fetch(`${API_BASE}/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId, transaction_id: transactionId }),
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        return (await res.json()) as BenchmarkCase;
      }
    } catch {
      // Fallback
    }
    return this.getCase(caseId || 'HHG-002');
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
    let baseEvents: TimelineEvent[] = [];
    try {
      const res = await fetch(`${API_BASE}/cases/${caseId}/timeline`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        return (await res.json()) as TimelineEvent[];
      }
    } catch {
      // Fallback
    }
    const timelines = BENCHMARK_DATA.timelines as Record<string, TimelineEvent[]>;
    baseEvents = timelines[caseId] || [];
    const extras = localAuditEvents[caseId] || [];
    return [...baseEvents, ...extras];
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