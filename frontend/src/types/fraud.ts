export interface EvidenceItem {
  claim: string;
  source: string;
  ref: string;
  entity_ids: string[];
}

export interface NextBestActionItem {
  action: string;
  route: string;
  reason: string;
}

export interface NextBestActions {
  initial: NextBestActionItem[];
  final: NextBestActionItem[];
  what_changed: string;
}

export interface SARReport {
  file: boolean;
  reason: string;
  narrative: string;
  subjects: string[];
  total_amount_usd: number;
  activity_dates: string[];
}

export interface CaseDetail {
  status: string;
  verdict: string;
  fraud_probability: number;
  pattern: string;
  pattern_description: string;
  affected_txn_ids: string[];
  first_suspicious_txn_id: string;
  connected_card_ids: string[];
  connected_device_profiles: string[];
  exposure_usd: number;
  evidence: EvidenceItem[];
  similar_prior_cases: string[];
  summary: string;
  written_to_graph: boolean;
  graph_case_id: string;
}

export interface BenchmarkCase {
  case_id: string;
  case: CaseDetail;
  evidence_requests: Array<{
    type: string;
    asked_after_step: number;
    assumed_response: string;
  }>;
  next_best_actions: NextBestActions;
  sar: SARReport;
  stop_reason: string;
  tool_calls: number;
  tokens: number;
  latency_s: number;
  flagged_txn_id?: string;
  card_id?: string;
  customer_id?: string;
  opened_at?: string;
  trigger_type?: string;
  trigger_text?: string;
  risk_score?: number;
  amount?: number;
  channel?: string;
}

export interface CaseSummary {
  case_id: string;
  transaction: string;
  customer: string;
  card: string;
  amount: number;
  risk_score: number;
  fraud_probability: number;
  pattern: string;
  exposure: number;
  status: string;
  sar_required: boolean;
  next_best_action: string;
  action_route: string;
  trigger_type: string;
  trigger_text: string;
  opened_at: string;
  connected_devices_count: number;
  connected_cards_count: number;
}

export interface GraphNode {
  id: string;
  type: string;
  data: {
    label: string;
    title?: string;
    sub?: string;
    status?: string;
    isFlagged?: boolean;
    amount?: number;
    risk?: number;
    pattern?: string;
  };
  position: { x: number; y: number };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  animated?: boolean;
}

export interface GraphResponse {
  case_id: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  device_status: string;
  has_device: boolean;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  type: 'alert' | 'query' | 'analysis' | 'policy' | 'action';
  ref?: string;
  badge?: string;
  claim?: string;
}

export interface AnalyticsOverview {
  total_cases: number;
  open_cases: number;
  total_exposure: number;
  suspected_fraud_cases: number;
  sar_required_count: number;
  avg_fraud_probability: number;
  probability_distribution: Array<{ range: string; count: number }>;
  exposure_by_case: Array<{ case_id: string; exposure: number; pattern: string }>;
  pattern_breakdown: Array<{ pattern: string; count: number }>;
  policy_action_breakdown: Array<{ action: string; count: number }>;
  sar_breakdown: Array<{ status: string; count: number }>;
  status_breakdown: Array<{ status: string; count: number }>;
}

export interface HistoricalCase {
  case_id: string;
  customer_id: string;
  card_id: string;
  outcome: string;
  pattern: string;
  exposure_usd: number;
  report_filed: string;
  analyst_notes: string;
  actions_taken: string;
}
