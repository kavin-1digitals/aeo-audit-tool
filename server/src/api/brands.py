"""Brand and run-history endpoints (stored audits, "use stored / run new")."""
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from src.api.runs import get_service
from src.services.visibility_service import VisibilityService
from src.storage.ids import clean_name

router = APIRouter(prefix="/aeo-audit-tool/api")


@router.get("/brands")
async def list_brands(
    name: Optional[str] = Query(None, description="exact brand name (trimmed, case-sensitive)"),
    q: Optional[str] = Query(None, description="case-insensitive name prefix"),
    limit: int = Query(20, ge=1, le=100),
):
    svc = get_service()
    if name is not None:
        brand = svc.storage.brands.get_by_name(clean_name(name))
        return [svc.brand_overview(brand)] if brand else []
    return [svc.brand_overview(b) for b in svc.storage.brands.search(q or "", limit)]


@router.get("/brands/{brand_id}")
async def get_brand(brand_id: str):
    svc = get_service()
    brand = svc.storage.brands.get(brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    return svc.brand_overview(brand)


@router.get("/brands/{brand_id}/runs")
async def brand_runs(brand_id: str, limit: int = Query(50, ge=1, le=200)):
    svc = get_service()
    if not svc.storage.brands.get(brand_id):
        raise HTTPException(status_code=404, detail="Brand not found")
    return [svc.run_summary(r) for r in svc.storage.runs.list_for_brand(brand_id, limit)]


@router.get("/brands/{brand_id}/competitors")
async def brand_competitors(brand_id: str):
    svc = get_service()
    if not svc.storage.brands.get(brand_id):
        raise HTTPException(status_code=404, detail="Brand not found")
    return [c.model_dump() for c in svc.storage.competitors.list_for_brand(brand_id)]


@router.get("/brands/{brand_id}/visibility-trend")
async def brand_visibility_trend(brand_id: str):
    """The brand's AI visibility (SOV, citations, cluster coverage) at each stored run, oldest first."""
    svc = get_service()
    if not svc.storage.brands.get(brand_id):
        raise HTTPException(status_code=404, detail="Brand not found")
    return VisibilityService(svc.storage).trend_for_brand(brand_id)
