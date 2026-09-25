"""API test suite for FRAUDGRAPH FastAPI endpoints."""

import sys
import unittest
from pathlib import Path

# Ensure project root is in sys.path
root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

from fastapi.testclient import TestClient
from backend.main import app
from backend.tigergraph_client import TigerGraphClient


class TestBackendAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_health_endpoint(self):
        resp = self.client.get("/api/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data.get("status"), "healthy")
        self.assertEqual(data.get("cases_loaded"), 20)
        self.assertIn("tigergraph", data)
        self.assertIn("mode", data)

    def test_list_cases(self):
        resp = self.client.get("/api/cases")
        self.assertEqual(resp.status_code, 200)
        cases = resp.json()
        self.assertEqual(len(cases), 20)
        case_ids = {c["case_id"] for c in cases}
        self.assertIn("HHG-001", case_ids)
        self.assertIn("HHG-002", case_ids)
        self.assertIn("HHG-020", case_ids)

    def test_get_case_hhg002(self):
        resp = self.client.get("/api/cases/HHG-002")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["case_id"], "HHG-002")
        self.assertEqual(data["case"]["connected_device_profiles"], [])
        self.assertEqual(data["case"]["pattern"], "card_not_present_fraud")
        self.assertAlmostEqual(data["case"]["fraud_probability"], 0.50, places=2)

    def test_get_case_not_found(self):
        resp = self.client.get("/api/cases/NON-EXISTENT-999")
        self.assertEqual(resp.status_code, 404)

    def test_get_case_graph_hhg002(self):
        resp = self.client.get("/api/cases/HHG-002/graph")
        self.assertEqual(resp.status_code, 200)
        graph = resp.json()
        self.assertEqual(graph["case_id"], "HHG-002")
        self.assertFalse(graph["has_device"])
        self.assertEqual(graph["device_status"], "Device evidence unavailable")
        device_nodes = [n for n in graph["nodes"] if n["type"] == "Device"]
        self.assertEqual(len(device_nodes), 0)

    def test_get_case_timeline(self):
        resp = self.client.get("/api/cases/HHG-002/timeline")
        self.assertEqual(resp.status_code, 200)
        events = resp.json()
        self.assertGreater(len(events), 0)
        self.assertEqual(events[0]["type"], "alert")

    def test_get_case_evidence(self):
        resp = self.client.get("/api/cases/HHG-002/evidence")
        self.assertEqual(resp.status_code, 200)
        ev_data = resp.json()
        self.assertEqual(ev_data["case_id"], "HHG-002")
        self.assertIn("evidence", ev_data)
        self.assertGreater(len(ev_data["evidence"]), 0)

    def test_get_analytics(self):
        resp = self.client.get("/api/analytics")
        self.assertEqual(resp.status_code, 200)
        analytics = resp.json()
        self.assertEqual(analytics["total_cases"], 20)
        self.assertGreater(analytics["total_exposure"], 0)
        self.assertGreaterEqual(analytics["suspected_fraud_cases"], 0)

    def test_get_historical_cases(self):
        resp = self.client.get("/api/historical")
        self.assertEqual(resp.status_code, 200)
        cases = resp.json()
        self.assertIsInstance(cases, list)
        self.assertGreater(len(cases), 0)

    def test_execute_case_action_verify_customer(self):
        resp = self.client.post(
            "/api/cases/HHG-002/action",
            json={"action": "VERIFY_WITH_CUSTOMER", "actor": "Fraud Analyst (L1)"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["case_id"], "HHG-002")
        self.assertEqual(data["action"], "VERIFY_WITH_CUSTOMER")
        self.assertEqual(data["lifecycle_stage"], "REVIEW")
        self.assertIn("Controlled Action", data["audit_event"]["title"])

        # Verify that timeline now has the new audit event
        t_resp = self.client.get("/api/cases/HHG-002/timeline")
        self.assertEqual(t_resp.status_code, 200)
        events = t_resp.json()
        self.assertTrue(any("Customer Verification" in e["title"] for e in events))

    def test_update_case_lifecycle(self):
        resp = self.client.post(
            "/api/cases/HHG-002/lifecycle",
            json={"stage": "ACTION_APPROVED", "actor": "Fraud Lead"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["lifecycle_stage"], "ACTION_APPROVED")

        # Verify case reflects updated stage
        c_resp = self.client.get("/api/cases/HHG-002")
        self.assertEqual(c_resp.status_code, 200)
        self.assertEqual(c_resp.json()["lifecycle_stage"], "ACTION_APPROVED")

    def test_reset_case_state(self):
        resp = self.client.post("/api/cases/HHG-002/reset")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])

        # Stage is reset to ACTION_RECOMMENDED
        c_resp = self.client.get("/api/cases/HHG-002")
        self.assertEqual(c_resp.json()["lifecycle_stage"], "ACTION_RECOMMENDED")

    def test_investigate_endpoint(self):
        resp = self.client.post(
            "/api/investigate",
            json={"case_id": "HHG-002"},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["case_id"], "HHG-002")

        resp_txn = self.client.post(
            "/api/investigate",
            json={"transaction_id": "3478782"},
        )
        self.assertEqual(resp_txn.status_code, 200)
        self.assertEqual(resp_txn.json()["case_id"], "HHG-002")

    def test_tigergraph_client_fallback_resilience(self):
        client = TigerGraphClient()
        status = client.get_connection_status()
        self.assertIn("configured", status)
        self.assertIn("connected", status)
        # Querying an unconfigured client should return None cleanly without exceptions
        res = client.run_query("alert_context", {"txn_id": "123"})
        self.assertIsNone(res)


if __name__ == "__main__":
    unittest.main()
