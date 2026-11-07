"""Audit run lifecycle: start (idempotent), execute in background, report real status.

Signal-level failures keep their existing behaviour (swallowed and recorded as signals). Only an
unexpected crash of the whole pipeline marks a run ``failed``; an unavailable AI track ends the run
as ``completed_with_warnings``.
"""
import asyncio
import hashlib
import json
import logging
import os
import statistics
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

from src.api.schemas import AuditResponse
from src.scorecard import ProblemCard, RawScoreCard, ScoreCard, create_aeo_scorecard
from src.services.progress import STAGE_REGISTRY, StoreReporter, build_lanes, compute_progress_pct
from src.services.run_executor import InProcessExecutor
from src.services.run_persistence import delete_run_artifacts, persist_run_artifacts
from src.storage import (
    AuditRunRow, NotFound, RunStatus, Storage, UniqueViolation,
)
from src.storage.ids import new_id, utcnow
from src.summary import Summary, generate_summary

logger = logging.getLogger(__name__)

RUN_MAX_SECONDS = int(os.getenv("RUN_MAX_SECONDS", "1200"))
MAX_CONCURRENT_RUNS = int(os.getenv("MAX_CONCURRENT_RUNS", "2"))
PIPELINE_VERSION = "1"
RUN_RETENTION = int(os.getenv("RUN_RETENTION", "20"))  # runs kept per brand

FULL_STAGES = list(STAGE_REGISTRY.keys())
NO_BRAND_STAGES = [k for k in FULL_STAGES if not k.startswith("ai_") and k != "market_analysis"]


@dataclass
class StartResult:
    run: AuditRunRow
    created: bool = False
    reused: bool = False
    reused_active: bool = False


def _active_key(brand_id: str, domain: str, geo: Optional[str], site_types: Optional[List[str]]) -> str:
    raw = json.dumps([brand_id, domain, geo or "", sorted(site_types or [])])
    return hashlib.sha1(raw.encode()).hexdigest()


def _parse(ts: Optional[str]) -> Optional[datetime]:
    return datetime.fromisoformat(ts) if ts else None


class RunActiveError(Exception):
    """Raised when an operation needs a finished run but the run is still pending/running."""


class AuditRunService:
    def __init__(self, storage: Storage, executor: Optional[InProcessExecutor] = None):
        self.storage = storage
        self.executor = executor or InProcessExecutor(MAX_CONCURRENT_RUNS)
        self._live: Dict[str, StoreReporter] = {}

    # ------------------------------------------------------------------ start
    def start(self, domain: str, brand: str, geo: Optional[str], site_types: Optional[List[str]],
              mode: str = "new") -> StartResult:
        brand_row = self.storage.brands.get_or_create(brand)
        site_row = self.storage.sites.get_or_create(domain)

        if mode == "reuse_latest":
            for run in self.storage.runs.list_for_brand(brand_row.brand_id):
                if run.status in (RunStatus.COMPLETED, RunStatus.COMPLETED_WITH_WARNINGS) and run.report_blob_key:
                    return StartResult(run=run, reused=True)

        key = _active_key(brand_row.brand_id, site_row.domain, geo, site_types)
        active = self.storage.runs.find_active(key)
        if active:
            return StartResult(run=active, reused_active=True)

        run = AuditRunRow(
            run_id=new_id(), brand_id=brand_row.brand_id, site_id=site_row.site_id,
            requested_url=domain, geo=geo, site_types=site_types or [], mode=mode,
            active_key=key, pipeline_version=PIPELINE_VERSION,
        )
        try:
            self.storage.runs.insert(run)
        except UniqueViolation:  # lost a race with an identical request
            active = self.storage.runs.find_active(key)
            if active:
                return StartResult(run=active, reused_active=True)
            raise

        self.executor.submit(run.run_id, lambda rid=run.run_id: self._execute(rid))
        return StartResult(run=run, created=True)

    # ---------------------------------------------------------------- execute
    async def _execute(self, run_id: str) -> None:
        run = self.storage.runs.get(run_id)
        if run is None or run.status != RunStatus.PENDING:  # e.g. cancelled while queued
            return
        brand = self.storage.brands.get(run.brand_id)
        stage_keys = FULL_STAGES if brand else NO_BRAND_STAGES
        self.storage.runs.update(run_id, status=RunStatus.RUNNING, started_at=utcnow(), heartbeat_at=utcnow())
        reporter = StoreReporter(run_id, self.storage, stage_keys)
        self._live[run_id] = reporter
        reporter.event("Audit started")

        try:
            report = await asyncio.wait_for(self._pipeline(run, brand.name, reporter), RUN_MAX_SECONDS)
            reporter.stage_start("persist")
            key = self.storage.blobs.put(f"runs/{run_id}/report.json", report.model_dump(mode="json"))
            extra: dict = {}
            try:  # reusable artefacts must never cost the user the report itself
                extra = persist_run_artifacts(self.storage, run, report)
            except Exception:
                logger.exception("Run %s: could not store reusable artefacts", run_id)
                reporter.warn("The report was saved, but its reusable data (prompts/snapshot) could not be stored.")
            reporter.stage_done("persist")
            warnings = reporter.warnings
            self._finish(
                run_id, RunStatus.COMPLETED_WITH_WARNINGS if warnings else RunStatus.COMPLETED,
                report_blob_key=key, percentage=report.scorecard.percentage, warnings=warnings, **extra,
            )
            reporter.event("Audit completed")
            self._apply_retention(run.brand_id)
        except asyncio.CancelledError:
            self._finish_if_active(run_id, RunStatus.CANCELLED, error_code="cancelled", error_message="Cancelled by user")
            raise
        except asyncio.TimeoutError:
            logger.error("Run %s exceeded %ss", run_id, RUN_MAX_SECONDS)
            self._finish_if_active(run_id, RunStatus.FAILED, error_code="run_timeout",
                                   error_message=f"Audit exceeded the {RUN_MAX_SECONDS // 60} minute limit")
        except Exception as exc:  # unexpected pipeline-level crash
            logger.exception("Run %s failed", run_id)
            self._finish_if_active(run_id, RunStatus.FAILED, error_code="pipeline_error",
                                   error_message=f"{type(exc).__name__}: {exc}"[:500])
        finally:
            reporter._flush(force=True)
            self._live.pop(run_id, None)

    async def _pipeline(self, run: AuditRunRow, brand_name: str, reporter: StoreReporter) -> AuditResponse:
        from src.signals import find_signals
        from src.services.quick_remediations_service import generate_quick_remediations

        domain = run.requested_url.rstrip("/")
        site_types = run.site_types or None

        signals = await find_signals(domain, brand_name, run.geo, site_types, progress=reporter)
        reporter.skip_if_pending("site_processing", "Site not scrapable")

        llm = signals.llm_signals
        if llm is None or not llm.status:
            reporter.warn("AI visibility signals were unavailable for this run; technical signals were still scored.")
            for k in ("ai_prompts", "ai_answers", "market_analysis"):
                reporter.skip_if_pending(k, "AI signals unavailable")

        reporter.stage_start("scoring")
        scorecard, problemcard = await create_aeo_scorecard(signals, brand_name, site_types)
        reporter.stage_done("scoring")

        reporter.stage_start("summary")
        quick = generate_quick_remediations(scorecard.model_dump())
        summary = generate_summary(scorecard)
        reporter.stage_done("summary")

        return AuditResponse(
            task_id=run.run_id, status="completed", message="Audit completed successfully",
            domain=domain, brand=brand_name, geo=run.geo, signals=signals, scorecard=scorecard,
            problemcard=problemcard, summary=summary,
            quick_remediations=quick.model_dump() if quick else None,
        )

    def _finish(self, run_id: str, status: RunStatus, **fields: Any) -> None:
        self.storage.runs.update(run_id, status=status, finished_at=utcnow(), active_key=None, **fields)

    def _finish_if_active(self, run_id: str, status: RunStatus, **fields: Any) -> None:
        run = self.storage.runs.get(run_id)
        if run and run.status.is_active:
            self._finish(run_id, status, **fields)

    def _apply_retention(self, brand_id: str) -> None:
        """Keep the newest ``RUN_RETENTION`` runs of a brand; older finished runs are deleted."""
        try:
            finished = [r for r in self.storage.runs.list_for_brand(brand_id, limit=10_000) if r.status.is_terminal]
            for old in finished[RUN_RETENTION:]:  # list is newest-first
                self.delete_run(old.run_id)
        except Exception:
            logger.exception("Retention cleanup failed for brand %s", brand_id)

    def delete_run(self, run_id: str) -> None:
        run = self.storage.runs.get(run_id)
        if not run:
            raise NotFound(run_id)
        if run.status.is_active:
            raise RunActiveError(run_id)
        delete_run_artifacts(self.storage, run)
        self.storage.runs.delete(run_id)

    # ----------------------------------------------------------------- control
    def cancel(self, run_id: str) -> bool:
        run = self.storage.runs.get(run_id)
        if not run:
            raise NotFound(run_id)
        if not run.status.is_active:
            return False
        self._finish(run_id, RunStatus.CANCELLED, error_code="cancelled", error_message="Cancelled by user")
        self.executor.cancel(run_id)
        return True

    def recover_interrupted(self) -> int:
        """Called at startup: runs left pending/running by a previous process can never finish."""
        stale = self.storage.runs.list_by_status([RunStatus.PENDING, RunStatus.RUNNING])
        for run in stale:
            self._finish(run.run_id, RunStatus.FAILED, error_code="interrupted",
                         error_message="The server restarted while this audit was running. Please start it again.")
        return len(stale)

    # ------------------------------------------------------------------ views
    def run_summary(self, run: AuditRunRow) -> dict:
        site = self.storage.sites.get(run.site_id)
        return {
            "run_id": run.run_id, "status": run.status.value, "domain": site.domain if site else None,
            "requested_url": run.requested_url, "geo": run.geo, "site_types": run.site_types,
            "requested_at": run.requested_at, "finished_at": run.finished_at,
            "percentage": run.percentage, "technical_percentage": run.technical_percentage,
            "warnings": run.warnings, "has_report": bool(run.report_blob_key),
            "has_answers": bool(run.prompt_set_id),
        }

    def brand_overview(self, brand) -> dict:
        runs = self.storage.runs.list_for_brand(brand.brand_id, limit=10_000)
        reports = [r for r in runs if r.report_blob_key]
        return {
            "brand_id": brand.brand_id, "name": brand.name, "run_count": len(runs),
            "latest_run": self.run_summary(reports[0]) if reports else None,
        }

    def get_report(self, run_id: str) -> Optional[dict]:
        run = self.storage.runs.get(run_id)
        if not run or not run.report_blob_key:
            return None
        return self.storage.blobs.get(run.report_blob_key)

    def _typical_duration_s(self) -> Optional[float]:
        done = self.storage.runs.list_by_status([RunStatus.COMPLETED, RunStatus.COMPLETED_WITH_WARNINGS])
        durations = []
        for r in sorted(done, key=lambda r: r.finished_at or "", reverse=True)[:20]:
            a, b = _parse(r.started_at), _parse(r.finished_at)
            if a and b:
                durations.append((b - a).total_seconds())
        return statistics.median(durations) if len(durations) >= 3 else None

    def status(self, run_id: str, since_seq: int = 0) -> dict:
        run = self.storage.runs.get(run_id)
        if not run:
            raise NotFound(run_id)
        live = self._live.get(run_id)
        stages = live.stages() if live else self.storage.stages.list_for_run(run_id)
        pct = live.progress_pct() if live else (100.0 if run.status in (
            RunStatus.COMPLETED, RunStatus.COMPLETED_WITH_WARNINGS) else compute_progress_pct(stages))
        started, now = _parse(run.started_at), datetime.fromisoformat(utcnow())
        end = _parse(run.finished_at) or now
        elapsed = (end - started).total_seconds() if started else 0.0
        typical = self._typical_duration_s()
        eta = max(0.0, typical - elapsed) if typical and run.status == RunStatus.RUNNING else None

        lanes = build_lanes(stages)

        brand = self.storage.brands.get(run.brand_id)
        site = self.storage.sites.get(run.site_id)
        return {
            "run_id": run.run_id, "status": run.status.value,
            "brand": brand.name if brand else None, "domain": site.domain if site else None,
            "geo": run.geo, "site_types": run.site_types,
            "stage_key": (live.current_stage_key() if live else run.stage_key),
            "progress_pct": pct, "requested_at": run.requested_at, "started_at": run.started_at,
            "finished_at": run.finished_at, "elapsed_s": round(elapsed, 1),
            "eta_s": round(eta, 1) if eta is not None else None,
            "typical_duration_s": round(typical, 1) if typical else None,
            "lanes": lanes,
            "events": [e.model_dump() for e in self.storage.events.list_for_run(run_id, since_seq)],
            "warnings": run.warnings if not live else live.warnings,
            "error": {"code": run.error_code, "message": run.error_message} if run.error_code else None,
        }
