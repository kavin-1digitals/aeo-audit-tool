"""Persists the reusable artefacts of a finished run (beyond the report itself).

* ``site_snapshots``  - technical (domain + site) result of the website
* ``prompt_sets`` / ``prompts`` + answers blob - the prompts used and the raw web/LLM answers, so any
  entity can later be re-scored against the same prompts without new LLM calls
* ``brand_competitors`` - competitors discovered for the brand
"""
import hashlib
import json
from typing import Dict, List, Optional, Tuple

from src.api.schemas import AuditResponse
from src.config import SCORING_WEIGHTS
from src.services.site_facts import extract_site_facts
from src.services.visibility_service import VisibilityService
from src.storage import (
    AuditRunRow, PromptRow, PromptSetRow, SiteSnapshotRow, Storage,
)
from src.storage.ids import new_id

LLM_SIGNAL_NAMES = set(SCORING_WEIGHTS.get("llm_signals", {}).keys()) - {"total_weight"}


def scoring_config_hash() -> str:
    return hashlib.sha1(json.dumps(SCORING_WEIGHTS, sort_keys=True).encode()).hexdigest()[:12]


def site_types_key(site_types: Optional[List[str]]) -> str:
    return ",".join(sorted(t.lower() for t in (site_types or [])))


def technical_percentage(category_scores: Optional[Dict]) -> Optional[float]:
    """Domain + site score only (LLM excluded) so it is comparable between a brand and a competitor."""
    if not category_scores:
        return None
    got = peak = 0.0
    for key in ("domain_signals", "site_signals"):
        cat = category_scores.get(key) or {}
        got += cat.get("total_weightage_percentage", 0) or 0
        peak += cat.get("max_possible_total_weightage_percentage", 0) or 0
    return round(got / peak * 100, 1) if peak else None


def persist_run_artifacts(storage: Storage, run: AuditRunRow, report: AuditResponse) -> Dict:
    """Store snapshot / prompts / answers / competitors. Returns fields to update on the run row."""
    scorecard = report.scorecard
    tech_pct = technical_percentage(scorecard.category_scores)
    scrapable = True
    if report.signals and report.signals.site_signals:
        scrapable = bool(report.signals.site_signals.is_scrapable)

    # ---- technical snapshot
    facts = extract_site_facts(report.signals) if report.signals else {}
    tech_scores = [
        s.model_dump(mode="json") for s in scorecard.raw_scorecard.scores if s.signal_name not in LLM_SIGNAL_NAMES
    ]
    snapshot_id = new_id()
    blob_key = storage.blobs.put(f"snapshots/{snapshot_id}.json", {"scores": tech_scores})
    storage.snapshots.insert(SiteSnapshotRow(
        snapshot_id=snapshot_id, site_id=run.site_id, site_types_key=site_types_key(run.site_types),
        technical_percentage=tech_pct, category_scores=scorecard.category_scores or {},
        site_scrapable=scrapable, scoring_config_hash=scoring_config_hash(), payload_blob_key=blob_key,
        facts=facts, pages_analysed=(facts.get("site") or {}).get("pages_analysed"),
    ))
    updates: Dict = {"site_snapshot_id": snapshot_id, "technical_percentage": tech_pct}

    # ---- prompts + raw answers + competitors (only when the AI track produced data)
    llm = report.signals.llm_signals if report.signals else None
    if llm and llm.status and llm.signals:
        answers = llm.signals.citation_prompt_answers
        prompt_set_id = new_id()
        answers_key = storage.blobs.put(f"prompt_sets/{prompt_set_id}.json", answers.model_dump(mode="json"))
        prompts: List[PromptRow] = []
        for cluster in answers.root:
            for p in cluster.prompts:
                prompts.append(PromptRow(
                    prompt_id=new_id(), prompt_set_id=prompt_set_id, cluster=cluster.cluster,
                    text=p.prompt, position=len(prompts),
                ))
        storage.prompts.insert_set(
            PromptSetRow(prompt_set_id=prompt_set_id, brand_id=run.brand_id, run_id=run.run_id,
                         geo=run.geo, payload_blob_key=answers_key),
            prompts,
        )
        storage.competitors.upsert_discovered(run.brand_id, llm.signals.competitors, run.run_id)
        updates["prompt_set_id"] = prompt_set_id

        # Mention facts + the run's own (frozen) visibility numbers, dated.
        sig = llm.signals
        original = {
            "combined": [m.model_dump() for m in sig.market_comparison_combined],
            "web": [m.model_dump() for m in sig.market_comparison_web],
            "llm": [m.model_dump() for m in sig.market_comparison_llm],
        }
        VisibilityService(storage).record_run_metrics(
            run.model_copy(update={"prompt_set_id": prompt_set_id}), answers,
            [m["entity"] for m in original["combined"]], original,
        )

    return updates


def snapshot_in_use(storage: Storage, snapshot_id: str, exclude_run_id: Optional[str] = None,
                    exclude_comparison_id: Optional[str] = None) -> bool:
    snap = storage.snapshots.get(snapshot_id)
    if not snap:
        return False
    if any(r.run_id != exclude_run_id and r.site_snapshot_id == snapshot_id
           for r in storage.runs.list_for_site(snap.site_id)):
        return True
    return any(c.comparison_id != exclude_comparison_id
               for c in storage.comparisons.list_referencing_snapshot(snapshot_id))


def release_snapshot(storage: Storage, snapshot_id: Optional[str], exclude_run_id: Optional[str] = None,
                     exclude_comparison_id: Optional[str] = None) -> None:
    """Snapshots are shared between runs and competitor comparisons; drop one only when nothing else uses it."""
    if not snapshot_id or snapshot_in_use(storage, snapshot_id, exclude_run_id, exclude_comparison_id):
        return
    snap = storage.snapshots.get(snapshot_id)
    if snap and snap.payload_blob_key:
        storage.blobs.delete(snap.payload_blob_key)
    storage.snapshots.delete(snapshot_id)


def delete_comparison_artifacts(storage: Storage, comparison) -> None:
    storage.stages.delete_for_run(comparison.comparison_id)
    storage.events.delete_for_run(comparison.comparison_id)
    storage.comparisons.delete(comparison.comparison_id)
    release_snapshot(storage, comparison.snapshot_id, exclude_comparison_id=comparison.comparison_id)


def delete_run_artifacts(storage: Storage, run: AuditRunRow) -> None:
    """Remove everything owned by a run (including its competitor comparisons)."""
    for comparison in storage.comparisons.list_for_run(run.run_id, include_removed=True):
        delete_comparison_artifacts(storage, comparison)
    storage.stages.delete_for_run(run.run_id)
    storage.events.delete_for_run(run.run_id)
    storage.blobs.delete_prefix(f"runs/{run.run_id}")
    storage.visibility.delete_for_run(run.run_id)
    if run.prompt_set_id:
        storage.mentions.delete_for_prompt_set(run.prompt_set_id)
        ps = storage.prompts.get_set(run.prompt_set_id)
        if ps and ps.payload_blob_key:
            storage.blobs.delete(ps.payload_blob_key)
        storage.prompts.delete_set(run.prompt_set_id)
    release_snapshot(storage, run.site_snapshot_id, exclude_run_id=run.run_id)
