from typing import Dict
from pydantic import BaseModel


class CategoryScoringResult(BaseModel):
    category_scores: Dict
    total_weighted_score: float
    max_possible_weighted_score: float
    percentage_influence: float


def calculate_category_scores(raw_scorecard, weights_config: Dict, brand: str = None) -> CategoryScoringResult:

    # -----------------------------
    # STEP 1: GROUP BY signal_name ✅
    # -----------------------------
    grouped = {}

    for score in raw_scorecard.scores:
        key = score.signal_name   # 🔥 FIX

        if key not in grouped:
            grouped[key] = []

        grouped[key].append(score)

    # -----------------------------
    # STEP 2: PROCESS CONFIG
    # -----------------------------
    category_results = {}

    final_total_weight = 0.0
    final_max_weight = 0.0

    for category_key, signals_config in weights_config.items():

        signals_output = []

        category_total_weight = 0.0
        category_max_weight = 0.0

        category_positive = 0
        category_negative = 0

        for signal_key, weight in signals_config.items():

            if signal_key == "total_weight":
                continue

            scores = grouped.get(signal_key, [])

            # -----------------------------
            # SIGNAL EXISTS
            # -----------------------------
            if scores:
                total = len(scores)
                positive = len([s for s in scores if s.value > 0])
                negative = total - positive

                percentage = (positive / total) * 100 if total > 0 else 0
                weighted = (percentage * weight) / 100

                max_weight = weight

            # -----------------------------
            # SIGNAL NOT PRESENT
            # -----------------------------
            else:
                total = 0
                positive = 0
                negative = 0
                percentage = 0
                weighted = 0
                max_weight = 0  # 🔥 IMPORTANT

            signals_output.append({
                "signal_name": signal_key,
                "positive_checks": positive,
                "negative_checks": negative,
                "total_checks": total,
                "total_percentage": percentage,
                "weightage_percentage": weight,
                "total_weightage_percentage": weighted,
                "max_possible_weightage_percentage": max_weight
            })

            category_total_weight += weighted
            category_max_weight += max_weight
            category_positive += positive
            category_negative += negative

        category_results[category_key] = {
            "category": category_key,
            "signals": signals_output,
            "total_weightage_percentage": category_total_weight,
            "max_possible_total_weightage_percentage": category_max_weight,
            "positive_checks": category_positive,
            "negative_checks": category_negative
        }

        final_total_weight += category_total_weight
        final_max_weight += category_max_weight

    percentage = (final_total_weight / final_max_weight * 100) if final_max_weight > 0 else 0

    return CategoryScoringResult(
        category_scores=category_results,
        total_weighted_score=final_total_weight,
        max_possible_weighted_score=final_max_weight,
        percentage_influence=percentage
    )