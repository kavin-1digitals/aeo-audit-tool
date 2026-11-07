"""Competitor tab backend: add / list / remove competitors of a finished run.

Technical signals only (domain + site): no brand, no LLM. AI visibility of a competitor is NOT
re-audited - it is scored on the run's stored prompts and answers (``VisibilityService``), so numbers
are comparable with the brand's. Technical audits run in the background on the shared executor and
are reused across runs/brands while fresh (``SNAPSHOT_TTL_DAYS``).
"""
import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from urllib.parse import urlparse

from src.services.progress import StoreReporter, TECHNICAL_STAGES, build_lanes, compute_progress_pct
from src.services.run_executor import InProcessExecutor
from src.services.run_persistence import (
    delete_comparison_artifacts, scoring_config_hash, site_types_key, technical_percentage, LLM_SIGNAL_NAMES,
)
from src.services.site_facts import extract_site_facts
from src.services.technical_summary import summarize
from src.services.visibility_service import VisibilityService
from src.storage import (
    AuditRunRow, ComparisonStatus, CompetitorComparisonRow, NotFound, SiteSnapshotRow, Storage,
)
from src.storage.ids import clean_name, new_id, normalise_domain, utcnow

logger = logging.getLogger(__name__)

MAX_COMPETITORS = int(os.getenv("MAX_COMPETITORS", "5"))
SNAPSHOT_TTL_DAYS = float(os.getenv("SNAPSHOT_TTL_DAYS", "7"))
RUN_MAX_SECONDS = int(os.getenv("RUN_MAX_SECONDS", "1200"))
# A snapshot with limited data (mostly blocked / not crawlable) is only reused briefly: crawling blocked sites is
# flaky, so a retry soon after may well succeed, but we do not hammer the site on every click.
LIMITED_SNAPSHOT_TTL_HOURS = float(os.getenv("LIMITED_SNAPSHOT_TTL_HOURS", "1"))


class ComparisonError(Exception):
    """Business-rule failure carrying the HTTP status the API should answer with."""

    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code, self.detail = status_code, detail


class ComparisonSink:
    def __init__(self, storage: Storage, comparison_id: str):
        self._storage, self._id = storage, comparison_id

    def update(self, stage_key=None, progress_pct=0.0, heartbeat_at=None, warnings=None) -> None:
        self._storage.comparisons.update(
            self._id, stage_key=stage_key, progress_pct=progress_pct, heartbeat_at=heartbeat_at,
            warnings=list(warnings or []),
        )


def normalise_url(raw: str) -> str:
    """Accepts ``shop.com`` / ``https://shop.com/path``; returns ``https://host`` or raises ComparisonError(422)."""
    text = (raw or "").strip()
    if not text:
        raise ComparisonError(422, "Competitor domain is required")
    if "://" not in text:
        text = f"https://{text}"
    parsed = urlparse(text)
    host = (parsed.hostname or "").lower()
    if parsed.scheme not in ("http", "https") or "." not in host or " " in host:
        raise ComparisonError(422, f"'{raw}' is not a valid website address")
    return f"{parsed.scheme}://{parsed.netloc.lower()}"


class CompetitorComparisonService:
    def __init__(self, storage: Storage, executor: InProcessExecutor):
        self.storage = storage
        self.executor = executor
        self.visibility = VisibilityService(storage)
        self._live: Dict[str, StoreReporter] = {}

    # ------------------------------------------------------------------ add
    def add(self, run_id: str, name: str, url: str, refresh: bool = False) -> tuple:
        """Returns (entry, created_job). ``created_job`` False when a fresh snapshot was reused / entry unchanged."""
        run = self._finished_run(run_id)
        name = clean_name(name)
        if not name:
            raise ComparisonError(422, "Competitor name is required")
        requested_url = normalise_url(url)
        domain = normalise_domain(requested_url)
        site = self.storage.sites.get_or_create(domain)

        existing = self.storage.comparisons.find_by_domain(run_id, domain)
        active = self.storage.comparisons.list_for_run(run_id)
        if not (existing and existing.removed_at is None) and len(active) >= MAX_COMPETITORS:
            raise ComparisonError(409, f"At most {MAX_COMPETITORS} competitors can be compared per audit")

        if existing and existing.status.is_active:  # a job for this domain is already running
            return existing, False
        if existing and existing.removed_at is None and existing.status == ComparisonStatus.DONE and not refresh:
            if existing.competitor_name != name:
                existing = self.storage.comparisons.update(existing.comparison_id, competitor_name=name)
            return existing, False

        snapshot = None if refresh else self._fresh_snapshot(site.site_id, run)
        fields = dict(
            competitor_name=name, requested_url=requested_url, domain=domain, site_id=site.site_id,
            removed_at=None, error_message=None, warnings=[], stage_key=None, progress_pct=0.0,
            position=len(active),
        )
        if existing:
            row = self.storage.comparisons.update(existing.comparison_id, **fields,
                                                  status=ComparisonStatus.PENDING, snapshot_id=None)
        else:
            row = self.storage.comparisons.insert(CompetitorComparisonRow(
                comparison_id=new_id(), run_id=run_id, **fields))

        if snapshot:  # reuse: nothing to crawl
            row = self.storage.comparisons.update(
                row.comparison_id, status=ComparisonStatus.DONE, snapshot_id=snapshot.snapshot_id,
                reused_snapshot=True, progress_pct=100.0)
            self._after_done(run)
            return row, False

        row = self.storage.comparisons.update(row.comparison_id, reused_snapshot=False)
        self.executor.submit(row.comparison_id, lambda cid=row.comparison_id: self._execute(cid, run))
        return row, True

    def _fresh_snapshot(self, site_id: str, run: AuditRunRow) -> Optional[SiteSnapshotRow]:
        snap = self.storage.snapshots.latest_for_site(site_id, site_types_key(run.site_types))
        if not snap or snap.scoring_config_hash != scoring_config_hash():
            return None
        age = datetime.now(timezone.utc) - datetime.fromisoformat(snap.taken_at)
        summary = summarize(snap.category_scores)
        limited = summary is None or summary["confidence"] == "limited"
        ttl = timedelta(hours=LIMITED_SNAPSHOT_TTL_HOURS) if limited else timedelta(days=SNAPSHOT_TTL_DAYS)
        return snap if age <= ttl else None

    # -------------------------------------------------------------- execute
    async def _execute(self, comparison_id: str, run: AuditRunRow) -> None:
        row = self.storage.comparisons.get(comparison_id)
        if row is None or row.removed_at is not None or row.status != ComparisonStatus.PENDING:
            return
        self.storage.comparisons.update(comparison_id, status=ComparisonStatus.RUNNING, heartbeat_at=utcnow())
        reporter = StoreReporter(comparison_id, self.storage, TECHNICAL_STAGES,
                                 sink=ComparisonSink(self.storage, comparison_id))
        self._live[comparison_id] = reporter
        try:
            snapshot_id = await asyncio.wait_for(self._technical_audit(row, run, reporter), RUN_MAX_SECONDS)
            self.storage.comparisons.update(
                comparison_id, status=ComparisonStatus.DONE, snapshot_id=snapshot_id, progress_pct=100.0,
                warnings=reporter.warnings)
            self._after_done(run)
        except asyncio.CancelledError:
            raise
        except asyncio.TimeoutError:
            self._fail(comparison_id, f"Audit exceeded the {RUN_MAX_SECONDS // 60} minute limit")
        except Exception as exc:  # pipeline-level crash of this competitor audit
            logger.exception("Competitor audit %s failed", comparison_id)
            self._fail(comparison_id, f"{type(exc).__name__}: {exc}"[:500])
        finally:
            reporter._flush(force=True)
            self._live.pop(comparison_id, None)

    async def _technical_audit(self, row: CompetitorComparisonRow, run: AuditRunRow, reporter: StoreReporter) -> str:
        from src.scorecard import create_aeo_scorecard
        from src.signals import find_signals

        site_types = run.site_types or None
        reporter.event(f"Auditing {row.domain}")
        signals = await find_signals(row.requested_url, None, run.geo, site_types, progress=reporter)  # brand=None: no LLM
        reporter.skip_if_pending("site_processing", "Site not scrapable")

        reporter.stage_start("scoring")
        scorecard, _ = await create_aeo_scorecard(signals, None, site_types)
        reporter.stage_done("scoring")

        reporter.stage_start("persist")
        scrapable = bool(signals.site_signals and signals.site_signals.is_scrapable)
        if not scrapable:
            reporter.warn("The site blocked or could not be crawled; site signals are incomplete.")
        facts = extract_site_facts(signals)
        snapshot_id = new_id()
        scores = [s.model_dump(mode="json") for s in scorecard.raw_scorecard.scores
                  if s.signal_name not in LLM_SIGNAL_NAMES]
        blob = self.storage.blobs.put(f"snapshots/{snapshot_id}.json", {"scores": scores})
        self.storage.snapshots.insert(SiteSnapshotRow(
            snapshot_id=snapshot_id, site_id=row.site_id, site_types_key=site_types_key(run.site_types),
            technical_percentage=technical_percentage(scorecard.category_scores),
            category_scores=scorecard.category_scores or {}, site_scrapable=scrapable,
            facts=facts, pages_analysed=(facts.get("site") or {}).get("pages_analysed"),
            scoring_config_hash=scoring_config_hash(), payload_blob_key=blob))
        reporter.stage_done("persist")
        return snapshot_id

    def _fail(self, comparison_id: str, message: str) -> None:
        row = self.storage.comparisons.get(comparison_id)
        if row and row.status.is_active:
            self.storage.comparisons.update(comparison_id, status=ComparisonStatus.FAILED, error_message=message)

    def _after_done(self, run: AuditRunRow) -> None:
        """Persist the dated visibility numbers for the current comparison set (no LLM)."""
        try:
            self.visibility.score(run.run_id, self._added_names(run.run_id))
        except Exception:
            logger.exception("Could not store visibility metrics for run %s", run.run_id)

    # --------------------------------------------------------------- remove
    def remove(self, run_id: str, comparison_id: str) -> None:
        row = self.storage.comparisons.get(comparison_id)
        if not row or row.run_id != run_id or row.removed_at is not None:
            raise NotFound(comparison_id)
        self.storage.comparisons.update(comparison_id, removed_at=utcnow())
        if row.status.is_active:
            self.storage.comparisons.update(comparison_id, status=ComparisonStatus.FAILED, error_message="Removed")
            self.executor.cancel(comparison_id)

    def recover_interrupted(self) -> int:
        stale = self.storage.comparisons.list_by_status([ComparisonStatus.PENDING, ComparisonStatus.RUNNING])
        for row in stale:
            self.storage.comparisons.update(row.comparison_id, status=ComparisonStatus.FAILED,
                                            error_message="The server restarted during this audit. Please add the competitor again.")
        return len(stale)

    # ------------------------------------------------------------- carry over
    def _carry_over_source(self, run: AuditRunRow, from_run_id: Optional[str] = None):
        """Newest OTHER run of the same brand that has finished competitor entries (or the explicit one)."""
        candidates = [r for r in self.storage.runs.list_for_brand(run.brand_id, limit=10_000) if r.run_id != run.run_id]
        if from_run_id:
            candidates = [r for r in candidates if r.run_id == from_run_id]
        for other in candidates:  # newest first
            entries = [c for c in self.storage.comparisons.list_for_run(other.run_id)
                       if c.status == ComparisonStatus.DONE]
            if entries:
                return other, entries
        return None, []

    def _carry_over_offer(self, run: AuditRunRow) -> Optional[dict]:
        if not run.report_blob_key:
            return None
        other, entries = self._carry_over_source(run)
        if not other:
            return None
        return {"from_run_id": other.run_id, "finished_at": other.finished_at or other.requested_at,
                "count": len(entries), "names": [c.competitor_name for c in entries]}

    def carry_over(self, run_id: str, from_run_id: Optional[str] = None) -> dict:
        """Copy the competitor list of an earlier run of this brand. Fresh snapshots are reused (no crawl);
        the rest are audited in the background. AI visibility is re-scored on THIS run's prompts."""
        run = self._finished_run(run_id)
        other, entries = self._carry_over_source(run, from_run_id)
        if not other:
            raise ComparisonError(404, "No earlier audit with competitors was found for this brand")
        started = reused = 0
        skipped: List[str] = []
        for c in entries:
            try:
                _, job = self.add(run_id, c.competitor_name, c.requested_url)
            except ComparisonError as exc:
                if exc.status_code == 409:  # cap reached
                    skipped.append(c.competitor_name)
                    continue
                raise
            started, reused = (started + 1, reused) if job else (started, reused + 1)
        return {"from_run_id": other.run_id, "requested": len(entries), "started": started,
                "reused": reused, "skipped": skipped}

    # ------------------------------------------------------------------ view
    def _finished_run(self, run_id: str) -> AuditRunRow:
        run = self.storage.runs.get(run_id)
        if not run:
            raise NotFound(run_id)
        if not run.report_blob_key:
            raise ComparisonError(409, f"The audit is not finished yet (status: {run.status.value})")
        return run

    def _added_names(self, run_id: str) -> List[str]:
        return [c.competitor_name for c in self.storage.comparisons.list_for_run(run_id)
                if c.status == ComparisonStatus.DONE]

    def _scores(self, snapshot: Optional[SiteSnapshotRow]) -> List[dict]:
        if not snapshot or not snapshot.payload_blob_key:
            return []
        blob = self.storage.blobs.get(snapshot.payload_blob_key) or {}
        return [{"signal_name": s["signal_name"], "value": s["value"], "signal_path": s.get("signal_path", [])}
                for s in blob.get("scores", [])]

    def _snapshot_view(self, snapshot: Optional[SiteSnapshotRow], include_scores: bool) -> Optional[dict]:
        if not snapshot:
            return None
        view = {
            "snapshot_id": snapshot.snapshot_id, "taken_at": snapshot.taken_at,
            "technical_percentage": snapshot.technical_percentage, "category_scores": snapshot.category_scores,
            "site_scrapable": snapshot.site_scrapable, "pages_analysed": snapshot.pages_analysed,
            "facts": snapshot.facts, "summary": summarize(snapshot.category_scores),
        }
        if include_scores:
            view["scores"] = self._scores(snapshot)
        return view

    def overview(self, run_id: str, include_scores: bool = True) -> dict:
        run = self.storage.runs.get(run_id)
        if not run:
            raise NotFound(run_id)
        brand = self.storage.brands.get(run.brand_id)
        answers_available = self.visibility.load_answers(run) is not None

        # AI visibility covers only the brands in the comparison: the brand + the competitors the user added
        entries = self.storage.comparisons.list_for_run(run_id)
        added = [c.competitor_name for c in entries if c.status == ComparisonStatus.DONE]
        visibility: Dict[str, dict] = {}
        if answers_available:
            for row in self.visibility.score(run_id, added, persist=False) or []:
                visibility[row["entity"]] = row

        ai = self.visibility.ai_scores(run_id) if answers_available else None
        out_entries = []
        for c in entries:
            snapshot = self.storage.snapshots.get(c.snapshot_id) if c.snapshot_id else None
            stages = self._live[c.comparison_id].stages() if c.comparison_id in self._live \
                else self.storage.stages.list_for_run(c.comparison_id)
            live = self._live.get(c.comparison_id)
            entry = {
                "comparison_id": c.comparison_id, "name": c.competitor_name, "domain": c.domain,
                "requested_url": c.requested_url, "status": c.status.value,
                "stage_key": live.current_stage_key() if live else c.stage_key,
                "progress_pct": live.progress_pct() if live else c.progress_pct,
                "lanes": build_lanes(stages) if c.status.is_active else [],
                "warnings": live.warnings if live else c.warnings, "error": c.error_message,
                "reused_snapshot": c.reused_snapshot, "added_at": c.added_at,
                "technical": self._snapshot_view(snapshot, include_scores),
            }
            if c.status == ComparisonStatus.DONE:
                entry["ai"] = (ai or {}).get(c.competitor_name)
                v = visibility.get(c.competitor_name)
                entry["visibility_status"] = "scored" if v else "unavailable"
                entry["visibility"] = v
                if not v:
                    entry["visibility_reference"] = self.visibility.reference_for(c.competitor_name, exclude_run_id=run_id)
            out_entries.append(entry)

        brand_snapshot = self.storage.snapshots.get(run.site_snapshot_id) if run.site_snapshot_id else None
        # the dropdown still offers every competitor AI found for the brand
        discovered = [m.entity_name for m in self.storage.visibility.list_for_run(run_id, scope="run_discovered_set")
                      if m.mode == "combined"]
        options = {r.name: {"name": r.name, "source": r.source} for r in self.storage.competitors.list_for_brand(run.brand_id)}
        for name in discovered:
            if name != (brand.name if brand else None):
                options.setdefault(name, {"name": name, "source": "llm_discovered"})
        added_set = {c.competitor_name for c in entries}
        brand_name = brand.name if brand else None
        tracked = list(dict.fromkeys([n for n in [brand_name, *added] if n]))
        visibility_set = [{**visibility[n], "kind": "brand" if n == brand_name else "added"} for n in tracked if n in visibility]
        return {
            "run_id": run_id,
            "limit": MAX_COMPETITORS,
            "brand": {
                "name": brand.name if brand else None, "domain": (self.storage.sites.get(run.site_id).domain
                                                                   if self.storage.sites.get(run.site_id) else None),
                "percentage": run.percentage, "technical": self._snapshot_view(brand_snapshot, include_scores),
                "visibility": visibility.get(brand.name) if brand else None,
                "ai": (ai or {}).get(brand.name) if brand else None,
            },
            "visibility_available": answers_available,
            "visibility_set": visibility_set,
            "visibility_summary": self.visibility.mention_summary(run_id) if answers_available else None,
            "carry_over": self._carry_over_offer(run) if not entries else None,
            "options": [{**o, "added": o["name"] in added_set} for o in sorted(options.values(), key=lambda o: o["name"])],
            "entries": out_entries,
        }
