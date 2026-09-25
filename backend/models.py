"""Data models for FRAUDGRAPH investigation system."""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class EvidenceItem(BaseModel):
    claim: str
    source: str
    ref: str
    entity_ids: List[str] = Field(default_factory=list)


class NextBestActionItem(BaseModel):
    action: str
    route: str
    reason: str


class NextBestActions(BaseModel):
    initial: List[NextBestActionItem] = Field(default_factory=list)
    final: List[NextBestActionItem] = Field(default_factory=list)
    what_changed: str = ""


class SARReport(BaseModel):
    file: bool
    reason: str = ""
    narrative: str = ""
    subjects: List[str] = Field(default_factory=list)
    total_amount_usd: float = 0.0
    activity_dates: List[str] = Field(default_factory=list)


class CaseDetail(BaseModel):
    status: str
    verdict: str
    fraud_probability: float
    pattern: str
    pattern_description: str = ""
    affected_txn_ids: List[str] = Field(default_factory=list)
    first_suspicious_txn_id: str = ""
    connected_card_ids: List[str] = Field(default_factory=list)
    connected_device_profiles: List[str] = Field(default_factory=list)
    exposure_usd: float = 0.0
    evidence: List[EvidenceItem] = Field(default_factory=list)
    similar_prior_cases: List[str] = Field(default_factory=list)
    summary: str = ""
    written_to_graph: bool = False
    graph_case_id: str = ""


class BenchmarkCase(BaseModel):
    case_id: str
    case: CaseDetail
    evidence_requests: List[Dict[str, Any]] = Field(default_factory=list)
    next_best_actions: NextBestActions
    sar: SARReport
    stop_reason: str = ""
    tool_calls: int = 5
    tokens: int = 0
    latency_s: float = 0.0
    
    # Metadata augmented from case_pack
    flagged_txn_id: Optional[str] = None
    card_id: Optional[str] = None
    customer_id: Optional[str] = None
    opened_at: Optional[str] = None
    trigger_type: Optional[str] = None
    trigger_text: Optional[str] = None
    risk_score: Optional[float] = None
    amount: Optional[float] = None
    channel: Optional[str] = None
    lifecycle_stage: Optional[str] = "ACTION_RECOMMENDED"


class CaseSummary(BaseModel):
    case_id: str
    transaction: str
    customer: str
    card: str
    amount: float
    risk_score: float
    fraud_probability: float
    pattern: str
    exposure: float
    status: str
    sar_required: bool
    next_best_action: str
    action_route: str
    trigger_type: str
    trigger_text: str
    opened_at: str
    connected_devices_count: int
    connected_cards_count: int
    lifecycle_stage: Optional[str] = "ACTION_RECOMMENDED"


class GraphNode(BaseModel):
    id: str
    type: str  # Customer, Card, Transaction, Device, Region, Email, HistoricalCase
    data: Dict[str, Any]
    position: Dict[str, float] = Field(default_factory=lambda: {"x": 0.0, "y": 0.0})


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    label: str  # OWNS, MADE, FROM_DEVICE, BILLED_IN, PURCHASER_EMAIL, RECIPIENT_EMAIL, INVOLVES, CONNECTED_TO, NEXT
    animated: bool = False
    data: Optional[Dict[str, Any]] = None


class GraphResponse(BaseModel):
    case_id: str
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    device_status: str  # e.g. "Device evidence unavailable" for HHG-002
    has_device: bool


class TimelineEvent(BaseModel):
    id: str
    timestamp: str
    title: str
    description: str
    type: str  # alert, query, analysis, policy, action, controlled_action, lifecycle
    ref: str = ""
    badge: Optional[str] = None
    claim: Optional[str] = None
    actor: Optional[str] = None
    stage: Optional[str] = None
    decision: Optional[str] = None
    recommendation: Optional[str] = None


class CaseActionRequest(BaseModel):
    action: str  # VERIFY_WITH_CUSTOMER, REQUEST_ADDITIONAL_EVIDENCE, BLOCK_CARD, DECLINE_TRANSACTION, APPROVE_ACTION, RESOLVE_CASE, CREATE_CASE
    actor: str = "Fraud Analyst (L1)"
    notes: Optional[str] = None
    approval_route: Optional[str] = None
    simulated_outcome: Optional[str] = None


class CaseActionResponse(BaseModel):
    success: bool
    case_id: str
    action: str
    new_status: str
    lifecycle_stage: str
    message: str
    audit_event: TimelineEvent
    what_changed: str = ""
    is_simulated: bool = True


class InvestigateRequest(BaseModel):
    case_id: Optional[str] = None
    transaction_id: Optional[str] = None


class AnalyticsOverview(BaseModel):
    total_cases: int
    open_cases: int
    total_exposure: float
    suspected_fraud_cases: int
    sar_required_count: int
    avg_fraud_probability: float
    probability_distribution: List[Dict[str, Any]]
    exposure_by_case: List[Dict[str, Any]]
    pattern_breakdown: List[Dict[str, Any]]
    policy_action_breakdown: List[Dict[str, Any]]
    sar_breakdown: List[Dict[str, Any]]
    status_breakdown: List[Dict[str, Any]]
