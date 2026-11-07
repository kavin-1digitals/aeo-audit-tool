"""Request/response models of the public API (moved out of main.py unchanged, plus ``mode``)."""
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, HttpUrl

from src.scorecard import ProblemCard, ScoreCard
from src.signals import Signals
from src.summary import Summary


class AuditRequest(BaseModel):
    domain: HttpUrl
    brand: str
    geo: Optional[str] = "Not Specified"
    site_types: Optional[List[str]] = None
    # "new": always start a fresh run (default). "reuse_latest": return the brand's latest stored run if any.
    mode: Literal["new", "reuse_latest"] = "new"


class AuditResponse(BaseModel):
    task_id: str
    domain: str
    brand: str
    geo: Optional[str] = "Not Specified"
    status: str
    message: str
    signals: Optional[Signals] = None
    scorecard: ScoreCard
    problemcard: Optional[ProblemCard] = None
    summary: Summary
    quick_remediations: Optional[Dict[str, Any]] = None


class StartAuditResponse(BaseModel):
    run_id: str
    status: str
    reused: bool = False         # an already stored completed run was returned (mode="reuse_latest")
    reused_active: bool = False  # an identical run is already in progress; no second run was started
