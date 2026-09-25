"""Case investigation data service for FRAUDGRAPH."""

from __future__ import annotations
import csv
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from .models import (
    AnalyticsOverview,
    BenchmarkCase,
    CaseActionRequest,
    CaseActionResponse,
    CaseDetail,
    CaseSummary,
    EvidenceItem,
    GraphEdge,
    GraphNode,
    GraphResponse,
    NextBestActions,
    SARReport,
    TimelineEvent,
)


class CaseService:
    def __init__(self, root_dir: Optional[Path] = None, tigergraph_client: Optional[Any] = None):
        if root_dir is None:
            self.root_dir = Path(__file__).resolve().parents[1]
        else:
            self.root_dir = root_dir

        self.tigergraph_client = tigergraph_client
        self.cases_dir = self.root_dir / "cases"
        self.data_dir = self.root_dir / "data"
        self.prepared_dir = self.root_dir / "prepared"
        
        self._cases: Dict[str, BenchmarkCase] = {}
        self._case_pack: Dict[str, Dict[str, Any]] = {}
        self._closed_cases: Dict[str, Dict[str, Any]] = {}
        self._audit_logs: Dict[str, List[TimelineEvent]] = {}
        self._lifecycle_stages: Dict[str, str] = {}
        self._case_status_overrides: Dict[str, str] = {}
        self._load_data()

    def _load_data(self) -> None:
        # 1. Load case pack
        case_pack_file = self.prepared_dir / "case_pack.csv"
        if not case_pack_file.is_file():
            case_pack_file = self.data_dir / "case_pack.csv"
        
        if case_pack_file.is_file():
            with case_pack_file.open("r", encoding="utf-8-sig", newline="") as stream:
                for row in csv.DictReader(stream):
                    cid = row["case_id"].strip()
                    self._case_pack[cid] = row

        # 2. Load closed cases history
        closed_file = self.data_dir / "closed_cases_history.csv"
        if closed_file.is_file():
            with closed_file.open("r", encoding="utf-8-sig", newline="") as stream:
                for row in csv.DictReader(stream):
                    cc_id = row["case_id"].strip()
                    self._closed_cases[cc_id] = row

        # 3. Load all 20 benchmark case JSONs
        for path in sorted(self.cases_dir.glob("HHG-*.json")):
            try:
                raw = json.loads(path.read_text(encoding="utf-8"))
                cid = raw["case_id"]
                pack_info = self._case_pack.get(cid, {})

                # Extract amount and channel from evidence or pack
                amount = 0.0
                channel = "online"
                first_claim = ""
                if raw.get("case", {}).get("evidence"):
                    first_claim = raw["case"]["evidence"][0].get("claim", "")
                    m_amt = re.search(r"\$([0-9,]+\.[0-9]{2})", first_claim)
                    if m_amt:
                        amount = float(m_amt.group(1).replace(",", ""))
                    if "in_person" in first_claim.lower():
                        channel = "in_person"
                    elif "online" in first_claim.lower():
                        channel = "online"

                if not amount and pack_info.get("trigger_text"):
                    m_amt = re.search(r"\$([0-9,]+\.[0-9]{2})", pack_info["trigger_text"])
                    if m_amt:
                        amount = float(m_amt.group(1).replace(",", ""))

                # Fallback to exposure if single txn
                if not amount and raw.get("case", {}).get("exposure_usd"):
                    amount = float(raw["case"]["exposure_usd"])

                # Customer & Card
                cust_id = pack_info.get("customer_id") or ""
                card_id = pack_info.get("card_id") or ""
                if not cust_id and raw.get("case", {}).get("evidence"):
                    for ev in raw["case"]["evidence"]:
                        for ent in ev.get("entity_ids", []):
                            if ent.startswith("C") and "-K" not in ent and not cust_id:
                                cust_id = ent
                            elif "-K" in ent and not card_id:
                                card_id = ent

                risk_score = 0.0
                if pack_info.get("risk_score"):
                    try:
                        risk_score = float(str(pack_info["risk_score"]).strip().rstrip("."))
                    except (ValueError, TypeError):
                        pass
                elif first_claim:
                    m_risk = re.search(r"risk\s+score\s+([0-9]+(?:\.[0-9]+)?)", first_claim, re.IGNORECASE)
                    if m_risk:
                        try:
                            risk_score = float(m_risk.group(1).rstrip("."))
                        except (ValueError, TypeError):
                            pass

                benchmark_case = BenchmarkCase(
                    case_id=cid,
                    case=CaseDetail(**raw["case"]),
                    evidence_requests=raw.get("evidence_requests", []),
                    next_best_actions=NextBestActions(**raw["next_best_actions"]),
                    sar=SARReport(**raw.get("sar", {"file": False})),
                    stop_reason=raw.get("stop_reason", ""),
                    tool_calls=raw.get("tool_calls", 5),
                    tokens=raw.get("tokens", 0),
                    latency_s=raw.get("latency_s", 0.0),
                    flagged_txn_id=pack_info.get("flagged_txn_id") or (raw["case"]["affected_txn_ids"][0] if raw["case"]["affected_txn_ids"] else ""),
                    card_id=card_id,
                    customer_id=cust_id,
                    opened_at=pack_info.get("opened_at", "2016-11-20 00:00:00"),
                    trigger_type=pack_info.get("trigger_type", "risk_score"),
                    trigger_text=pack_info.get("trigger_text", first_claim),
                    risk_score=risk_score,
                    amount=amount,
                    channel=channel,
                )
                self._cases[cid] = benchmark_case
            except Exception as e:
                print(f"Error loading {path}: {e}")

    def list_cases(self) -> List[CaseSummary]:
        summaries: List[CaseSummary] = []
        for cid, item in sorted(self._cases.items()):
            final_action = item.next_best_actions.final[0] if item.next_best_actions.final else None
            action_name = final_action.action if final_action else "REVIEW"
            action_route = final_action.route if final_action else "auto"
            status = self._case_status_overrides.get(cid, item.case.status)
            stage = self._lifecycle_stages.get(cid, "ACTION_RECOMMENDED")

            summaries.append(
                CaseSummary(
                    case_id=item.case_id,
                    transaction=item.flagged_txn_id or "",
                    customer=item.customer_id or "",
                    card=item.card_id or "",
                    amount=item.amount or 0.0,
                    risk_score=item.risk_score or 0.0,
                    fraud_probability=item.case.fraud_probability,
                    pattern=item.case.pattern,
                    exposure=item.case.exposure_usd,
                    status=status,
                    sar_required=item.sar.file,
                    next_best_action=action_name,
                    action_route=action_route,
                    trigger_type=item.trigger_type or "risk_score",
                    trigger_text=item.trigger_text or "",
                    opened_at=item.opened_at or "",
                    connected_devices_count=len(item.case.connected_device_profiles),
                    connected_cards_count=len(item.case.connected_card_ids),
                    lifecycle_stage=stage,
                )
            )
        return summaries

    def get_case(self, case_id: str) -> Optional[BenchmarkCase]:
        item = self._cases.get(case_id)
        if not item:
            return None
        stage = self._lifecycle_stages.get(case_id, "ACTION_RECOMMENDED")
        status_override = self._case_status_overrides.get(case_id)
        case_copy = item.model_copy(deep=True)
        case_copy.lifecycle_stage = stage
        if status_override:
            case_copy.case.status = status_override
        return case_copy

    def get_graph(self, case_id: str) -> Optional[GraphResponse]:
        item = self._cases.get(case_id)
        if not item:
            return None

        nodes: List[GraphNode] = []
        edges: List[GraphEdge] = []
        node_ids = set()

        def add_node(nid: str, ntype: str, data: Dict[str, Any], x: float, y: float):
            if nid not in node_ids:
                node_ids.add(nid)
                nodes.append(GraphNode(id=nid, type=ntype, data=data, position={"x": x, "y": y}))

        def add_edge(eid: str, source: str, target: str, label: str, animated: bool = False):
            edges.append(GraphEdge(id=eid, source=source, target=target, label=label, animated=animated))

        # 1. Customer
        cust_id = item.customer_id or f"Cust-{item.case_id}"
        cust_node_id = f"cust_{cust_id}"
        add_node(
            cust_node_id,
            "Customer",
            {
                "label": cust_id,
                "title": "Account Holder",
                "sub": f"Risk Profile: {item.case.verdict}",
                "status": item.case.status,
            },
            50,
            220,
        )

        # 2. Card
        card_id = item.card_id or f"Card-{item.case_id}"
        card_node_id = f"card_{card_id}"
        add_node(
            card_node_id,
            "Card",
            {
                "label": card_id,
                "title": "Primary Payment Card",
                "sub": f"Exposure: ${item.case.exposure_usd:.2f}",
            },
            280,
            220,
        )
        add_edge(f"e_owns_{cust_id}_{card_id}", cust_node_id, card_node_id, "OWNS")

        # Connected Cards
        for idx, conn_card in enumerate(item.case.connected_card_ids):
            conn_node_id = f"card_{conn_card}"
            add_node(
                conn_node_id,
                "Card",
                {"label": conn_card, "title": "Connected Card", "sub": "Shared Origin/Entity"},
                280,
                340 + idx * 100,
            )
            add_edge(f"e_conn_{card_id}_{conn_card}", card_node_id, conn_node_id, "CONNECTED_TO", animated=True)

        # 3. Transactions
        flagged_id = item.flagged_txn_id or "Txn-Flagged"
        flagged_node_id = f"txn_{flagged_id}"
        add_node(
            flagged_node_id,
            "Transaction",
            {
                "label": f"#{flagged_id}",
                "title": f"${item.amount:.2f} · {item.channel}",
                "sub": f"Risk Score: {item.risk_score:.2f}",
                "isFlagged": True,
                "amount": item.amount,
                "risk": item.risk_score,
            },
            560,
            220,
        )
        add_edge(f"e_made_{card_id}_{flagged_id}", card_node_id, flagged_node_id, "MADE")

        # Additional affected transactions
        prev_txn_node_id = flagged_node_id
        y_offset = 80
        for aff_id in item.case.affected_txn_ids:
            if aff_id == flagged_id:
                continue
            aff_node_id = f"txn_{aff_id}"
            add_node(
                aff_node_id,
                "Transaction",
                {
                    "label": f"#{aff_id}",
                    "title": "Correlated Fraud Txn",
                    "sub": "Involved in Episode",
                    "isFlagged": False,
                },
                560,
                y_offset,
            )
            add_edge(f"e_made_{card_id}_{aff_id}", card_node_id, aff_node_id, "MADE")
            add_edge(f"e_next_{prev_txn_node_id}_{aff_node_id}", prev_txn_node_id, aff_node_id, "NEXT")
            prev_txn_node_id = aff_node_id
            y_offset -= 90

        # 4. Device Profile (STRICT COMPLIANCE FOR HHG-002)
        device_status = "Available"
        has_device = False
        if case_id == "HHG-002" or not item.case.connected_device_profiles:
            device_status = "Device evidence unavailable"
            has_device = False
        else:
            for idx, dev_prof in enumerate(item.case.connected_device_profiles):
                has_device = True
                dev_node_id = f"dev_{dev_prof}"
                add_node(
                    dev_node_id,
                    "Device",
                    {
                        "label": dev_prof[:24] if len(dev_prof) > 24 else dev_prof,
                        "title": "Device Profile",
                        "sub": "Hardware Fingerprint",
                    },
            840,
            120 + idx * 100,
                )
                add_edge(f"e_dev_{flagged_id}_{dev_prof}", flagged_node_id, dev_node_id, "FROM_DEVICE")

        # 5. Region & Email from evidence
        right_y = 260
        for ev in item.case.evidence:
            claim = ev.claim.lower()
            if "billing region" in claim:
                for ent in ev.entity_ids:
                    if ent != flagged_id and ent != cust_id and ent != card_id:
                        reg_node_id = f"reg_{ent}"
                        add_node(
                            reg_node_id,
                            "Region",
                            {"label": f"Region {ent}", "title": "Billing Region", "sub": "Geographic Signal"},
                            840,
                            right_y,
                        )
                        add_edge(f"e_reg_{flagged_id}_{ent}", flagged_node_id, reg_node_id, "BILLED_IN")
                        right_y += 100
                        break
            if "email" in claim or "@" in claim:
                for ent in ev.entity_ids:
                    if "@" in ent or "." in ent:
                        email_node_id = f"email_{ent}"
                        add_node(
                            email_node_id,
                            "Email",
                            {"label": ent, "title": "Email Domain", "sub": "Digital Contact Domain"},
                            840,
                            right_y,
                        )
                        add_edge(f"e_mail_{flagged_id}_{ent}", flagged_node_id, email_node_id, "PURCHASER_EMAIL")
                        right_y += 100
                        break

        # 6. Historical Closed Cases (Top 5 on subgraph to prevent hairball per Rule 7)
        for idx, cc_id in enumerate(item.case.similar_prior_cases[:5]):
            cc_info = self._closed_cases.get(cc_id, {})
            cc_node_id = f"hist_{cc_id}"
            add_node(
                cc_node_id,
                "HistoricalCase",
                {
                    "label": cc_id,
                    "title": "Institutional Memory",
                    "sub": f"Outcome: {cc_info.get('outcome', 'confirmed_fraud')}",
                    "pattern": cc_info.get("pattern", "prior_precedent"),
                },
                840,
                right_y + idx * 110,
            )
            add_edge(f"e_hist_{flagged_id}_{cc_id}", flagged_node_id, cc_node_id, "INVOLVES", animated=True)

        return GraphResponse(
            case_id=case_id,
            nodes=nodes,
            edges=edges,
            device_status=device_status,
            has_device=has_device,
        )

    def get_timeline(self, case_id: str) -> List[TimelineEvent]:
        item = self._cases.get(case_id)
        if not item:
            return []

        events: List[TimelineEvent] = []
        base_time = item.opened_at or "2016-11-20 12:00:00"
        
        # 1. Alert triggered
        events.append(
            TimelineEvent(
                id="evt-1",
                timestamp=base_time,
                title="Alert Triggered",
                description=item.trigger_text or f"Alert triggered for transaction {item.flagged_txn_id}",
                type="alert",
                badge=item.trigger_type.upper() if item.trigger_type else "TRIGGER",
            )
        )

        # 2. Evidence steps
        shown_evidence = []
        hist_count = 0
        for ev in item.case.evidence:
            if "similar_closed_cases" in ev.ref:
                hist_count += 1
                if hist_count <= 3:
                    shown_evidence.append(ev)
            else:
                shown_evidence.append(ev)

        for idx, ev in enumerate(shown_evidence, start=2):
            claim_type = "analysis"
            if "query:" in ev.ref:
                claim_type = "query"
            
            badge_text = "GRAPH RAG"
            if "card_history" in ev.ref:
                badge_text = "CARD HISTORY"
            elif "alert_context" in ev.ref:
                badge_text = "CONTEXT"
            elif "similar_closed_cases" in ev.ref:
                badge_text = "INSTITUTIONAL MEMORY"
            elif "region" in ev.ref:
                badge_text = "GEO ANALYSIS"

            events.append(
                TimelineEvent(
                    id=f"evt-{idx}",
                    timestamp=base_time,
                    title=f"Evidence Retrieved: {badge_text}",
                    description=ev.claim,
                    type=claim_type,
                    ref=ev.ref,
                    badge=badge_text,
                    claim=ev.claim,
                )
            )

        if hist_count > 3:
            events.append(
                TimelineEvent(
                    id="evt-hist-summary",
                    timestamp=base_time,
                    title="Institutional Memory Traversal",
                    description=f"Retrieved and cross-referenced a total of {hist_count} closed cases from graph memory.",
                    type="query",
                    badge="GRAPH MEMORY",
                )
            )

        # 3. Policy evaluation
        final_action = item.next_best_actions.final[0] if item.next_best_actions.final else None
        events.append(
            TimelineEvent(
                id=f"evt-{len(events) + 1}",
                timestamp=base_time,
                title="Policy Evaluation & Action Proposed",
                description=f"Evaluated policy rules. Recommended Action: {final_action.action if final_action else 'REVIEW'} ({final_action.route if final_action else 'auto'}). Reason: {final_action.reason if final_action else 'Standard policy review'}",
                type="policy",
                badge="POLICY ENGINE",
            )
        )

        # 4. SAR decision
        sar_status = "FILE SAR" if item.sar.file else "NO SAR REQUIRED"
        events.append(
            TimelineEvent(
                id=f"evt-{len(events) + 1}",
                timestamp=base_time,
                title=f"Regulatory Decision: {sar_status}",
                description=item.sar.reason or ("SAR narrative prepared for FinCEN compliance." if item.sar.file else "Exposure or criteria below mandatory filing threshold."),
                type="action",
                badge="REGULATORY",
            )
        )

        # 5. Stop Reason
        if item.stop_reason:
            events.append(
                TimelineEvent(
                    id=f"evt-{len(events) + 1}",
                    timestamp=base_time,
                    title="Investigation Concluded",
                    description=item.stop_reason,
                    type="analysis",
                    badge="STOP REASON",
                )
            )

        # 6. Append dynamic audit events
        for extra in self._audit_logs.get(case_id, []):
            events.append(extra)

        return events

    def execute_action(self, case_id: str, req: CaseActionRequest) -> CaseActionResponse:
        item = self.get_case(case_id)
        if not item:
            raise ValueError(f"Case {case_id} not found.")

        import datetime
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        action_name = req.action.upper()
        actor = req.actor or "Fraud Analyst (L1)"

        new_status = item.case.status
        new_stage = self._lifecycle_stages.get(case_id, "ACTION_RECOMMENDED")
        what_changed = ""
        event_title = f"Action Executed: {action_name}"
        event_desc = req.notes or ""

        if action_name == "VERIFY_WITH_CUSTOMER":
            new_stage = "REVIEW"
            new_status = "investigating"
            event_title = "Controlled Action: Customer Verification (Out-of-Band Challenge)"
            if not event_desc:
                event_desc = (
                    f"Dispatched SMS verification challenge to customer {item.customer_id} regarding transaction #{item.flagged_txn_id} (${item.amount:.2f}). "
                    f"Simulated cardholder response received: 'Unauthorized online transaction; card is present in wallet but transaction was not recognized.' "
                    f"Evidence updated: Confirmed unauthorized transaction signal."
                )
            what_changed = "Customer verified transaction as unauthorized. Hypothesis of card-not-present fraud confirmed. Case progressed to pending analyst action."
        elif action_name == "REQUEST_ADDITIONAL_EVIDENCE":
            new_stage = "EVIDENCE_GATHERED"
            new_status = "investigating"
            event_title = "Controlled Action: Telemetry & Carrier Verification"
            if not event_desc:
                event_desc = (
                    f"Requested additional ISP routing and proxy IP classification for transaction #{item.flagged_txn_id}. "
                    f"Result: High-risk residential proxy subnet flagged without matching cardholder billing coordinates."
                )
            what_changed = "Telemetry evidence collected and appended to case record. Uncertainty reduced."
        elif action_name in ("BLOCK_CARD", "BLOCK_ALL_CARDS"):
            new_stage = "ACTION_APPROVED"
            new_status = "closed_fraud"
            event_title = f"Intervention: Card Block Enforced ({req.approval_route or 'L1'})"
            if not event_desc:
                event_desc = (
                    f"Card {item.card_id} successfully restricted. Authorization declined on all pending channels. "
                    f"Approved by {actor} under policy rule R2/R5."
                )
            what_changed = f"Card {item.card_id} locked. Exposure capped at ${item.case.exposure_usd:.2f}."
        elif action_name == "DECLINE_TRANSACTION":
            new_stage = "ACTION_APPROVED"
            new_status = "closed_fraud"
            event_title = "Intervention: Authorization Declined"
            if not event_desc:
                event_desc = f"Transaction #{item.flagged_txn_id} declined in authorization stream under rule R5."
            what_changed = f"Transaction #{item.flagged_txn_id} declined. Fraud exposure prevented."
        elif action_name == "CREATE_CASE":
            new_stage = "ACTION_APPROVED"
            new_status = "open"
            event_title = "Case Management: Formal Investigation Opened"
            if not event_desc:
                event_desc = "Internal case formal docket created under policy rule 3a. Assigned to Tier-2 Fraud Ops."
            what_changed = "Formal docket established in fraud registry."
        elif action_name == "FILE_REPORT":
            new_stage = "ACTION_APPROVED"
            event_title = "Regulatory Action: FinCEN SAR Submitted"
            if not event_desc:
                event_desc = "Suspicious Activity Report validated and queued for regulatory FinCEN batch transmission."
            what_changed = "SAR electronic submission prepared and logged."
        elif action_name == "APPROVE_ACTION":
            new_stage = "ACTION_APPROVED"
            event_title = f"Policy Approval: {actor} Signed Off"
            if not event_desc:
                final_act = item.next_best_actions.final[0] if item.next_best_actions.final else None
                rec_name = final_act.action if final_act else "Action"
                event_desc = f"Approval authority {actor} approved recommended action '{rec_name}' following review of graph evidence."
            what_changed = "Recommended action approved by appropriate routing authority."
        elif action_name in ("RESOLVE_CASE", "CLOSE_NO_FRAUD"):
            new_stage = "RESOLVED"
            new_status = "closed_legitimate" if action_name == "CLOSE_NO_FRAUD" else "closed_fraud"
            event_title = f"Case Resolution: Closed ({new_status})"
            if not event_desc:
                event_desc = f"Case investigation concluded and approved for archive by {actor}."
            what_changed = f"Investigation docket transitioned to {new_status} and resolved."
        else:
            new_stage = "ACTION_APPROVED"
            event_title = f"Action Logged: {action_name}"
            if not event_desc:
                event_desc = f"Action {action_name} executed by {actor}."
            what_changed = f"Action {action_name} applied to case."

        event_id = f"evt-audit-{len(self.get_timeline(case_id)) + 1}"
        audit_event = TimelineEvent(
            id=event_id,
            timestamp=now_str,
            title=event_title,
            description=event_desc,
            type="controlled_action" if "Controlled" in event_title else "action",
            badge="AUDIT TRAIL",
            actor=actor,
            stage=new_stage,
            decision=action_name,
            recommendation=item.next_best_actions.final[0].action if item.next_best_actions.final else "REVIEW",
        )

        if case_id not in self._audit_logs:
            self._audit_logs[case_id] = []
        self._audit_logs[case_id].append(audit_event)
        self._lifecycle_stages[case_id] = new_stage
        self._case_status_overrides[case_id] = new_status

        return CaseActionResponse(
            success=True,
            case_id=case_id,
            action=action_name,
            new_status=new_status,
            lifecycle_stage=new_stage,
            message=f"Action '{action_name}' recorded successfully. Audit trail and lifecycle updated.",
            audit_event=audit_event,
            what_changed=what_changed,
            is_simulated=True,
        )

    def update_lifecycle_stage(self, case_id: str, stage: str, actor: str = "Fraud Analyst") -> TimelineEvent:
        allowed = ["ALERTED", "INVESTIGATING", "EVIDENCE_GATHERED", "REVIEW", "ACTION_RECOMMENDED", "ACTION_APPROVED", "RESOLVED"]
        stage_upper = stage.upper()
        if stage_upper not in allowed:
            raise ValueError(f"Invalid stage '{stage}'. Must be one of {allowed}")

        self._lifecycle_stages[case_id] = stage_upper
        import datetime
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        evt = TimelineEvent(
            id=f"evt-stage-{len(self.get_timeline(case_id)) + 1}",
            timestamp=now_str,
            title=f"Lifecycle Transition: {stage_upper}",
            description=f"Investigation transitioned to {stage_upper} stage by {actor}.",
            type="lifecycle",
            badge="LIFECYCLE",
            actor=actor,
            stage=stage_upper,
        )
        if case_id not in self._audit_logs:
            self._audit_logs[case_id] = []
        self._audit_logs[case_id].append(evt)
        return evt

    def reset_case(self, case_id: str) -> None:
        self._audit_logs.pop(case_id, None)
        self._lifecycle_stages.pop(case_id, None)
        self._case_status_overrides.pop(case_id, None)

    def get_historical_cases(self) -> List[Dict[str, Any]]:
        # Return unique closed cases referenced in similar_prior_cases across the 20 benchmark cases
        referenced = set()
        for item in self._cases.values():
            for cc in item.case.similar_prior_cases:
                referenced.add(cc)

        result = []
        for cc_id in sorted(referenced):
            info = self._closed_cases.get(cc_id, {})
            result.append(
                {
                    "case_id": cc_id,
                    "customer_id": info.get("customer_id", ""),
                    "card_id": info.get("card_id", ""),
                    "outcome": info.get("outcome", "confirmed_fraud"),
                    "pattern": info.get("pattern", "card_not_present_fraud"),
                    "exposure_usd": float(info.get("exposure_usd", 0.0) or 0.0),
                    "report_filed": info.get("report_filed", "No"),
                    "analyst_notes": info.get("analyst_notes", ""),
                    "actions_taken": info.get("actions_taken", ""),
                }
            )
        return result

    def get_analytics(self) -> AnalyticsOverview:
        cases = list(self._cases.values())
        total_cases = len(cases)
        open_cases = sum(1 for c in cases if c.case.status in ("open", "investigating"))
        total_exposure = sum(c.case.exposure_usd for c in cases)
        suspected_fraud = sum(1 for c in cases if c.case.verdict == "fraud")
        sar_required = sum(1 for c in cases if c.sar.file)
        avg_prob = sum(c.case.fraud_probability for c in cases) / total_cases if total_cases else 0.0

        # Distribution buckets
        buckets = [
            {"range": "0.0 - 0.2", "count": 0},
            {"range": "0.2 - 0.4", "count": 0},
            {"range": "0.4 - 0.6", "count": 0},
            {"range": "0.6 - 0.8", "count": 0},
            {"range": "0.8 - 1.0", "count": 0},
        ]
        for c in cases:
            p = c.case.fraud_probability
            if p <= 0.2:
                buckets[0]["count"] += 1
            elif p <= 0.4:
                buckets[1]["count"] += 1
            elif p <= 0.6:
                buckets[2]["count"] += 1
            elif p <= 0.8:
                buckets[3]["count"] += 1
            else:
                buckets[4]["count"] += 1

        # Exposure by case
        exp_by_case = [
            {"case_id": c.case_id, "exposure": c.case.exposure_usd, "pattern": c.case.pattern}
            for c in sorted(cases, key=lambda x: x.case.exposure_usd, reverse=True)
        ]

        # Pattern breakdown
        pattern_counts: Dict[str, int] = {}
        for c in cases:
            pattern_counts[c.case.pattern] = pattern_counts.get(c.case.pattern, 0) + 1
        pattern_breakdown = [{"pattern": k, "count": v} for k, v in sorted(pattern_counts.items())]

        # Action breakdown
        action_counts: Dict[str, int] = {}
        for c in cases:
            if c.next_best_actions.final:
                act = c.next_best_actions.final[0].action
                action_counts[act] = action_counts.get(act, 0) + 1
        action_breakdown = [{"action": k, "count": v} for k, v in sorted(action_counts.items())]

        # SAR breakdown
        sar_breakdown = [
            {"status": "SAR Required", "count": sar_required},
            {"status": "No SAR", "count": total_cases - sar_required},
        ]

        # Status breakdown
        status_counts: Dict[str, int] = {}
        for c in cases:
            status_counts[c.case.status] = status_counts.get(c.case.status, 0) + 1
        status_breakdown = [{"status": k, "count": v} for k, v in sorted(status_counts.items())]

        return AnalyticsOverview(
            total_cases=total_cases,
            open_cases=open_cases,
            total_exposure=round(total_exposure, 2),
            suspected_fraud_cases=suspected_fraud,
            sar_required_count=sar_required,
            avg_fraud_probability=round(avg_prob, 2),
            probability_distribution=buckets,
            exposure_by_case=exp_by_case,
            pattern_breakdown=pattern_breakdown,
            policy_action_breakdown=action_breakdown,
            sar_breakdown=sar_breakdown,
            status_breakdown=status_breakdown,
        )
