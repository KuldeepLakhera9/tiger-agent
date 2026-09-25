"""FastAPI application for FRAUDGRAPH investigation command center."""

from __future__ import annotations
import os
from typing import Any, Dict, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .case_service import CaseService
from .models import (
    AnalyticsOverview,
    BenchmarkCase,
    CaseActionRequest,
    CaseActionResponse,
    CaseSummary,
    GraphResponse,
    InvestigateRequest,
    TimelineEvent,
)
from .tigergraph_client import TigerGraphClient

app = FastAPI(
    title="FRAUDGRAPH API",
    description="Explainable fraud-investigation command center powered by TigerGraph and GraphRAG.",
    version="1.0.0",
)

# Enable CORS for all origins so Vercel frontend and local development work out of the box
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

tigergraph_client = TigerGraphClient()
case_service = CaseService(tigergraph_client=tigergraph_client)


@app.get("/api/health")
def get_health() -> Dict[str, Any]:
    tg_status = tigergraph_client.get_connection_status()
    cases_count = len(case_service.list_cases())
    return {
        "status": "healthy",
        "service": "FRAUDGRAPH API",
        "cases_loaded": cases_count,
        "tigergraph": tg_status,
        "mode": "live_tigergraph" if tg_status.get("connected") else "deterministic_benchmark",
    }


@app.get("/api/cases", response_model=List[CaseSummary])
def list_cases() -> List[CaseSummary]:
    return case_service.list_cases()


@app.get("/api/cases/{case_id}", response_model=BenchmarkCase)
def get_case(case_id: str) -> BenchmarkCase:
    item = case_service.get_case(case_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found.")
    return item


@app.post("/api/cases/{case_id}/action", response_model=CaseActionResponse)
def execute_case_action(case_id: str, req: CaseActionRequest) -> CaseActionResponse:
    try:
        return case_service.execute_action(case_id, req)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute action: {str(e)}")


@app.post("/api/cases/{case_id}/lifecycle")
def update_case_lifecycle(case_id: str, payload: Dict[str, str]) -> Dict[str, Any]:
    stage = payload.get("stage")
    actor = payload.get("actor", "Fraud Analyst")
    if not stage:
        raise HTTPException(status_code=400, detail="Missing 'stage' in request body.")
    try:
        evt = case_service.update_lifecycle_stage(case_id, stage, actor)
        return {"success": True, "case_id": case_id, "lifecycle_stage": stage.upper(), "audit_event": evt}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/cases/{case_id}/reset")
def reset_case_state(case_id: str) -> Dict[str, Any]:
    case_service.reset_case(case_id)
    item = case_service.get_case(case_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found.")
    return {"success": True, "case_id": case_id, "message": "Case reset to initial benchmark state.", "case": item}


@app.post("/api/investigate", response_model=BenchmarkCase)
def run_investigation(req: InvestigateRequest) -> BenchmarkCase:
    target_id = req.case_id
    if not target_id and req.transaction_id:
        for c in case_service.list_cases():
            if c.transaction == req.transaction_id:
                target_id = c.case_id
                break
    if not target_id:
        target_id = "HHG-002"

    item = case_service.get_case(target_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Investigation target {target_id} not found.")
    return item


@app.get("/api/cases/{case_id}/graph", response_model=GraphResponse)
def get_case_graph(case_id: str) -> GraphResponse:
    graph = case_service.get_graph(case_id)
    if not graph:
        raise HTTPException(status_code=404, detail=f"Graph for case {case_id} not found.")
    return graph


@app.get("/api/cases/{case_id}/evidence")
def get_case_evidence(case_id: str) -> Dict[str, Any]:
    item = case_service.get_case(case_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found.")
    return {
        "case_id": case_id,
        "evidence": item.case.evidence,
        "evidence_requests": item.evidence_requests,
        "stop_reason": item.stop_reason,
        "tool_calls": item.tool_calls,
    }


@app.get("/api/cases/{case_id}/timeline", response_model=List[TimelineEvent])
def get_case_timeline(case_id: str) -> List[TimelineEvent]:
    timeline = case_service.get_timeline(case_id)
    if not timeline:
        raise HTTPException(status_code=404, detail=f"Timeline for case {case_id} not found.")
    return timeline


@app.get("/api/analytics", response_model=AnalyticsOverview)
def get_analytics() -> AnalyticsOverview:
    return case_service.get_analytics()


@app.get("/api/historical")
def get_historical_cases() -> List[Dict[str, Any]]:
    return case_service.get_historical_cases()


# Optional: Mount frontend build if available for all-in-one container deployment
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(frontend_dist):
    from fastapi.staticfiles import StaticFiles
    from starlette.responses import FileResponse

    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(frontend_dist, full_path)
        if full_path and os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)
