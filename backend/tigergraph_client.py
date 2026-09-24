"""TigerGraph REST++ client for FRAUDGRAPH investigation engine."""

from __future__ import annotations
import os
import logging
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

    def get_connection_status(self) -> Dict[str, Any]:
        if not self.is_configured:
            return {
                "configured": False,
                "connected": False,
                "graph": self.graph,
                "host": self.host or "Not configured",
                "message": "TigerGraph credentials not provided. Using deterministic benchmark case store.",
            }

        try:
            headers = {}
            if self.token:
                headers["Authorization"] = f"Bearer {self.token}"
            url = f"{self.host}/echo"
            resp = requests.get(url, headers=headers, timeout=3)
            if resp.status_code == 200:
                return {
                    "configured": True,
                    "connected": True,
                    "graph": self.graph,
                    "host": self.host,
                    "message": "Connected to TigerGraph instance.",
                }
            return {
                "configured": True,
                "connected": False,
                "graph": self.graph,
                "host": self.host,
                "message": f"TigerGraph returned status {resp.status_code}. Using benchmark fallback.",
            }
        except Exception as exc:
            return {
                "configured": True,
                "connected": False,
                "graph": self.graph,
                "host": self.host,
                "message": f"Connection error: {str(exc)}. Using benchmark fallback.",
            }

    def run_query(self, query_name: str, params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not self.is_configured:
            return None

        url = f"{self.host}/query/{self.graph}/{query_name}"
        headers = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        auth = (self.username, self.password) if (self.username and self.password and not self.token) else None
        try:
            resp = requests.get(url, params=params, headers=headers, auth=auth, timeout=10)
            if resp.status_code == 200:
                return resp.json()
            logger.warning("Query %s returned code %s: %s", query_name, resp.status_code, resp.text)
            return None
        except Exception as exc:
            logger.warning("Query %s failed: %s", query_name, exc)
            return None
