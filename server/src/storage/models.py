"""Row models - one class per table, 1:1 with the logical schema in COMPETITOR_AUDIT_PLAN.md.

They are plain pydantic models so the same classes can later back SQLAlchemy/Alembic tables.
"""
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from .ids import utcnow

SCHEMA_VERSION = 1


class RunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    COMPLETED_WITH_WARNINGS = "completed_with_warnings"
    FAILED = "failed"
    CANCELLED = "cancelled"

    @property
    def is_active(self) -> bool:
        return self in (RunStatus.PENDING, RunStatus.RUNNING)

    @property
    def is_terminal(self) -> bool:
        return not self.is_active


class StageStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    SKIPPED = "skipped"
    FAILED = "failed"


class BrandRow(BaseModel):
    brand_id: str
    name: str  # exactly as typed (trimmed only), unique
    created_at: str = Field(default_factory=utcnow)
    updated_at: str = Field(default_factory=utcnow)
    schema_version: int = SCHEMA_VERSION


class SiteRow(BaseModel):
    site_id: str
    domain: str  # normalised host, unique
    first_seen_at: str = Field(default_factory=utcnow)
    schema_version: int = SCHEMA_VERSION


class AuditRunRow(BaseModel):
    run_id: str
    brand_id: str
    site_id: str
    requested_url: str
    geo: Optional[str] = None
    site_types: List[str] = Field(default_factory=list)

    status: RunStatus = RunStatus.PENDING
    mode: str = "new"
    stage_key: Optional[str] = None
    progress_pct: float = 0.0

    # Unique while the run is pending/running (idempotent start), None afterwards.
    active_key: Optional[str] = None

    percentage: Optional[float] = None
    technical_percentage: Optional[float] = None
    warnings: List[str] = Field(default_factory=list)

    requested_at: str = Field(default_factory=utcnow)
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    heartbeat_at: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None

    site_snapshot_id: Optional[str] = None
    prompt_set_id: Optional[str] = None
    report_blob_key: Optional[str] = None
    pipeline_version: Optional[str] = None
    schema_version: int = SCHEMA_VERSION


class RunStageRow(BaseModel):
    run_id: str
    stage_key: str
    lane: str
    status: StageStatus = StageStatus.PENDING
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    progress_current: Optional[int] = None
    progress_total: Optional[int] = None
    detail: Dict[str, Any] = Field(default_factory=dict)
    schema_version: int = SCHEMA_VERSION


class RunEventRow(BaseModel):
    event_id: str
    run_id: str
    seq: int
    ts: str = Field(default_factory=utcnow)
    level: str = "info"
    stage_key: Optional[str] = None
    message: str
    schema_version: int = SCHEMA_VERSION


class SiteSnapshotRow(BaseModel):
    """Technical (domain + site signals) audit result of one website; reusable across runs and brands."""
    snapshot_id: str
    site_id: str
    site_types_key: str  # sorted, comma separated
    taken_at: str = Field(default_factory=utcnow)
    technical_percentage: Optional[float] = None
    category_scores: Dict[str, Any] = Field(default_factory=dict)
    site_scrapable: bool = True
    pages_analysed: Optional[int] = None
    facts: Dict[str, Any] = Field(default_factory=dict)  # robots / llms.txt / sitemap / crawlers / site (see site_facts.py)
    scoring_config_hash: Optional[str] = None
    payload_blob_key: Optional[str] = None  # technical raw_scorecard scores
    schema_version: int = SCHEMA_VERSION


class PromptSetRow(BaseModel):
    """The prompts one run used (LLM side); the raw answers live in the blob."""
    prompt_set_id: str
    brand_id: str
    run_id: str
    geo: Optional[str] = None
    created_at: str = Field(default_factory=utcnow)
    payload_blob_key: Optional[str] = None  # raw web/LLM answers per prompt (re-scorable)
    schema_version: int = SCHEMA_VERSION


class PromptRow(BaseModel):
    prompt_id: str
    prompt_set_id: str
    cluster: str
    text: str
    position: int
    schema_version: int = SCHEMA_VERSION


class BrandCompetitorRow(BaseModel):
    """Competitor of a brand: discovered by the LLM during a run, or added by the user."""
    id: str
    brand_id: str
    name: str  # exactly as given (trimmed only)
    domain: Optional[str] = None
    source: str = "llm_discovered"  # llm_discovered | user_added
    discovered_run_id: Optional[str] = None
    discovered_at: str = Field(default_factory=utcnow)
    schema_version: int = SCHEMA_VERSION


class EntityMentionRow(BaseModel):
    """Fact: was ``entity_name`` mentioned in the web / LLM answer of one prompt (derived from stored answers)."""
    prompt_set_id: str
    prompt_id: str
    entity_name: str  # exact
    mentioned_web: bool
    mentioned_llm: bool
    evaluated_at: str = Field(default_factory=utcnow)
    schema_version: int = SCHEMA_VERSION


class VisibilityMetricRow(BaseModel):
    """Dated AI-visibility numbers of one entity, tied to the prompt set they were measured on."""
    metric_id: str
    run_id: str
    prompt_set_id: str
    entity_name: str  # exact
    scope: str  # run_discovered_set | comparison_set
    entity_set_hash: str
    mode: str  # combined | web | llm
    sov: float
    citations: int
    cluster_coverage: float
    measured_at: str = Field(default_factory=utcnow)
    schema_version: int = SCHEMA_VERSION


class ComparisonStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"

    @property
    def is_active(self) -> bool:
        return self in (ComparisonStatus.PENDING, ComparisonStatus.RUNNING)


class CompetitorComparisonRow(BaseModel):
    """One competitor column of a run's Competitor tab (server-side source of truth, soft-deletable)."""
    comparison_id: str
    run_id: str
    competitor_name: str  # exactly as given (trimmed only)
    requested_url: str
    domain: str  # normalised host; unique per run among non-removed entries
    site_id: str
    snapshot_id: Optional[str] = None  # technical result; set when status is done
    status: ComparisonStatus = ComparisonStatus.PENDING
    stage_key: Optional[str] = None
    progress_pct: float = 0.0
    heartbeat_at: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)
    error_message: Optional[str] = None
    reused_snapshot: bool = False
    position: int = 0
    added_at: str = Field(default_factory=utcnow)
    updated_at: str = Field(default_factory=utcnow)
    removed_at: Optional[str] = None
    schema_version: int = SCHEMA_VERSION
