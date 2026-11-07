"""Real, backend-driven run progress.

* ``STAGE_REGISTRY`` is the single source of truth for stages, lanes and weights.
* ``NullReporter`` is the default everywhere, so instrumented pipeline functions behave exactly as
  before when nobody is listening (existing callers/tests are unaffected).
* ``StoreReporter`` keeps live state in memory and persists it to the store (stage boundaries are
  written immediately, counter updates are throttled) so a running audit never rewrites files
  continuously.
"""
import threading
import time
from typing import Dict, List, Optional, Protocol

from src.storage import Storage, RunStageRow, StageStatus
from src.storage.ids import utcnow

# stage_key -> (lane, weight). Weight = relative share of overall progress.
STAGE_REGISTRY: Dict[str, Dict] = {
    "domain_signals":  {"lane": "domain", "weight": 5},
    "site_crawl":      {"lane": "site",   "weight": 15},
    "site_processing": {"lane": "site",   "weight": 5},
    "ai_prompts":      {"lane": "ai",     "weight": 15},
    "ai_answers":      {"lane": "ai",     "weight": 35},
    "market_analysis": {"lane": "ai",     "weight": 2},
    "scoring":         {"lane": "final",  "weight": 3},
    "summary":         {"lane": "final",  "weight": 4},
    "persist":         {"lane": "final",  "weight": 1},
}
LANE_ORDER = ["domain", "site", "ai", "final"]

# Competitor (technical-only) runs use a subset.
TECHNICAL_STAGES = ["domain_signals", "site_crawl", "site_processing", "scoring", "persist"]

_FLUSH_INTERVAL_S = 1.0


class ProgressReporter(Protocol):
    def stage_start(self, key: str, total: Optional[int] = None) -> None: ...
    def stage_progress(self, key: str, current: int, total: Optional[int] = None) -> None: ...
    def stage_done(self, key: str) -> None: ...
    def stage_skipped(self, key: str, reason: Optional[str] = None) -> None: ...
    def stage_failed(self, key: str, message: str) -> None: ...
    def skip_if_pending(self, key: str, reason: Optional[str] = None) -> None: ...
    def event(self, message: str, level: str = "info", stage_key: Optional[str] = None) -> None: ...
    def warn(self, message: str) -> None: ...


class NullReporter:
    """Does nothing - the default so instrumented code paths are unchanged without a listener."""

    def stage_start(self, key, total=None): pass
    def stage_progress(self, key, current, total=None): pass
    def stage_done(self, key): pass
    def stage_skipped(self, key, reason=None): pass
    def stage_failed(self, key, message): pass
    def skip_if_pending(self, key, reason=None): pass
    def event(self, message, level="info", stage_key=None): pass
    def warn(self, message): pass


NULL_REPORTER = NullReporter()


def compute_progress_pct(stages: List[RunStageRow]) -> float:
    """Weighted completion over the stages of this run (skipped stages are excluded)."""
    total_w = done_w = 0.0
    for st in stages:
        if st.status == StageStatus.SKIPPED:
            continue
        w = STAGE_REGISTRY.get(st.stage_key, {}).get("weight", 1)
        total_w += w
        if st.status == StageStatus.DONE:
            done_w += w
        elif st.status == StageStatus.RUNNING and st.progress_total:
            done_w += w * min(1.0, (st.progress_current or 0) / st.progress_total) * 0.95
    return round(done_w / total_w * 100, 1) if total_w else 0.0


class RunSink:
    """Where a reporter writes its live pointers (stage / percentage / heartbeat / warnings) - the run row."""

    def __init__(self, storage: Storage, run_id: str):
        self._storage, self._run_id = storage, run_id

    def update(self, **fields) -> None:
        self._storage.runs.update(self._run_id, **fields)


class StoreReporter:
    def __init__(self, run_id: str, storage: Storage, stage_keys: List[str], sink=None):
        """``run_id`` is the owner id used for stage/event rows (a run id, or a comparison id)."""
        self.run_id = run_id
        self._storage = storage
        self._sink = sink or RunSink(storage, run_id)
        self._lock = threading.RLock()
        self._warnings: List[str] = []
        self._last_flush = 0.0
        self._stages: Dict[str, RunStageRow] = {
            k: RunStageRow(run_id=run_id, stage_key=k, lane=STAGE_REGISTRY[k]["lane"]) for k in stage_keys
        }
        self._flush(force=True)

    # ---------- reporter API ----------
    def stage_start(self, key, total=None):
        with self._lock:
            st = self._stages.get(key)
            if not st:
                return
            st.status, st.started_at = StageStatus.RUNNING, utcnow()
            if total is not None:
                st.progress_total, st.progress_current = total, 0
            self._flush(force=True)

    def stage_progress(self, key, current, total=None):
        with self._lock:
            st = self._stages.get(key)
            if not st:
                return
            if st.status == StageStatus.PENDING:
                st.status, st.started_at = StageStatus.RUNNING, utcnow()
            st.progress_current = current
            if total is not None:
                st.progress_total = total
            self._flush()

    def stage_done(self, key):
        with self._lock:
            st = self._stages.get(key)
            if not st:
                return
            st.status, st.finished_at = StageStatus.DONE, utcnow()
            if st.progress_total is not None:
                st.progress_current = st.progress_total
            self._flush(force=True)

    def stage_skipped(self, key, reason=None):
        with self._lock:
            st = self._stages.get(key)
            if not st:
                return
            st.status, st.finished_at = StageStatus.SKIPPED, utcnow()
            if reason:
                st.detail["reason"] = reason
            self._flush(force=True)

    def skip_if_pending(self, key, reason=None):
        with self._lock:
            st = self._stages.get(key)
            if st and st.status == StageStatus.PENDING:
                self.stage_skipped(key, reason)

    def stage_failed(self, key, message):
        with self._lock:
            st = self._stages.get(key)
            if not st:
                return
            st.status, st.finished_at = StageStatus.FAILED, utcnow()
            st.detail["error"] = message[:300]
            self._flush(force=True)

    def event(self, message, level="info", stage_key=None):
        self._storage.events.append_many(self.run_id, [{"message": message, "level": level, "stage_key": stage_key}])

    def warn(self, message):
        with self._lock:
            if message not in self._warnings:
                self._warnings.append(message)
        self.event(message, level="warn")

    # ---------- views ----------
    @property
    def warnings(self) -> List[str]:
        with self._lock:
            return list(self._warnings)

    def stages(self) -> List[RunStageRow]:
        with self._lock:
            return [s.model_copy(deep=True) for s in self._stages.values()]

    def current_stage_key(self) -> Optional[str]:
        with self._lock:
            running = [s for s in self._stages.values() if s.status == StageStatus.RUNNING]
            return running[0].stage_key if running else None

    def progress_pct(self) -> float:
        return compute_progress_pct(self.stages())

    # ---------- persistence ----------
    def _flush(self, force: bool = False) -> None:
        now = time.monotonic()
        if not force and now - self._last_flush < _FLUSH_INTERVAL_S:
            return
        self._last_flush = now
        self._storage.stages.upsert_many(list(self._stages.values()))
        self._sink.update(
            stage_key=self.current_stage_key(),
            progress_pct=self.progress_pct(),
            heartbeat_at=utcnow(),
            warnings=self._warnings,
        )


def build_lanes(stages: List[RunStageRow]) -> List[dict]:
    """Group stage rows into the lane structure the UI renders (same shape for runs and comparisons)."""
    order = list(STAGE_REGISTRY)
    lanes = []
    for lane in LANE_ORDER:
        lane_stages = [s for s in stages if s.lane == lane]
        if lane_stages:
            lanes.append({"lane": lane, "stages": [
                {"key": s.stage_key, "status": s.status.value, "progress_current": s.progress_current,
                 "progress_total": s.progress_total, "started_at": s.started_at,
                 "finished_at": s.finished_at, "detail": s.detail}
                for s in sorted(lane_stages, key=lambda s: order.index(s.stage_key))
            ]})
    return lanes
