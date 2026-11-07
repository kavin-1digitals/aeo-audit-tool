"""Competitor tab endpoints (technical audit in the background + AI visibility from stored prompts)."""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from src.api.runs import get_service
from src.services.competitor_comparison_service import ComparisonError, CompetitorComparisonService
from src.storage import NotFound

router = APIRouter(prefix="/aeo-audit-tool/api")

_service: CompetitorComparisonService | None = None


def get_comparison_service() -> CompetitorComparisonService:
    global _service
    if _service is None:
        runs = get_service()
        _service = CompetitorComparisonService(runs.storage, runs.executor)
    return _service


class AddCompetitorRequest(BaseModel):
    name: str
    domain: str
    refresh: bool = False


def _raise(exc: Exception):
    if isinstance(exc, NotFound):
        raise HTTPException(status_code=404, detail="Not found")
    if isinstance(exc, ComparisonError):
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)
    raise exc


@router.get("/runs/{run_id}/competitors")
async def list_competitors(run_id: str, include_scores: bool = Query(True)):
    try:
        return get_comparison_service().overview(run_id, include_scores)
    except (NotFound, ComparisonError) as exc:
        _raise(exc)


@router.post("/runs/{run_id}/competitors")
async def add_competitor(run_id: str, body: AddCompetitorRequest):
    """Returns immediately: 202 while the technical audit runs in the background, 200 when it was reused."""
    svc = get_comparison_service()
    try:
        row, started = svc.add(run_id, body.name, body.domain, body.refresh)
    except (NotFound, ComparisonError) as exc:
        _raise(exc)
    return JSONResponse(status_code=202 if started else 200,
                        content={"comparison_id": row.comparison_id, "status": row.status.value,
                                 "reused_snapshot": row.reused_snapshot})


class CarryOverRequest(BaseModel):
    from_run_id: str | None = None


@router.post("/runs/{run_id}/competitors/carry-over")
async def carry_over_competitors(run_id: str, body: CarryOverRequest | None = None):
    """Copy the competitors of the brand's earlier audit into this run (fresh snapshots are reused)."""
    try:
        return get_comparison_service().carry_over(run_id, body.from_run_id if body else None)
    except (NotFound, ComparisonError) as exc:
        _raise(exc)


@router.delete("/runs/{run_id}/competitors/{comparison_id}")
async def remove_competitor(run_id: str, comparison_id: str):
    try:
        get_comparison_service().remove(run_id, comparison_id)
    except (NotFound, ComparisonError) as exc:
        _raise(exc)
    return {"removed": True}
