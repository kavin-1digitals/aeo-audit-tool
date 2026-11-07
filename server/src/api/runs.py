"""Audit run endpoints: start (async), poll status, fetch the finished report, cancel."""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from src.api.schemas import AuditRequest, StartAuditResponse
from src.services.audit_run_service import AuditRunService, RunActiveError
from src.services.visibility_service import VisibilityService
from src.storage import NotFound, get_storage

router = APIRouter(prefix="/aeo-audit-tool/api")

_service: AuditRunService | None = None


def get_service() -> AuditRunService:
    global _service
    if _service is None:
        _service = AuditRunService(get_storage())
    return _service


@router.post("/audit", response_model=StartAuditResponse)
async def start_audit(request: AuditRequest):
    """Start an audit and return immediately; poll ``/runs/{run_id}/status`` for progress."""
    try:
        result = get_service().start(
            str(request.domain), request.brand, request.geo, request.site_types, request.mode,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    body = StartAuditResponse(
        run_id=result.run.run_id, status=result.run.status.value,
        reused=result.reused, reused_active=result.reused_active,
    )
    return JSONResponse(status_code=202 if result.created else 200, content=body.model_dump())


@router.get("/runs/{run_id}/status")
async def run_status(run_id: str, since_seq: int = Query(0, ge=0)):
    try:
        return get_service().status(run_id, since_seq)
    except NotFound:
        raise HTTPException(status_code=404, detail="Run not found")


@router.get("/runs/{run_id}")
async def run_report(run_id: str):
    service = get_service()
    run = service.storage.runs.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    report = service.get_report(run_id)
    if report is None:
        raise HTTPException(status_code=409, detail=f"Report not available (run status: {run.status.value})")
    return report


@router.post("/runs/{run_id}/cancel")
async def cancel_run(run_id: str):
    try:
        return {"cancelled": get_service().cancel(run_id)}
    except NotFound:
        raise HTTPException(status_code=404, detail="Run not found")


@router.delete("/runs/{run_id}")
async def delete_run(run_id: str):
    try:
        get_service().delete_run(run_id)
    except NotFound:
        raise HTTPException(status_code=404, detail="Run not found")
    except RunActiveError:
        raise HTTPException(status_code=409, detail="Run is still in progress; cancel it first")
    return {"deleted": True}


@router.get("/runs/{run_id}/prompts")
async def run_prompts(run_id: str):
    """Prompts Lab data: every prompt with its web / AI-model answer and who was mentioned (no AI calls)."""
    svc = get_service()
    if not svc.storage.runs.get(run_id):
        raise HTTPException(status_code=404, detail="Run not found")
    matrix = VisibilityService(svc.storage).prompt_matrix(run_id)
    if matrix is None:
        return {"run_id": run_id, "available": False, "entities": [], "clusters": [], "prompt_count": 0}
    return {**matrix, "available": True}
