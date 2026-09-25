"""TigerGraph REST++ client for FRAUDGRAPH investigation engine."""

from __future__ import annotations
import logging
import os
import time
from typing import Any, Dict, Optional
import requests
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("tigergraph")


class TigerGraphClient:
    def __init__(self):
        self.host = (os.getenv("TIGERGRAPH_HOST") or os.getenv("TG_HOST") or "").rstrip("/")
        self.graph = os.getenv("TIGERGRAPH_GRAPH") or os.getenv("TG_GRAPHNAME") or "FraudInvestigation"
        self.token = os.getenv("TIGERGRAPH_TOKEN") or os.getenv("TG_API_TOKEN") or ""
        self.username = os.getenv("TIGERGRAPH_USERNAME") or ""
        self.password = os.getenv("TIGERGRAPH_PASSWORD") or ""

    @property
    def is_configured(self) -> bool:
        return bool(self.host and (self.token or (self.username and self.password)))

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def _get_auth(self) -> Optional[tuple]:
        if self.username and self.password and not self.token:
            return (self.username, self.password)
        return None

    def get_connection_status(self) -> Dict[str, Any]:
        if not self.is_configured:
            return {
                "configured": False,
                "connected": False,
                "graph": self.graph,
                "host": self.host or "Not configured",
                "message": "TigerGraph host or credentials not configured. Using deterministic benchmark case store.",
            }

        headers = self._get_headers()
        auth = self._get_auth()

        # Try /echo then /restpp/echo for TigerGraph Cloud compatibility
        for echo_path in ["/echo", "/restpp/echo"]:
            url = f"{self.host}{echo_path}"
            try:
                t0 = time.perf_counter()
                resp = requests.get(url, headers=headers, auth=auth, timeout=3)
                latency_ms = round((time.perf_counter() - t0) * 1000, 2)
                if resp.status_code == 200:
                    return {
                        "configured": True,
                        "connected": True,
                        "graph": self.graph,
                        "host": self.host,
                        "latency_ms": latency_ms,
                        "message": f"Connected to TigerGraph instance ({echo_path} ok).",
                    }
            except Exception:
                continue

        return {
            "configured": True,
            "connected": False,
            "graph": self.graph,
            "host": self.host,
            "message": "TigerGraph host unreachable or returned non-200. Using benchmark fallback.",
        }

    def run_query(self, query_name: str, params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not self.is_configured:
            return None

        headers = self._get_headers()
        auth = self._get_auth()

        endpoints = [
            f"{self.host}/query/{self.graph}/{query_name}",
            f"{self.host}/restpp/query/{self.graph}/{query_name}",
        ]

        for url in endpoints:
            try:
                t0 = time.perf_counter()
                resp = requests.get(url, params=params, headers=headers, auth=auth, timeout=10)
                latency_ms = round((time.perf_counter() - t0) * 1000, 2)
                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        "results": data.get("results", []),
                        "raw": data,
                        "latency_ms": latency_ms,
                        "query": query_name,
                        "status": "success",
                    }
                logger.warning("Query %s via %s returned code %s: %s", query_name, url, resp.status_code, resp.text)
            except Exception as exc:
                logger.warning("Query %s via %s failed: %s", query_name, url, exc)

        return None

    def persist_fraud_case(self, case_id: str, case_payload: Dict[str, Any]) -> Dict[str, Any]:
        """Write completed investigation back to TigerGraph as a FraudCase vertex with edges."""
        if not self.is_configured:
            return {
                "success": False,
                "written": False,
                "case_id": case_id,
                "reason": "TigerGraph host or token not configured. Write-back skipped.",
            }

        headers = self._get_headers()
        auth = self._get_auth()

        # Build vertex and edge upsert payload
        graph_case_id = f"CASE-{case_id}"
        txn_id = str(case_payload.get("flagged_txn_id") or "")
        card_id = str(case_payload.get("card_id") or "")
        cust_id = str(case_payload.get("customer_id") or "")

        payload = {
            "vertices": {
                "FraudCase": {
                    graph_case_id: {
                        "case_id": {"value": case_id},
                        "customer_id": {"value": cust_id},
                        "card_id": {"value": card_id},
                        "flagged_txn_id": {"value": txn_id},
                        "opened_at": {"value": case_payload.get("opened_at", "")},
                        "trigger_type": {"value": case_payload.get("trigger_type", "risk_score")},
                        "trigger_text": {"value": case_payload.get("trigger_text", "")[:500]},
                        "trigger_risk_score": {"value": float(case_payload.get("risk_score", 0.0))},
                        "status": {"value": case_payload.get("status", "open")},
                        "verdict": {"value": case_payload.get("verdict", "uncertain")},
                        "fraud_probability": {"value": float(case_payload.get("fraud_probability", 0.5))},
                        "pattern": {"value": case_payload.get("pattern", "card_not_present_fraud")},
                        "exposure_usd": {"value": float(case_payload.get("exposure_usd", 0.0))},
                        "summary": {"value": case_payload.get("summary", "")[:500]},
                        "written_to_graph": {"value": True},
                    }
                }
            },
            "edges": {
                "FraudCase": {
                    graph_case_id: {
                        "INVESTIGATES": {
                            "Transaction": {
                                txn_id: {}
                            }
                        } if txn_id else {},
                        "CASE_ON_CARD": {
                            "Card": {
                                card_id: {}
                            }
                        } if card_id else {},
                    }
                }
            },
        }

        endpoints = [
            f"{self.host}/graph/{self.graph}",
            f"{self.host}/restpp/graph/{self.graph}",
        ]

        for url in endpoints:
            try:
                t0 = time.perf_counter()
                resp = requests.post(url, json=payload, headers=headers, auth=auth, timeout=10)
                latency_ms = round((time.perf_counter() - t0) * 1000, 2)
                if resp.status_code == 200:
                    data = resp.json()
                    if not data.get("error", True):
                        return {
                            "success": True,
                            "written": True,
                            "case_id": case_id,
                            "graph_case_id": graph_case_id,
                            "latency_ms": latency_ms,
                            "message": f"Successfully persisted FraudCase vertex and edges to TigerGraph ({graph_case_id}).",
                            "response": data,
                        }
            except Exception as exc:
                logger.warning("Persist %s via %s failed: %s", case_id, url, exc)

        return {
            "success": False,
            "written": False,
            "case_id": case_id,
            "reason": "TigerGraph server rejected or timed out writing FraudCase vertex. Graph write skipped.",
        }

