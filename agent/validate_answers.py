"""Recompute and validate deterministic benchmark answer files."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from investigate import EvidenceStore, Transaction, card_testing_sequence, default_data_dir, sar_required


REQUIRED_CASE_FIELDS = {
    "status", "verdict", "fraud_probability", "pattern", "pattern_description",
    "affected_txn_ids", "first_suspicious_txn_id", "connected_card_ids",
    "connected_device_profiles", "exposure_usd", "evidence", "similar_prior_cases",
    "summary", "written_to_graph", "graph_case_id",
}
REQUIRED_TOP_FIELDS = {"case_id", "case", "evidence_requests", "next_best_actions", "sar", "stop_reason", "tool_calls", "tokens", "latency_s"}


def internal_tests() -> None:
    fixture = [
        Transaction("small-1", "C", "C-K1", "2016-01-01 00:00:00", 0, 1, 0.1, "online", "C", "", "", "", ""),
        Transaction("small-2", "C", "C-K1", "2016-01-01 00:20:00", 1200, 2, 0.1, "online", "C", "", "", "", ""),
        Transaction("large", "C", "C-K1", "2016-01-01 00:30:00", 1800, 150, 0.1, "online", "C", "", "", "", ""),
    ]
    sequence = card_testing_sequence(fixture, fixture[-1])
    assert [item.txn_id for item in sequence] == ["small-1", "small-2", "large"]
    assert round(sum(abs(item.amount) for item in sequence), 2) == 153.0
    assert sar_required(0.90, 1500, False, False, False) is True


def validate(data_dir: Path, output_dir: Path, case_id: str | None = None) -> list[str]:
    internal_tests()
    store = EvidenceStore(data_dir)
    expected = {row["case_id"]: row for row in store.case_pack}
    files = sorted(output_dir.glob("HHG-*.json"))
    if case_id:
        files = [output_dir / f"{case_id}.json"]
    errors: list[str] = []
    if not case_id and len(files) != 20:
        errors.append(f"expected exactly 20 output files, found {len(files)}")
    if case_id and not files[0].is_file():
        errors.append(f"missing output for {case_id}")
    for path in files:
        try:
            result = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"{path.name}: invalid JSON: {exc}")
            continue
        current_id = result.get("case_id")
        if current_id != path.stem:
            errors.append(f"{path.name}: case_id does not match filename")
        if current_id not in expected:
            errors.append(f"{path.name}: case ID is not in case pack")
            continue
        missing = REQUIRED_TOP_FIELDS - set(result)
        missing_case = REQUIRED_CASE_FIELDS - set(result.get("case", {}))
        if missing:
            errors.append(f"{path.name}: missing top-level fields {sorted(missing)}")
        if missing_case:
            errors.append(f"{path.name}: missing case fields {sorted(missing_case)}")
        case = result.get("case", {})
        transaction_ids = set(store.transactions)
        affected = case.get("affected_txn_ids", [])
        unknown = [txn_id for txn_id in affected if txn_id not in transaction_ids]
        if unknown:
            errors.append(f"{path.name}: unknown affected transactions {unknown[:3]}")
        recomputed = round(sum(abs(store.transactions[txn_id].amount) for txn_id in affected if txn_id in transaction_ids), 2)
        if round(float(case.get("exposure_usd", -1)), 2) != recomputed:
            errors.append(f"{path.name}: exposure mismatch, output={case.get('exposure_usd')} recomputed={recomputed}")
        probability = case.get("fraud_probability")
        if not isinstance(probability, (int, float)) or not 0 <= probability <= 1:
            errors.append(f"{path.name}: fraud_probability outside [0,1]")
        flagged_id = expected[current_id]["flagged_txn_id"]
        if case.get("verdict") != "legitimate" and flagged_id not in affected:
            errors.append(f"{path.name}: flagged transaction missing from affected list")
        final_actions = result.get("next_best_actions", {}).get("final", [])
        final_names = {item.get("action") for item in final_actions}
        sar = result.get("sar", {})
        if bool(sar.get("file")) != ("FILE_REPORT" in final_names):
            errors.append(f"{path.name}: SAR/action mismatch")
        if sar.get("file") and (not sar.get("narrative") or not sar.get("activity_dates")):
            errors.append(f"{path.name}: filed SAR lacks narrative or dates")
        if not sar.get("file") and (sar.get("narrative") or sar.get("subjects") or sar.get("total_amount_usd")):
            errors.append(f"{path.name}: non-filed SAR contains report content")
        for card_id in case.get("connected_card_ids", []):
            if card_id not in store.transactions_by_card:
                errors.append(f"{path.name}: connected card is not in supplied transactions: {card_id}")
        known_profiles = {identity.profile for identity in store.identity_by_txn.values()}
        for profile in case.get("connected_device_profiles", []):
            if profile not in known_profiles:
                errors.append(f"{path.name}: connected device profile is not in supplied identity data")
        if current_id == "HHG-002":
            claims = " ".join(item.get("claim", "") for item in case.get("evidence", []))
            if case.get("connected_device_profiles") != []:
                errors.append("HHG-002: connected_device_profiles must be []")
            if "device evidence unavailable" not in claims.lower():
                errors.append("HHG-002: missing-device evidence is not explicit")
            if "shared device" in claims.lower() or "shared device" in case.get("summary", "").lower():
                errors.append("HHG-002: unsupported shared-device claim")
    return errors


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=default_data_dir())
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).resolve().parents[1] / "cases")
    parser.add_argument("--case-id")
    args = parser.parse_args()
    failures = validate(args.data_dir, args.output_dir, args.case_id)
    if failures:
        print("VALIDATION FAILED")
        print("\n".join(f"- {failure}" for failure in failures))
        raise SystemExit(1)
    print(f"VALIDATION PASSED: {1 if args.case_id else 20} case output(s)")