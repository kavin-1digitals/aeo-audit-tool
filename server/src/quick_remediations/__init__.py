from pydantic import BaseModel
from typing import List, Dict, Any
import json
import os
from src.config import SCORING_WEIGHTS as weights

# -----------------------------
# CONFIG LOADER
# -----------------------------
def load_config():
    config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'quick_remediations_config.json')
    try:
        with open(config_path, 'r') as f:
            return json.load(f)
    except Exception:
        return {}


# -----------------------------
# MODELS
# -----------------------------
class RemediationPlan(BaseModel):
    category: str
    title: str
    description: str
    difficulty: str
    impact_level: str
    signals_count: int
    signal_names: List[str]
    current_score: float
    target_score: float
    improvement_percentage: float


class QuickRemediations(BaseModel):
    current_overall_score: float
    plans: List[RemediationPlan]


# -----------------------------
# WEIGHT HELPERS
# -----------------------------
def get_signal_weight(signal_name: str, weights: Dict) -> float:
    for category in weights.values():
        if isinstance(category, dict):
            if signal_name in category:
                return category[signal_name]
    return 0.0


# -----------------------------
# CORE IMPROVEMENT CALCULATION
# -----------------------------
def calculate_weighted_improvement(signals: List[Dict], weights: Dict) -> float:
    total = 0.0

    for s in signals:
        signal_name = s.get("signal_name")
        value = s.get("value", 0)

        weight = get_signal_weight(signal_name, weights)

        contribution = weight * (1 - max(0, value))
        total += contribution

    return total


def calculate_target_score(current_score: float, delta: float, max_possible: float) -> float:
    if max_possible == 0:
        return current_score

    raw_improvement = (delta / max_possible) * 100

    # 🔥 CRITICAL FIX: cap by remaining headroom
    allowed_improvement = max(0.0, 100.0 - current_score)

    improvement = min(raw_improvement, allowed_improvement)

    return current_score + improvement


# -----------------------------
# MAIN FUNCTION
# -----------------------------
def analyze_quick_remediations(
    scorecard_data: Dict[str, Any],
) -> QuickRemediations:

    current_score = scorecard_data.get("percentage", 0)
    max_possible = scorecard_data.get("max_possible_score", 0)

    raw_scores = scorecard_data.get("raw_scorecard", {}).get("scores", [])

    # -----------------------------
    # GROUP FAILING SIGNALS
    # -----------------------------
    signal_groups = {}

    for s in raw_scores:
        if s.get("value", 0) < 1.0:
            name = s.get("signal_name")
            if name not in signal_groups:
                signal_groups[name] = []
            signal_groups[name].append(s)

    if not signal_groups:
        return QuickRemediations(current_overall_score=current_score, plans=[])

    # -----------------------------
    # GROUPED STRUCTURE
    # -----------------------------
    grouped = []
    for name, instances in signal_groups.items():
        grouped.append({
            "name": name,
            "instances": instances,
            "difficulty": assess_difficulty(instances)
        })

    # Sort by difficulty (Easy → Hard)
    grouped = sorted(grouped, key=lambda x: (
        x["difficulty"] != "Easy",
        x["difficulty"] == "Hard"
    ))

    total_types = len(grouped)

    def flatten(items):
        res = []
        for i in items:
            res.extend(i["instances"])
        return res

    plans = []

    # -----------------------------
    # CASE LOGIC
    # -----------------------------
    if total_types < 3:
        items = flatten(grouped)

        delta = calculate_weighted_improvement(items, weights)
        target = calculate_target_score(current_score, delta, max_possible)

        plans.append(build_plan(
            "Complete Fix",
            items,
            grouped,
            current_score,
            target,
            delta,
            max_possible
        ))

    elif total_types < 5:
        split = 2 if total_types > 3 else 1

        quick = grouped[:split]
        rest = grouped[split:]

        # Quick Fix
        q_items = flatten(quick)
        q_delta = calculate_weighted_improvement(q_items, weights)
        q_target = calculate_target_score(current_score, q_delta, max_possible)

        plans.append(build_plan(
            "Quick Fix",
            q_items,
            quick,
            current_score,
            q_target,
            q_delta,
            max_possible
        ))

        # Complete Fix
        r_items = flatten(rest)
        r_delta = calculate_weighted_improvement(r_items, weights)
        r_target = calculate_target_score(q_target, r_delta, max_possible)

        plans.append(build_plan(
            "Complete Fix",
            r_items,
            rest,
            q_target,
            r_target,
            r_delta,
            max_possible
        ))

    else:
        q_count = max(1, total_types // 3)
        s_count = max(1, (total_types - q_count) // 2)

        quick = grouped[:q_count]
        secondary = grouped[q_count:q_count + s_count]
        rest = grouped[q_count + s_count:]

        # Quick
        q_items = flatten(quick)
        q_delta = calculate_weighted_improvement(q_items, weights)
        q_target = calculate_target_score(current_score, q_delta, max_possible)

        plans.append(build_plan(
            "Quick Fix",
            q_items,
            quick,
            current_score,
            q_target,
            q_delta,
            max_possible
        ))

        # Secondary
        s_items = flatten(secondary)
        s_delta = calculate_weighted_improvement(s_items, weights)
        s_target = calculate_target_score(q_target, s_delta, max_possible)

        plans.append(build_plan(
            "Secondary Fix",
            s_items,
            secondary,
            q_target,
            s_target,
            s_delta,
            max_possible
        ))

        # Complete
        c_items = flatten(rest)
        c_delta = calculate_weighted_improvement(c_items, weights)
        c_target = calculate_target_score(s_target, c_delta, max_possible)

        plans.append(build_plan(
            "Complete Fix",
            c_items,
            rest,
            s_target,
            c_target,
            c_delta,
            max_possible
        ))

    return QuickRemediations(
        current_overall_score=current_score,
        plans=plans
    )


# -----------------------------
# PLAN BUILDER
# -----------------------------
def build_plan(
    category,
    instances,
    grouped_items,
    current_score,
    target_score,
    delta,
    max_possible
):
    config = load_config()

    if max_possible:
        raw_improvement = (delta / max_possible) * 100
        allowed_improvement = max(0.0, 100.0 - current_score)
        improvement_pct = min(raw_improvement, allowed_improvement)
    else:
        improvement_pct = 0

    return RemediationPlan(
        category=category,
        title=config.get("category_priorities", {}).get(category, {}).get("title", category),
        description=config.get("category_priorities", {}).get(category, {}).get("description", "").format(
            signals_count=len(instances)
        ),
        difficulty=assess_difficulty(instances),
        impact_level=assess_impact(improvement_pct),
        signals_count=len(instances),
        signal_names=[g["name"] for g in grouped_items],
        current_score=round(current_score, 2),
        target_score=round(target_score, 2),
        improvement_percentage=round(improvement_pct, 2)
    )


# -----------------------------
# HELPERS
# -----------------------------
def assess_difficulty(signals):
    if len(signals) <= 2:
        return "Easy"
    elif len(signals) <= 5:
        return "Medium"
    return "Hard"


def assess_impact(improvement):
    if improvement > 15:
        return "High"
    elif improvement > 7:
        return "Medium"
    return "Low"