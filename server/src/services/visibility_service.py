"""AI-visibility scoring of any entity against a run's stored prompts and answers.

The web / LLM answers were generated from the prompts alone (competitors are never part of the
OpenAI request) and "mentioned" is a pure text check (``is_mentioned``). So any brand name - a
discovered competitor or one typed by the user - can be scored against the SAME prompts of a run with
**zero LLM calls**, and the numbers are directly comparable with the run's own.

Definitions (identical to ``find_llm_signals``):
* citations        = prompts whose answer mentions the entity
* SOV              = entity citations / citations of all entities in the set (relative -> depends on the set)
* cluster_coverage = clusters with at least one mentioning prompt / all clusters
"""
import hashlib
import json
from typing import Dict, List, Optional, Sequence

from src.config import SCORING_WEIGHTS
from src.signals.llm_signals.citation_prompts_evaluator_chain import PromptAnswerClusters, is_mentioned
from src.storage import AuditRunRow, EntityMentionRow, Storage, VisibilityMetricRow
from src.storage.ids import new_id, utcnow

MODES = ("combined", "web", "llm")

# The three LLM Brand Analysis checks (weights from config.json). The wording must match client/src/data/signal_labels.json
# (a test keeps them equal).
AI_SIGNALS = {
    "cluster_presence": "The brand is cited in at least one question of the topic.",
    "cluster_dominance": "No compared brand is named in more answers than this brand in the topic. A topic where nobody is named counts as held.",
    "prompt_citation": "The brand is cited for the question: it appears in at least one of the question's two answers.",
}


def entity_set_hash(entities: Sequence[str]) -> str:
    return hashlib.sha1(json.dumps(sorted(entities)).encode()).hexdigest()[:12]


def _dedupe(entities: Sequence[str]) -> List[str]:
    return list(dict.fromkeys(e.strip() for e in entities if e and e.strip()))


def compute_market_comparison(answers: PromptAnswerClusters, entities: Sequence[str]) -> Dict[str, List[dict]]:
    """Pure function: {mode: [{entity, sov, citations, cluster_coverage}]} for the entity set."""
    entities = _dedupe(entities)
    clusters = answers.root

    # mention facts per entity: list (per cluster) of list (per prompt) of (web, llm)
    facts: Dict[str, List[List[tuple]]] = {
        e: [[(is_mentioned(p.web_answer, e), is_mentioned(p.llm_answer, e)) for p in c.prompts] for c in clusters]
        for e in entities
    }

    def flag(pair, mode):
        return pair[0] if mode == "web" else pair[1] if mode == "llm" else (pair[0] or pair[1])

    out: Dict[str, List[dict]] = {}
    for mode in MODES:
        counts = {e: sum(flag(p, mode) for cl in facts[e] for p in cl) for e in entities}
        total = sum(counts.values())
        covered_clusters = {
            e: sum(1 for cl in facts[e] if any(flag(p, mode) for p in cl)) for e in entities
        }
        out[mode] = [
            {
                "entity": e,
                "sov": round(counts[e] / total * 100, 1) if total else 0.0,
                "citations": counts[e],
                "cluster_coverage": round(covered_clusters[e] / len(clusters) * 100, 1) if clusters else 0.0,
            }
            for e in entities
        ]
    return out


class VisibilityService:
    def __init__(self, storage: Storage):
        self.storage = storage

    # ---------------------------------------------------------------- loading
    def load_answers(self, run: AuditRunRow) -> Optional[PromptAnswerClusters]:
        """Stored answers of the run, or ``None`` for runs without an AI track (or from before storage existed)."""
        if not run.prompt_set_id:
            return None
        prompt_set = self.storage.prompts.get_set(run.prompt_set_id)
        if not prompt_set or not prompt_set.payload_blob_key:
            return None
        raw = self.storage.blobs.get(prompt_set.payload_blob_key)
        return PromptAnswerClusters.model_validate(raw) if raw else None

    # ---------------------------------------------------------------- scoring
    def score(self, run_id: str, extra_entities: Sequence[str] = (), mode: str = "combined",
              persist: bool = True) -> Optional[List[dict]]:
        """Score the run's brand + every entity in ``extra_entities`` on the run's stored prompts.

        Returns ``None`` when the run has no stored answers (visibility unavailable). SOV is relative to
        exactly this entity set. Mention facts and dated metrics are persisted unless ``persist=False``.
        """
        run = self.storage.runs.get(run_id)
        answers = self.load_answers(run) if run else None
        if not run or answers is None:
            return None
        brand = self.storage.brands.get(run.brand_id)
        entities = _dedupe([brand.name, *extra_entities])
        result = compute_market_comparison(answers, entities)

        if persist:
            self._persist_mentions(run, answers, entities)
            self._persist_metrics(run, result, entities, scope="comparison_set")
        return result[mode]

    def record_run_metrics(self, run: AuditRunRow, answers: PromptAnswerClusters, entities: Sequence[str],
                           original: Dict[str, List[dict]]) -> None:
        """At run time: store mention facts and freeze the run's own (original) numbers, dated."""
        entities = _dedupe(entities)
        self._persist_mentions(run, answers, entities)
        self._persist_metrics(run, original, entities, scope="run_discovered_set")

    # ------------------------------------------------------------- references
    def reference_for(self, entity_name: str, exclude_run_id: Optional[str] = None) -> Optional[dict]:
        """Latest dated visibility of an entity measured in some OTHER run (different prompt set => reference only)."""
        row = self.storage.visibility.latest_for_entity(entity_name.strip(), exclude_run_id=exclude_run_id)
        if not row:
            return None
        run = self.storage.runs.get(row.run_id)
        brand = self.storage.brands.get(run.brand_id) if run else None
        return {
            "entity": row.entity_name, "sov": row.sov, "citations": row.citations,
            "cluster_coverage": row.cluster_coverage, "measured_at": row.measured_at,
            "measured_for_brand": brand.name if brand else None, "run_id": row.run_id,
        }

    def trend_for_brand(self, brand_id: str) -> List[dict]:
        """The brand's own AI visibility at each of its runs (oldest first). Each point is measured on that
        run's own prompt set, so it shows the trend of the brand, not a like-for-like prompt comparison."""
        brand = self.storage.brands.get(brand_id)
        if not brand:
            return []
        points = []
        for run in self.storage.runs.list_for_brand(brand_id, limit=10_000):
            row = next((m for m in self.storage.visibility.list_for_run(run.run_id, scope="run_discovered_set")
                        if m.entity_name == brand.name and m.mode == "combined"), None)
            if not row:
                continue
            site = self.storage.sites.get(run.site_id)
            points.append({
                "run_id": run.run_id, "measured_at": row.measured_at, "geo": run.geo,
                "domain": site.domain if site else None, "sov": row.sov, "citations": row.citations,
                "cluster_coverage": row.cluster_coverage, "percentage": run.percentage,
                "technical_percentage": run.technical_percentage,
            })
        return sorted(points, key=lambda p: p["measured_at"])

    # ------------------------------------------------------- AI-visibility score
    def ai_scores(self, run_id: str) -> Optional[Dict[str, dict]]:
        """The audit's AI-visibility checks (topic presence, topic dominance, prompt citation) for EVERY tracked brand.

        Same definitions and weights as the audit's own scoring, applied to the stored answers of the run, so a
        competitor is measured on exactly the same prompts as the brand. Dominance is judged against the brands in the
        comparison (the brand and the competitors the user added). ``None`` when the run has no stored answers.
        """
        run = self.storage.runs.get(run_id)
        answers = self.load_answers(run) if run else None
        if not run or answers is None:
            return None
        names = [e["name"] for e in self.tracked_entities(run, include_discovered=False)]
        weights = {k: float(SCORING_WEIGHTS.get("llm_signals", {}).get(k, 0)) for k in AI_SIGNALS}

        # mentions[name][cluster_idx] = list of bool per prompt (web or model answer)
        mentions = {
            n: [[is_mentioned(p.web_answer, n) or is_mentioned(p.llm_answer, n) for p in c.prompts] for c in answers.root]
            for n in names
        }
        counts = {n: [sum(cl) for cl in mentions[n]] for n in names}

        out: Dict[str, dict] = {}
        for n in names:
            presence = [c > 0 for c in counts[n]]
            dominance = [counts[n][i] >= max((counts[o][i] for o in names if o != n), default=0)
                         for i in range(len(answers.root))]
            citation = [m for cl in mentions[n] for m in cl]
            signals, earned = [], 0.0
            for key, flags in (("cluster_presence", presence), ("cluster_dominance", dominance), ("prompt_citation", citation)):
                passed, total = sum(flags), len(flags)
                got = weights[key] * passed / total if total else 0.0
                earned += got
                signals.append({"signal_name": key, "label": AI_SIGNALS[key], "weight": weights[key],
                                "passed": passed, "total": total, "earned": round(got, 1)})
            full = sum(weights.values())
            out[n] = {"earned": round(earned, 1), "full": full, "score_pct": round(earned / full * 100, 1) if full else None,
                      "signals": signals}
        return out

    # ----------------------------------------------------- mentions summary
    def mention_summary(self, run_id: str) -> Optional[dict]:
        """Counts behind the "Who AI assistants mention" story: questions asked, how often every brand was named
        (in total, in web-search answers, in model answers) and how often per topic. ``None`` without stored answers."""
        run = self.storage.runs.get(run_id)
        answers = self.load_answers(run) if run else None
        if not run or answers is None:
            return None
        entities = self.tracked_entities(run, include_discovered=False)
        clusters, totals = [], {e["name"]: {"citations": 0, "web": 0, "llm": 0} for e in entities}
        for cluster in answers.root:
            counts = {e["name"]: 0 for e in entities}
            for p in cluster.prompts:
                for e in entities:
                    web, llm = is_mentioned(p.web_answer, e["name"]), is_mentioned(p.llm_answer, e["name"])
                    totals[e["name"]]["web"] += web
                    totals[e["name"]]["llm"] += llm
                    if web or llm:
                        counts[e["name"]] += 1
                        totals[e["name"]]["citations"] += 1
            clusters.append({"cluster": cluster.cluster, "prompts": len(cluster.prompts), "counts": counts})
        return {
            "total_prompts": sum(c["prompts"] for c in clusters), "topics": len(clusters),
            "entities": [{**e, **totals[e["name"]]} for e in entities], "clusters": clusters,
        }

    # ----------------------------------------------------------- prompts lab
    def tracked_entities(self, run: AuditRunRow, include_discovered: bool = True) -> List[dict]:
        """The brand, the AI-discovered competitors of this run (optional) and the competitors the user added.

        The Prompts Lab uses all of them (every rival AI names matters there); the Competitor tab only compares the
        brand with the competitors the user added (``include_discovered=False``).
        """
        brand = self.storage.brands.get(run.brand_id)
        discovered = [m.entity_name for m in self.storage.visibility.list_for_run(run.run_id, scope="run_discovered_set")
                      if m.mode == "combined"] if include_discovered else []
        added = [c.competitor_name for c in self.storage.comparisons.list_for_run(run.run_id) if c.status.value == "done"]
        out, seen = [], set()
        for name, kind in [(brand.name, "brand"), *[(n, "discovered") for n in discovered], *[(n, "added") for n in added]]:
            if name and name not in seen:
                seen.add(name)
                out.append({"name": name, "kind": "added" if name in added and kind == "discovered" else kind})
        return out

    def prompt_matrix(self, run_id: str) -> Optional[dict]:
        """Every prompt of the run with both stored answers and who was mentioned in which answer.

        Mentions are computed from the stored answers (same text check as the audit), so competitors the user added
        later are included without any new AI call. ``None`` when the run has no stored answers.
        """
        run = self.storage.runs.get(run_id)
        answers = self.load_answers(run) if run else None
        if not run or answers is None:
            return None
        entities = self.tracked_entities(run)
        clusters, index = [], 0
        for cluster in answers.root:
            prompts = []
            for p in cluster.prompts:
                prompts.append({
                    "index": index, "prompt": p.prompt, "web_answer": p.web_answer, "llm_answer": p.llm_answer,
                    "mentions": {e["name"]: {"web": is_mentioned(p.web_answer, e["name"]),
                                             "llm": is_mentioned(p.llm_answer, e["name"])} for e in entities},
                })
                index += 1
            clusters.append({"cluster": cluster.cluster, "prompts": prompts})
        return {"run_id": run_id, "entities": entities, "clusters": clusters, "prompt_count": index}

    # ---------------------------------------------------------------- storage
    def _persist_mentions(self, run: AuditRunRow, answers: PromptAnswerClusters, entities: Sequence[str]) -> None:
        prompts = self.storage.prompts.list_prompts(run.prompt_set_id)
        flat = [p for c in answers.root for p in c.prompts]
        if len(prompts) != len(flat):  # stored prompt rows and answers must line up 1:1
            return
        now = utcnow()
        self.storage.mentions.upsert_many([
            EntityMentionRow(
                prompt_set_id=run.prompt_set_id, prompt_id=row.prompt_id, entity_name=e,
                mentioned_web=is_mentioned(ans.web_answer, e), mentioned_llm=is_mentioned(ans.llm_answer, e),
                evaluated_at=now,
            )
            for e in entities for row, ans in zip(prompts, flat)
        ])

    def _persist_metrics(self, run: AuditRunRow, by_mode: Dict[str, List[dict]], entities: Sequence[str],
                         scope: str) -> None:
        set_hash, now = entity_set_hash(entities), utcnow()
        self.storage.visibility.insert_many([
            VisibilityMetricRow(
                metric_id=new_id(), run_id=run.run_id, prompt_set_id=run.prompt_set_id, entity_name=m["entity"],
                scope=scope, entity_set_hash=set_hash, mode=mode, sov=m["sov"], citations=m["citations"],
                cluster_coverage=m["cluster_coverage"], measured_at=now,
            )
            for mode, rows in by_mode.items() for m in rows
        ])
