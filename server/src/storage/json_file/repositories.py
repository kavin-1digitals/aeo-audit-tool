"""Concrete file-backed repositories (implement the ports in ``storage.interfaces``)."""
import os
import threading
from typing import Any, List, Optional, Sequence

from ..ids import clean_name, new_id, normalise_domain, utcnow
from ..interfaces import NotFound
from ..models import (
    AuditRunRow, BrandCompetitorRow, BrandRow, ComparisonStatus, CompetitorComparisonRow, EntityMentionRow, PromptRow, PromptSetRow, RunEventRow,
    RunStageRow, RunStatus, SiteRow, SiteSnapshotRow, VisibilityMetricRow,
)
from .table import JsonTable

MAX_EVENTS_PER_RUN = 300


class JsonBrandRepository:
    def __init__(self, tables_dir: str):
        self._t = JsonTable(os.path.join(tables_dir, "brands.json"), BrandRow,
                            key_fn=lambda r: r.brand_id, unique=[("name",)])
        self._create_lock = threading.Lock()

    def get(self, brand_id: str) -> Optional[BrandRow]:
        return self._t.get(brand_id)

    def get_by_name(self, name: str) -> Optional[BrandRow]:
        name = clean_name(name)
        found = self._t.find(lambda r: r.name == name)  # exact, case-sensitive
        return found[0] if found else None

    def get_or_create(self, name: str) -> BrandRow:
        name = clean_name(name)
        if not name:
            raise ValueError("Brand name must not be empty")
        with self._create_lock:
            existing = self.get_by_name(name)
            if existing:
                return existing
            return self._t.insert(BrandRow(brand_id=new_id(), name=name))

    def list_all(self) -> List[BrandRow]:
        return self._t.all()

    def search(self, prefix: str, limit: int = 20) -> List[BrandRow]:
        prefix = clean_name(prefix).casefold()
        rows = self._t.find(lambda r: r.name.casefold().startswith(prefix))
        return sorted(rows, key=lambda r: r.name)[:limit]


class JsonSiteRepository:
    def __init__(self, tables_dir: str):
        self._t = JsonTable(os.path.join(tables_dir, "sites.json"), SiteRow,
                            key_fn=lambda r: r.site_id, unique=[("domain",)])
        self._create_lock = threading.Lock()

    def get(self, site_id: str) -> Optional[SiteRow]:
        return self._t.get(site_id)

    def get_or_create(self, domain: str) -> SiteRow:
        domain = normalise_domain(domain)
        if not domain:
            raise ValueError("Domain must not be empty")
        with self._create_lock:
            found = self._t.find(lambda r: r.domain == domain)
            if found:
                return found[0]
            return self._t.insert(SiteRow(site_id=new_id(), domain=domain))


class JsonRunRepository:
    def __init__(self, tables_dir: str):
        self._t = JsonTable(os.path.join(tables_dir, "audit_runs.json"), AuditRunRow,
                            key_fn=lambda r: r.run_id, unique=[("active_key",)])

    def insert(self, run: AuditRunRow) -> AuditRunRow:
        return self._t.insert(run)

    def get(self, run_id: str) -> Optional[AuditRunRow]:
        return self._t.get(run_id)

    def update(self, run_id: str, **fields: Any) -> AuditRunRow:
        return self._t.update(run_id, **fields)

    def find_active(self, active_key: str) -> Optional[AuditRunRow]:
        found = self._t.find(lambda r: r.active_key == active_key and r.status.is_active)
        return found[0] if found else None

    def list_by_status(self, statuses: Sequence[RunStatus]) -> List[AuditRunRow]:
        wanted = set(statuses)
        return self._t.find(lambda r: r.status in wanted)

    def list_for_brand(self, brand_id: str, limit: int = 50) -> List[AuditRunRow]:
        rows = self._t.find(lambda r: r.brand_id == brand_id)
        return sorted(rows, key=lambda r: r.requested_at, reverse=True)[:limit]

    def list_for_site(self, site_id: str) -> List[AuditRunRow]:
        return self._t.find(lambda r: r.site_id == site_id)

    def delete(self, run_id: str) -> None:
        self._t.delete(run_id)


class JsonStageRepository:
    def __init__(self, tables_dir: str):
        self._t = JsonTable(os.path.join(tables_dir, "run_stages.json"), RunStageRow,
                            key_fn=lambda r: f"{r.run_id}:{r.stage_key}")

    def upsert(self, stage: RunStageRow) -> RunStageRow:
        return self._t.upsert(stage)

    def upsert_many(self, stages: Sequence[RunStageRow]) -> None:
        self._t.upsert_many(stages)

    def list_for_run(self, run_id: str) -> List[RunStageRow]:
        return self._t.find(lambda r: r.run_id == run_id)

    def delete_for_run(self, run_id: str) -> None:
        self._t.delete_where(lambda r: r.run_id == run_id)


class JsonEventRepository:
    def __init__(self, tables_dir: str):
        self._t = JsonTable(os.path.join(tables_dir, "run_events.json"), RunEventRow,
                            key_fn=lambda r: r.event_id)
        self._lock = threading.Lock()

    def append_many(self, run_id: str, events: Sequence[dict]) -> List[RunEventRow]:
        with self._lock:
            existing = self._t.find(lambda r: r.run_id == run_id)
            seq = max((e.seq for e in existing), default=0)
            created: List[RunEventRow] = []
            for ev in events:
                seq += 1
                created.append(RunEventRow(
                    event_id=new_id(), run_id=run_id, seq=seq, ts=ev.get("ts") or utcnow(),
                    level=ev.get("level", "info"), stage_key=ev.get("stage_key"), message=ev["message"],
                ))
            self._t.insert_many(created)
            overflow = len(existing) + len(created) - MAX_EVENTS_PER_RUN
            if overflow > 0:  # cap: drop oldest
                cutoff = sorted([e.seq for e in existing] + [e.seq for e in created])[overflow - 1]
                self._t.delete_where(lambda r: r.run_id == run_id and r.seq <= cutoff)
            return created

    def list_for_run(self, run_id: str, since_seq: int = 0, limit: int = MAX_EVENTS_PER_RUN) -> List[RunEventRow]:
        rows = self._t.find(lambda r: r.run_id == run_id and r.seq > since_seq)
        return sorted(rows, key=lambda r: r.seq)[:limit]

    def delete_for_run(self, run_id: str) -> None:
        self._t.delete_where(lambda r: r.run_id == run_id)


class JsonSnapshotRepository:
    def __init__(self, tables_dir: str):
        self._t = JsonTable(os.path.join(tables_dir, "site_snapshots.json"), SiteSnapshotRow,
                            key_fn=lambda r: r.snapshot_id)

    def insert(self, snapshot: SiteSnapshotRow) -> SiteSnapshotRow:
        return self._t.insert(snapshot)

    def get(self, snapshot_id: str) -> Optional[SiteSnapshotRow]:
        return self._t.get(snapshot_id)

    def latest_for_site(self, site_id: str, site_types_key: str) -> Optional[SiteSnapshotRow]:
        rows = self._t.find(lambda r: r.site_id == site_id and r.site_types_key == site_types_key)
        return max(rows, key=lambda r: r.taken_at) if rows else None

    def list_all(self) -> List[SiteSnapshotRow]:
        return self._t.all()

    def delete(self, snapshot_id: str) -> None:
        self._t.delete(snapshot_id)


class JsonPromptRepository:
    def __init__(self, tables_dir: str):
        self._sets = JsonTable(os.path.join(tables_dir, "prompt_sets.json"), PromptSetRow,
                               key_fn=lambda r: r.prompt_set_id)
        self._prompts = JsonTable(os.path.join(tables_dir, "prompts.json"), PromptRow,
                                  key_fn=lambda r: r.prompt_id)

    def insert_set(self, prompt_set: PromptSetRow, prompts: Sequence[PromptRow]) -> PromptSetRow:
        self._sets.insert(prompt_set)
        self._prompts.insert_many(prompts)
        return prompt_set

    def get_set(self, prompt_set_id: str) -> Optional[PromptSetRow]:
        return self._sets.get(prompt_set_id)

    def list_prompts(self, prompt_set_id: str) -> List[PromptRow]:
        return sorted(self._prompts.find(lambda r: r.prompt_set_id == prompt_set_id), key=lambda r: r.position)

    def delete_set(self, prompt_set_id: str) -> None:
        self._prompts.delete_where(lambda r: r.prompt_set_id == prompt_set_id)
        self._sets.delete(prompt_set_id)


class JsonCompetitorRepository:
    def __init__(self, tables_dir: str):
        self._t = JsonTable(os.path.join(tables_dir, "brand_competitors.json"), BrandCompetitorRow,
                            key_fn=lambda r: r.id, unique=[("brand_id", "name")])
        self._lock = threading.Lock()

    def upsert_discovered(self, brand_id: str, names: Sequence[str], run_id: str) -> List[BrandCompetitorRow]:
        with self._lock:
            existing = {r.name: r for r in self._t.find(lambda r: r.brand_id == brand_id)}
            created: List[BrandCompetitorRow] = []
            for raw in names:
                name = clean_name(raw)
                if name and name not in existing:
                    row = BrandCompetitorRow(id=new_id(), brand_id=brand_id, name=name, discovered_run_id=run_id)
                    existing[name] = row
                    created.append(row)
            if created:
                self._t.insert_many(created)
            return created

    def list_for_brand(self, brand_id: str) -> List[BrandCompetitorRow]:
        return sorted(self._t.find(lambda r: r.brand_id == brand_id), key=lambda r: r.name)


class JsonMentionRepository:
    def __init__(self, tables_dir: str):
        self._t = JsonTable(os.path.join(tables_dir, "entity_mentions.json"), EntityMentionRow,
                            key_fn=lambda r: f"{r.prompt_id}:{r.entity_name}")

    def upsert_many(self, rows: Sequence[EntityMentionRow]) -> None:
        self._t.upsert_many(rows)

    def list_for_prompt_set(self, prompt_set_id: str, entity_name: Optional[str] = None) -> List[EntityMentionRow]:
        return self._t.find(lambda r: r.prompt_set_id == prompt_set_id
                            and (entity_name is None or r.entity_name == entity_name))

    def delete_for_prompt_set(self, prompt_set_id: str) -> None:
        self._t.delete_where(lambda r: r.prompt_set_id == prompt_set_id)


class JsonVisibilityRepository:
    def __init__(self, tables_dir: str):
        self._t = JsonTable(os.path.join(tables_dir, "visibility_metrics.json"), VisibilityMetricRow,
                            key_fn=lambda r: r.metric_id)

    def insert_many(self, rows: Sequence[VisibilityMetricRow]) -> None:
        self._t.insert_many(rows)

    def list_for_run(self, run_id: str, scope: Optional[str] = None) -> List[VisibilityMetricRow]:
        return self._t.find(lambda r: r.run_id == run_id and (scope is None or r.scope == scope))

    def latest_for_entity(self, entity_name: str, mode: str = "combined", scope: str = "run_discovered_set",
                          exclude_run_id: Optional[str] = None) -> Optional[VisibilityMetricRow]:
        rows = self._t.find(lambda r: r.entity_name == entity_name and r.mode == mode and r.scope == scope
                            and r.run_id != exclude_run_id)
        return max(rows, key=lambda r: r.measured_at) if rows else None

    def delete_for_run(self, run_id: str) -> None:
        self._t.delete_where(lambda r: r.run_id == run_id)


class JsonComparisonRepository:
    def __init__(self, tables_dir: str):
        self._t = JsonTable(os.path.join(tables_dir, "competitor_comparisons.json"), CompetitorComparisonRow,
                            key_fn=lambda r: r.comparison_id)

    def insert(self, row: CompetitorComparisonRow) -> CompetitorComparisonRow:
        return self._t.insert(row)

    def get(self, comparison_id: str) -> Optional[CompetitorComparisonRow]:
        return self._t.get(comparison_id)

    def update(self, comparison_id: str, **fields: Any) -> CompetitorComparisonRow:
        return self._t.update(comparison_id, updated_at=utcnow(), **fields)

    def list_for_run(self, run_id: str, include_removed: bool = False) -> List[CompetitorComparisonRow]:
        rows = self._t.find(lambda r: r.run_id == run_id and (include_removed or r.removed_at is None))
        return sorted(rows, key=lambda r: (r.position, r.added_at))

    def find_by_domain(self, run_id: str, domain: str) -> Optional[CompetitorComparisonRow]:
        rows = self._t.find(lambda r: r.run_id == run_id and r.domain == domain)
        return rows[0] if rows else None

    def list_by_status(self, statuses: Sequence[ComparisonStatus]) -> List[CompetitorComparisonRow]:
        wanted = set(statuses)
        return self._t.find(lambda r: r.status in wanted)

    def list_referencing_snapshot(self, snapshot_id: str) -> List[CompetitorComparisonRow]:
        return self._t.find(lambda r: r.snapshot_id == snapshot_id)

    def list_removed_before(self, cutoff_iso: str) -> List[CompetitorComparisonRow]:
        return self._t.find(lambda r: r.removed_at is not None and r.removed_at < cutoff_iso)

    def delete(self, comparison_id: str) -> None:
        self._t.delete(comparison_id)
