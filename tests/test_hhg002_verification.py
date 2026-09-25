"""Explicit verification of HHG-002 requirements."""

import json
import sys
import unittest
from pathlib import Path

# Ensure project root is in sys.path for direct execution and discovery
root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

from backend.case_service import CaseService


def verify_hhg002():
    case_file = root / "cases" / "HHG-002.json"
    assert case_file.is_file(), "HHG-002.json must exist"

    raw = json.loads(case_file.read_text(encoding="utf-8"))
    assert raw["case_id"] == "HHG-002"

    service = CaseService(root)
    case_summary = next(c for c in service.list_cases() if c.case_id == "HHG-002")
    case_detail = service.get_case("HHG-002")
    assert case_detail is not None

    # 1. Transaction == 3478782
    assert case_summary.transaction == "3478782", f"Expected 3478782, got {case_summary.transaction}"
    assert "3478782" in case_detail.case.affected_txn_ids

    # 2. Customer == C11891
    assert case_summary.customer == "C11891", f"Expected C11891, got {case_summary.customer}"

    # 3. Amount == 292.36
    assert abs(case_summary.amount - 292.36) < 1e-4, f"Expected 292.36, got {case_summary.amount}"

    # 4. Connected devices MUST remain []
    assert case_detail.case.connected_device_profiles == [], (
        f"connected_devices must be [], got {case_detail.case.connected_device_profiles}"
    )

    # 5. Graph verification
    graph = service.get_graph("HHG-002")
    assert graph is not None
    assert graph.has_device is False, "has_device must be False for HHG-002"
    assert graph.device_status == "Device evidence unavailable"
    device_nodes = [n for n in graph.nodes if n.type == "Device"]
    assert len(device_nodes) == 0, f"No device nodes allowed for HHG-002, found {device_nodes}"

    # 6. UI textual validation in claims and summary
    claims = " ".join(e.claim.lower() for e in case_detail.case.evidence)
    assert "device evidence unavailable" in claims, "Missing explicit 'device evidence unavailable' in claims"
    assert "shared device" not in claims, "Forbidden 'shared device' claim in HHG-002 claims"
    assert "shared device" not in case_detail.case.summary.lower(), "Forbidden 'shared device' in summary"


class TestHHG002Verification(unittest.TestCase):
    def test_hhg002(self):
        verify_hhg002()


def test_hhg002():
    verify_hhg002()


if __name__ == "__main__":
    verify_hhg002()
    print("ALL HHG-002 SPECIAL VALIDATION CHECKS PASSED PERFECTLY!")
