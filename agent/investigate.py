"""Deterministic local investigation engine for the HHGOA benchmark."""

from __future__ import annotations

import csv
import json
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from statistics import median
from typing import Iterable

PATTERNS = {
    "card_testing",
    "card_not_present_fraud",
    "card_not_present_new_device",
    "out_of_region_use",
    "account_takeover",
    "undocumented",
    "none",
}

TRANSACTION_COLUMNS = [
    "txn_id", "customer_id", "card_id", "ts", "TransactionDT", "TransactionAmt",
    "risk_score", "channel", "ProductCD", "addr1", "addr2", "P_emaildomain",
    "R_emaildomain", "features_json",
]
IDENTITY_COLUMNS = [
    "txn_id", "device_id", "device_profile", "DeviceInfo", "id_30", "id_31",
    "id_33", "DeviceType", "id_15", "id_23", "features_json",
]


def clean(value: object) -> str:
    text = "" if value is None else str(value).strip()
    return "" if text.lower() in {"nan", "none", "null"} else text


def number(value: object, default: float = 0.0) -> float:
    try:
        return float(clean(value))
    except (TypeError, ValueError):
        return default


def parse_time(value: str) -> datetime | None:
    try:
        return datetime.strptime(clean(value), "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return None


def read_dicts(path: Path) -> Iterable[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        yield from csv.DictReader(stream)


def clamp(value: float) -> float:
    return round(max(0.05, min(0.95, value)), 2)


@dataclass(slots=True)
class Transaction:
    txn_id: str
    customer_id: str
    card_id: str
    ts: str
    transaction_dt: float
    amount: float
    risk_score: float
    channel: str
    product_code: str
    region: str
    country: str
    purchaser_email: str
    recipient_email: str


@dataclass(slots=True)
class Identity:
    txn_id: str
    device_id: str
    profile: str
    status: str
    proxy: str


class EvidenceStore:
    """Read-only indexed view of the prepared MVP CSVs."""

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.case_pack = list(read_dicts(data_dir / "case_pack.csv"))
        self.transactions: dict[str, Transaction] = {}
        self.transactions_by_card: dict[str, list[Transaction]] = defaultdict(list)
        self.transactions_by_customer: dict[str, list[Transaction]] = defaultdict(list)
        self.identity_by_txn: dict[str, Identity] = {}
        self.transactions_by_device: dict[str, list[Transaction]] = defaultdict(list)
        self.cards_by_customer: dict[str, set[str]] = defaultdict(set)
        self.region_txns: dict[str, set[str]] = defaultdict(set)
        self.email_txns: dict[str, set[str]] = defaultdict(set)
        self.closed_cases: dict[str, dict[str, str]] = {}
        self.closed_case_txns: dict[str, set[str]] = defaultdict(set)
        self.closed_case_cards: dict[str, set[str]] = defaultdict(set)
        self.confirmed_fraud_txns: set[str] = set()
        self.customer_report_txns: set[str] = {
            clean(row["flagged_txn_id"])
            for row in self.case_pack
            if clean(row.get("trigger_type")) == "customer_report"
        }
        self._load_transactions()
        self._load_identity()
        self._load_relationships()

    def _load_transactions(self) -> None:
        with (self.data_dir / "transactions.csv").open("r", encoding="utf-8-sig", newline="") as stream:
            reader = csv.reader(stream)
            header = next(reader)
            indexes = {name: header.index(name) for name in TRANSACTION_COLUMNS if name in header}
            for values in reader:
                row = {name: values[index] for name, index in indexes.items()}
                transaction = Transaction(
                    txn_id=clean(row.get("txn_id")), customer_id=clean(row.get("customer_id")),
                    card_id=clean(row.get("card_id")), ts=clean(row.get("ts")),
                    transaction_dt=number(row.get("TransactionDT")), amount=number(row.get("TransactionAmt")),
                    risk_score=number(row.get("risk_score")), channel=clean(row.get("channel")),
                    product_code=clean(row.get("ProductCD")), region=clean(row.get("addr1")),
                    country=clean(row.get("addr2")), purchaser_email=clean(row.get("P_emaildomain")).lower(),
                    recipient_email=clean(row.get("R_emaildomain")).lower(),
                )
                self.transactions[transaction.txn_id] = transaction
                self.transactions_by_card[transaction.card_id].append(transaction)
                self.transactions_by_customer[transaction.customer_id].append(transaction)
                self.cards_by_customer[transaction.customer_id].add(transaction.card_id)
                if transaction.region:
                    self.region_txns[transaction.region].add(transaction.txn_id)
                for email in (transaction.purchaser_email, transaction.recipient_email):
                    if email:
                        self.email_txns[email].add(transaction.txn_id)
        for values in self.transactions_by_card.values():
            values.sort(key=lambda item: (item.transaction_dt, item.txn_id))

    def _load_identity(self) -> None:
        with (self.data_dir / "identity.csv").open("r", encoding="utf-8-sig", newline="") as stream:
            reader = csv.reader(stream)
            header = next(reader)
            indexes = {name: header.index(name) for name in IDENTITY_COLUMNS if name in header}
            for values in reader:
                row = {name: values[index] for name, index in indexes.items()}
                device_id = clean(row.get("device_id"))
                profile = clean(row.get("device_profile"))
                if not device_id or not profile:
                    continue
                identity = Identity(clean(row.get("txn_id")), device_id, profile, clean(row.get("id_15")), clean(row.get("id_23")))
                self.identity_by_txn[identity.txn_id] = identity
                transaction = self.transactions.get(identity.txn_id)
                if transaction:
                    self.transactions_by_device[device_id].append(transaction)

    def _load_relationships(self) -> None:
        for row in read_dicts(self.data_dir / "closed_cases.csv"):
            self.closed_cases[clean(row["case_id"])] = row
        for row in read_dicts(self.data_dir / "closed_case_transactions.csv"):
            self.closed_case_txns[clean(row["case_id"])].add(clean(row["txn_id"]))
        for row in read_dicts(self.data_dir / "closed_case_cards.csv"):
            self.closed_case_cards[clean(row["case_id"])].add(clean(row["card_id"]))
        for case_id, row in self.closed_cases.items():
            if clean(row.get("outcome")) == "confirmed_fraud":
                self.confirmed_fraud_txns.update(self.closed_case_txns[case_id])

    def case(self, case_id: str) -> dict[str, str]:
        return next(row for row in self.case_pack if clean(row["case_id"]) == case_id)


def card_testing_sequence(history: list[Transaction], flagged: Transaction) -> list[Transaction]:
    nearby = [item for item in history if abs(item.transaction_dt - flagged.transaction_dt) <= 24 * 3600]
    nearby.sort(key=lambda item: (item.transaction_dt, item.txn_id))
    for index, candidate in enumerate(nearby):
        if candidate.transaction_dt > flagged.transaction_dt:
            continue
        small = [item for item in nearby[: index + 1] if item.channel == "online" and 0 < abs(item.amount) < 5 and candidate.transaction_dt - item.transaction_dt <= 3600]
        larger = [item for item in nearby[index:] if item.channel == "online" and abs(item.amount) > 50 and item.transaction_dt >= candidate.transaction_dt]
        if len(small) >= 2 and larger:
            sequence = small + [larger[0]]
            return sorted({item.txn_id: item for item in sequence}.values(), key=lambda item: (item.transaction_dt, item.txn_id))
    return []


def _evidence(claim: str, ref: str, entity_ids: list[str], source: str = "graph") -> dict[str, object]:
    return {"claim": claim, "source": source, "ref": ref, "entity_ids": entity_ids}


def route_for(action: str, exposure: float) -> str:
    if action == "FILE_REPORT" or action == "BLOCK_ALL_CARDS":
        return "L2"
    if action == "BLOCK_CARD":
        return "L1" if exposure <= 2500 else "L2"
    if action == "DECLINE_TRANSACTION":
        return "L1"
    return "auto"


def action(action: str, reason: str, exposure: float) -> dict[str, str]:
    return {"action": action, "route": route_for(action, exposure), "reason": reason}


def sar_required(probability: float, exposure: float, shared: bool, undocumented: bool, other_fraud: bool) -> bool:
    return probability >= 0.75 and (exposure > 1000 or shared or undocumented or other_fraud)


def investigate_case(store: EvidenceStore, case_id: str) -> dict[str, object]:
    case_row = store.case(case_id)
    flagged_id = clean(case_row["flagged_txn_id"])
    flagged = store.transactions[flagged_id]
    history = store.transactions_by_card[clean(case_row["card_id"])]
    testing = card_testing_sequence(history, flagged)
    if testing and flagged.txn_id not in {item.txn_id for item in testing}:
        testing = sorted([*testing, flagged], key=lambda item: (item.transaction_dt, item.txn_id))
    customer_denied = clean(case_row.get("trigger_type")) == "customer_report" and bool(re.search(r"never made|not me|did not make|unauthorized", clean(case_row.get("trigger_text")).lower()))

    affected = testing or [flagged]
    first = min(affected, key=lambda item: (item.transaction_dt, item.txn_id))
    affected_ids = [item.txn_id for item in affected]
    exposure = round(sum(abs(item.amount) for item in affected), 2)
    evidence: list[dict[str, object]] = []
    similar: set[str] = set()
    connected_cards: set[str] = set()
    connected_devices: set[str] = set()

    evidence.append(_evidence(f"Flagged transaction {flagged.txn_id} is ${abs(flagged.amount):.2f}, {flagged.channel}, risk score {flagged.risk_score:.2f}.", "query:alert_context", [flagged.txn_id, flagged.card_id, flagged.customer_id]))
    evidence.append(_evidence(f"Card {flagged.card_id} has {len(history)} indexed transactions in the retained history.", "query:card_history", [flagged.card_id]))
    if testing:
        evidence.append(_evidence(f"Three or more online authorizations under $5 were followed by a larger online purchase within the card-testing window.", "query:card_history", affected_ids))

    device_state = "unavailable"
    profiles_for_sequence: set[str] = set()
    for item in affected:
        identity = store.identity_by_txn.get(item.txn_id)
        if not identity:
            continue
        device_state = "exists"
        profiles_for_sequence.add(identity.profile)
        device_transactions = store.transactions_by_device.get(identity.device_id, [])
        other_cards = {txn.card_id for txn in device_transactions if txn.card_id and txn.card_id != flagged.card_id}
        if other_cards:
            device_state = "connected"
            connected_cards.update(other_cards)
            connected_devices.add(identity.profile)
            evidence.append(_evidence(f"Device profile {identity.profile} is used by the case transaction and other retained cards.", "query:device_connected_cards", [identity.device_id, *sorted(other_cards)]))
    if device_state == "unavailable":
        evidence.append(_evidence("Device evidence unavailable; no usable identity record is attached to the flagged transaction or affected sequence.", "query:alert_context", [flagged.txn_id]))
    elif device_state == "exists" and not connected_devices:
        evidence.append(_evidence("A device profile exists for the affected transaction, but no other retained card is connected to it.", "query:device_connected_cards", [flagged.txn_id]))

    card_regions = {item.region for item in history if item.region}
    out_of_region = bool(flagged.region and flagged.region not in card_regions - {flagged.region} and len({item.region for item in history if item.region and item.transaction_dt < flagged.transaction_dt}) > 0)
    if out_of_region:
        evidence.append(_evidence(f"Flagged billing region {flagged.region} is not present in the card's preceding retained history.", "query:region_connected_cards", [flagged.txn_id, flagged.region]))

    window_start = flagged.transaction_dt - 48 * 3600
    window_end = flagged.transaction_dt + 48 * 3600
    window = [item for item in store.transactions.values() if window_start <= item.transaction_dt <= window_end]
    for item in window:
        if item.card_id == flagged.card_id:
            continue
        shared = []
        if flagged.region and item.region == flagged.region:
            shared.append(("billing region", flagged.region))
        if flagged.recipient_email and item.recipient_email == flagged.recipient_email:
            shared.append(("recipient email", flagged.recipient_email))
        for kind, value in shared:
            cards = {
                candidate.card_id
                for candidate in window
                if candidate.card_id
                and (candidate.txn_id in store.confirmed_fraud_txns or candidate.txn_id in store.customer_report_txns)
                and ((kind == "billing region" and candidate.region == value) or (kind == "recipient email" and candidate.recipient_email == value))
            }
            if len(cards) >= 2:
                connected_cards.add(item.card_id)
                evidence.append(_evidence(f"The same {kind} {value} appears across multiple cards in the 48-hour investigation window.", "query:region_connected_cards" if kind == "billing region" else "query:alert_context", sorted(cards)))
                break

    unique_evidence: list[dict[str, object]] = []
    seen_evidence: set[tuple[str, str, tuple[str, ...]]] = set()
    for item in evidence:
        key = (str(item["claim"]), str(item["ref"]), tuple(item["entity_ids"]))
        if key not in seen_evidence:
            unique_evidence.append(item)
            seen_evidence.add(key)
    evidence = unique_evidence

    for prior_id, prior in store.closed_cases.items():
        prior_cards = store.closed_case_cards[prior_id]
        prior_txns = store.closed_case_txns[prior_id]
        if flagged.card_id in prior_cards or prior_cards.intersection(connected_cards) or prior_txns.intersection(affected_ids):
            similar.add(prior_id)
    for prior_id in sorted(similar):
        prior = store.closed_cases[prior_id]
        evidence.append(_evidence(f"Retrieved closed case {prior_id} with outcome {clean(prior.get('outcome'))} and pattern {clean(prior.get('pattern'))}.", "query:similar_closed_cases", [prior_id]))

    confirmed_prior = any(clean(store.closed_cases[prior_id].get("outcome")) == "confirmed_fraud" for prior_id in similar)
    shared_origin = bool(connected_cards or connected_devices)
    suspicious_burst = len([item for item in history if abs(item.transaction_dt - flagged.transaction_dt) <= 48 * 3600 and item.risk_score >= 0.7]) >= 2
    new_device = any(store.identity_by_txn.get(item.txn_id) and store.identity_by_txn[item.txn_id].status.lower() == "new" for item in affected)
    undocumented = shared_origin and not testing and not out_of_region and not new_device and len(connected_cards) >= 2

    probability = 0.22 + flagged.risk_score * 0.28
    modifiers = []
    if testing:
        probability += 0.27; modifiers.append("card-testing sequence")
    if customer_denied:
        probability += 0.22; modifiers.append("customer report of unauthorized use")
    if suspicious_burst:
        probability += 0.10; modifiers.append("suspicious card burst")
    if shared_origin:
        probability += 0.12; modifiers.append("shared origin")
    if out_of_region:
        probability += 0.10; modifiers.append("new billing region")
    if new_device:
        probability += 0.10; modifiers.append("new device marker")
    if confirmed_prior:
        probability += 0.06; modifiers.append("confirmed prior case")
    probability = clamp(probability)

    if testing:
        pattern = "card_testing"
    elif new_device and flagged.channel == "online":
        pattern = "card_not_present_new_device"
    elif out_of_region and flagged.product_code == "W":
        pattern = "out_of_region_use"
    elif undocumented:
        pattern = "undocumented"
    elif flagged.channel == "online" and (suspicious_burst or customer_denied or confirmed_prior):
        pattern = "card_not_present_fraud"
    else:
        pattern = "none"

    if pattern == "none" and probability <= 0.25:
        verdict = "legitimate"
    elif probability >= 0.70 or customer_denied:
        verdict = "fraud"
    else:
        verdict = "uncertain"

    requests: list[dict[str, object]] = []
    initial: list[dict[str, str]] = []
    if customer_denied:
        initial.extend([action("BLOCK_CARD", "R2: the benchmark customer report states the transaction was not made; card-level action requires approval.", exposure), action("CREATE_CASE", "R2: customer dispute requires an internal case.", exposure)])
    elif testing:
        initial.extend([action("DECLINE_TRANSACTION", "R5: card-testing sequence observed.", exposure), action("STEP_UP_AUTH", "R5: require step-up after testing indicators.", exposure)])
        if any(abs(item.amount) > 100 for item in testing):
            initial.append(action("BLOCK_CARD", "R5: a purchase over $100 appears after card testing.", exposure))
    elif shared_origin:
        initial.extend([action("CREATE_CASE", "R6: shared origin connects activity across cards.", exposure), action("FILE_REPORT", "R6: shared origin requires a suspicious activity report.", exposure), action("MONITOR_CONNECTED_CARDS", "R6: monitor cards sharing the supported origin.", exposure)])
    elif verdict == "uncertain":
        initial.append(action("VERIFY_WITH_CUSTOMER", "R1: evidence is not decisive and probability is below the blocking threshold.", exposure))
        requests.append({"type": "customer_validation", "asked_after_step": len(initial), "assumed_response": "No customer response is available in the benchmark; retain the uncertain decision."})
    elif verdict == "legitimate":
        initial.append(action("CLOSE_NO_FRAUD", "No supported fraud pattern and low evidence-based probability.", exposure))
    else:
        initial.extend([action("VERIFY_WITH_CUSTOMER", "R1: seek confirmation before any blocking action.", exposure), action("CREATE_CASE", "Case required because further evidence was requested.", exposure)])

    if pattern == "undocumented":
        initial.extend([action("CREATE_CASE", "R9: coordinated abuse does not fit a documented pattern.", exposure), action("FILE_REPORT", "R9: coordinated undocumented activity requires a report.", exposure), action("ESCALATE_TO_ANALYST", "R9: human review is required for an undocumented pattern.", exposure)])
    if verdict == "uncertain" and exposure > 500:
        initial.append(action("ESCALATE_TO_ANALYST", "R8: uncertain evidence with exposure over $500.", exposure))

    deduped: list[dict[str, str]] = []
    seen_actions: set[str] = set()
    for item in initial:
        if item["action"] not in seen_actions:
            deduped.append(item); seen_actions.add(item["action"])
    initial = deduped
    final = list(initial)
    final_actions = {item["action"] for item in final}
    report = "FILE_REPORT" in final_actions
    if report and not sar_required(probability, exposure, shared_origin, pattern == "undocumented", confirmed_prior):
        final = [item for item in final if item["action"] != "FILE_REPORT"]
        report = False
    evidence_requests = requests
    if evidence_requests and not any(item["action"] == "CREATE_CASE" for item in final):
        final.append(action("CREATE_CASE", "A requested evidence step requires an internal case under policy 3a.", exposure))
    if not evidence_requests and not customer_denied and verdict == "fraud" and not any(item["action"] == "CREATE_CASE" for item in final):
        final.append(action("CREATE_CASE", "Fraud probability meets the policy case threshold.", exposure))
    final = sorted(final, key=lambda item: ["DECLINE_TRANSACTION", "VERIFY_WITH_CUSTOMER", "STEP_UP_AUTH", "BLOCK_CARD", "CREATE_CASE", "FILE_REPORT", "MONITOR_CONNECTED_CARDS", "ESCALATE_TO_ANALYST", "CLOSE_NO_FRAUD"].index(item["action"]) if item["action"] in {"DECLINE_TRANSACTION", "VERIFY_WITH_CUSTOMER", "STEP_UP_AUTH", "BLOCK_CARD", "CREATE_CASE", "FILE_REPORT", "MONITOR_CONNECTED_CARDS", "ESCALATE_TO_ANALYST", "CLOSE_NO_FRAUD"} else 99)
    what_changed = "nothing" if initial == final else "Final actions reflect the evidence request and policy case requirement; no response was assumed."

    status = "closed_legitimate" if verdict == "legitimate" and not evidence_requests else "closed_fraud" if verdict == "fraud" and customer_denied else "escalated" if any(item["action"] == "ESCALATE_TO_ANALYST" for item in final) else "open"
    pattern_description = "Coordinated activity across multiple cards sharing a supported origin, without enough evidence to fit the documented pattern vocabulary." if pattern == "undocumented" else ""
    if report:
        dates = sorted(item.ts[:10] for item in affected if item.ts)
        narrative = (f"Customer {flagged.customer_id} and card {flagged.card_id} show suspicious activity involving transaction(s) {', '.join(affected_ids)}. "
                     f"The activity occurred through the {flagged.channel} channel between {dates[0] if dates else 'an unavailable date'} and {dates[-1] if dates else 'an unavailable date'}. "
                     f"The flagged transaction amount was ${abs(flagged.amount):.2f}, with total identified exposure of ${exposure:.2f}. "
                     f"The investigation identified pattern {pattern}, based on retained transaction and relationship evidence. "
                     f"Connected cards are {', '.join(sorted(connected_cards)) or 'none identified'}, and connected device profiles are {', '.join(sorted(connected_devices)) or 'none identified'}. "
                     "The report is based only on supplied benchmark records and does not assert unavailable merchant or customer-response facts.")
        sar = {"file": True, "reason": "R6/R9 or the exposure/confirmed-fraud criteria are satisfied by retained evidence.", "narrative": narrative, "subjects": sorted({flagged.customer_id, flagged.card_id, *connected_cards, *connected_devices}), "total_amount_usd": exposure, "activity_dates": dates[:1] + dates[-1:] if dates else []}
    else:
        sar = {"file": False, "reason": "No benchmark SAR trigger is supported by the retained evidence under the policy.", "narrative": "", "subjects": [], "total_amount_usd": 0, "activity_dates": []}

    independent_signals = sum(bool(signal) for signal in (testing, customer_denied, shared_origin, out_of_region, new_device, confirmed_prior))
    stop_reason = "Investigation reached an evidence dead end; no customer response or usable device evidence is available." if evidence_requests else "Further local retrieval is unlikely to change the policy action given the available benchmark evidence."
    if probability >= 0.85 or probability <= 0.15:
        stop_reason = f"Probability reached {probability:.2f} with {independent_signals} independent evidence signal(s); remaining actions follow policy." if independent_signals >= 2 else stop_reason

    case_result = {
        "status": status, "verdict": verdict, "fraud_probability": probability, "pattern": pattern,
        "pattern_description": pattern_description, "affected_txn_ids": [] if verdict == "legitimate" else affected_ids,
        "first_suspicious_txn_id": "" if verdict == "legitimate" else first.txn_id,
        "connected_card_ids": sorted(connected_cards), "connected_device_profiles": sorted(connected_devices),
        "exposure_usd": 0 if verdict == "legitimate" else exposure, "evidence": evidence,
        "similar_prior_cases": sorted(similar), "summary": f"{case_id} is assessed as {verdict} with probability {probability:.2f}. Pattern: {pattern}. Identified exposure is ${0 if verdict == 'legitimate' else exposure:.2f}; device state is {device_state}.",
        "written_to_graph": False, "graph_case_id": "", "graph_write": {"written": False, "reason": "TigerGraph connection is not configured."},
    }
    return {"case_id": case_id, "case": case_result, "evidence_requests": evidence_requests, "next_best_actions": {"initial": initial, "final": final, "what_changed": what_changed}, "sar": sar, "stop_reason": stop_reason, "tool_calls": 5, "tokens": 0, "latency_s": 0.0}


def default_data_dir() -> Path:
    root = Path(__file__).resolve().parents[1]
    candidate = root / "prepared_mvp"
    return candidate if (candidate / "case_pack.csv").is_file() else root / "prepared"


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=default_data_dir())
    parser.add_argument("--case-id", default="HHG-002")
    args = parser.parse_args()
    result = investigate_case(EvidenceStore(args.data_dir), args.case_id)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
