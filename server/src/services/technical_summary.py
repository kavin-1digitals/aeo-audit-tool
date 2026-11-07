"""Turns a snapshot's ``category_scores`` into the numbers the Competitor tab shows.

The score is "points earned out of points ANALYSED", and the analysis itself covers only part of the
full scale: signals that could not be checked (blocked by bot protection, site not crawlable, ...) carry
no weight, they are not counted as failures. ``coverage_pct`` says how much of the scale was analysed,
``confidence`` how far the score can be trusted for comparisons.
"""
from typing import Dict, Optional

CATEGORY_LABELS = {"domain_signals": "Domain signals", "site_signals": "Site signals"}
TECHNICAL_CATEGORIES = tuple(CATEGORY_LABELS)

FULL_CONFIDENCE = 80.0
PARTIAL_CONFIDENCE = 40.0


def _pct(part: float, whole: float) -> Optional[float]:
    return round(part / whole * 100, 1) if whole else None


def confidence_for(coverage_pct: Optional[float]) -> str:
    if coverage_pct is None:
        return "limited"
    if coverage_pct >= FULL_CONFIDENCE:
        return "full"
    return "partial" if coverage_pct >= PARTIAL_CONFIDENCE else "limited"


def summarize(category_scores: Optional[Dict]) -> Optional[dict]:
    if not category_scores:
        return None
    categories = []
    totals = {"earned": 0.0, "analysed": 0.0, "full": 0.0, "passed": 0, "failed": 0}
    for key in TECHNICAL_CATEGORIES:
        cat = category_scores.get(key)
        if not cat:
            continue
        earned = cat.get("total_weightage_percentage", 0) or 0
        analysed = cat.get("max_possible_total_weightage_percentage", 0) or 0
        full = sum((s.get("weightage_percentage", 0) or 0) for s in cat.get("signals", []))
        passed, failed = cat.get("positive_checks", 0) or 0, cat.get("negative_checks", 0) or 0
        categories.append({
            "key": key, "label": CATEGORY_LABELS[key],
            "earned": round(earned, 1), "analysed": round(analysed, 1), "full": round(full, 1),
            "score_pct": _pct(earned, analysed), "coverage_pct": _pct(analysed, full),
            "passed": passed, "failed": failed, "checks": passed + failed,
        })
        totals["earned"] += earned; totals["analysed"] += analysed; totals["full"] += full
        totals["passed"] += passed; totals["failed"] += failed
    if not categories:
        return None
    coverage = _pct(totals["analysed"], totals["full"])
    return {
        "earned": round(totals["earned"], 1), "analysed": round(totals["analysed"], 1), "full": round(totals["full"], 1),
        "score_pct": _pct(totals["earned"], totals["analysed"]), "coverage_pct": coverage,
        "passed": totals["passed"], "failed": totals["failed"], "checks": totals["passed"] + totals["failed"],
        "confidence": confidence_for(coverage), "categories": categories,
    }
