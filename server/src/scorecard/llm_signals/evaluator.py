from pydantic import BaseModel
from src.signals.llm_signals import LlmSignals
from src.scorecard import Score, RawScoreCard, ProblemCard, Problem
from typing import List
import asyncio
import json
from src.signals.llm_signals.citation_prompts_evaluator_chain import PromptAnswerClusters
from src.signals.llm_signals import MarketComparison  # ← Add this import if not already present


async def calculate_llm_signals_score(llm_signals: LlmSignals, brand: str):
    """Calculate scores from LLM Signals with dual-mode + SOV"""

    if not llm_signals.status:
        return RawScoreCard(scores=[]), ProblemCard(problems=[Problem(
            signal_names=['cluster_presence', 'cluster_dominance', 'prompt_citation'],
            signal_path=['LLM Brand Analysis'],
            issue_found=llm_signals.issue_found or "Processing failed",
            cause_of_issue=llm_signals.cause_of_issue or "LLM Signals status is False"
        )])

    llm_signal_data = llm_signals.signals
    if not llm_signal_data:
        return RawScoreCard(scores=[]), ProblemCard(problems=[Problem(
            signal_names=['cluster_presence', 'cluster_dominance', 'prompt_citation'],
            signal_path=['LLM Brand Analysis'],
            issue_found="LLM Signals not found",
            cause_of_issue="Internal Server Error - no signal data available"
        )])

    clusters = llm_signal_data.citation_prompt_answers.root
    competitors: List[str] = llm_signal_data.competitors or []
    target_brand = brand

    scores = []

    # ====================== CLUSTER LEVEL SCORING ======================
    for cluster in clusters:
        cluster_name = cluster.cluster

        # --- 1. Cluster Presence ---
        cluster_has_brand = any(
            p.web_entity_mentioned or p.llm_entity_mentioned
            for p in cluster.prompts
        )

        scores.append(Score(
            value=1.0 if cluster_has_brand else -1.0,
            signal_name="cluster_presence",
            signal_path=["LLM Brand Analysis", "Cluster Presence"],
            remediation_plan=None if cluster_has_brand else f'Brand "{target_brand}" is missing in "{cluster_name}" cluster.',
            success_state=f'Brand "{target_brand}" is present in "{cluster_name}" cluster.' if cluster_has_brand else None
        ))

        # --- 2. Cluster Dominance ---
        brand_citations = sum(
            (p.web_entity_mentioned or p.llm_entity_mentioned) for p in cluster.prompts
        )

        competitor_counts = {}
        for comp in competitors:
            comp_count = sum(
                any(
                    c.competitor_entity == comp and c.is_competitor_mentioned
                    for c in (p.competitor_citations_web + p.competitor_citations_llm)
                )
                for p in cluster.prompts
            )
            competitor_counts[comp] = comp_count

        losing_competitors = [comp for comp, count in competitor_counts.items() if count > brand_citations]
        is_dominant = len(losing_competitors) == 0

        competitor_details = ", ".join(f"{comp}: {count}" for comp, count in competitor_counts.items())

        if is_dominant:
            scores.append(Score(
                value=1.0,
                signal_name="cluster_dominance",
                signal_path=["LLM Brand Analysis", "Cluster Dominance"],
                remediation_plan=None,
                success_state=f'Brand dominates "{cluster_name}". {competitor_details}'
            ))
        else:
            losing_str = ", ".join(f"{comp} ({competitor_counts[comp]})" for comp in losing_competitors)
            scores.append(Score(
                value=-1.0,
                signal_name="cluster_dominance",
                signal_path=["LLM Brand Analysis", "Cluster Dominance"],
                remediation_plan=f'Brand not dominant. Losing to: {losing_str}',
                success_state=None
            ))

        # --- 3. Prompt Level Citation ---
        for prompt_data in cluster.prompts:
            is_present = prompt_data.web_entity_mentioned or prompt_data.llm_entity_mentioned
            scores.append(Score(
                value=1.0 if is_present else -1.0,
                signal_name="prompt_citation",
                signal_path=["LLM Brand Analysis", cluster_name],
                remediation_plan=None if is_present else f'Brand missing for prompt: "{prompt_data.prompt}"',
                success_state=f'Brand mentioned for prompt: "{prompt_data.prompt}"' if is_present else None
            ))

    # # ====================== MARKET SOV + COVERAGE ======================
    # try:
    #     market_data = llm_signal_data.market_comparison_combined
    #     brand_data: MarketComparison = next(x for x in market_data if x.entity == target_brand)

    #     sov = brand_data.sov
    #     coverage = brand_data.cluster_coverage

    #     # SOV Score
    #     if sov >= 30:
    #         sov_value, sov_success, sov_rem = 1.0, f"Strong share of voice ({sov:.1f}%).", None
    #     elif sov >= 15:
    #         sov_value, sov_success, sov_rem = 0.0, None, f"Moderate SOV ({sov:.1f}%). Improve visibility."
    #     else:
    #         sov_value, sov_success, sov_rem = -1.0, None, f"Low SOV ({sov:.1f}%). Increase presence."

    #     scores.append(Score(
    #         value=sov_value,
    #         signal_name="sov",
    #         signal_path=["LLM Brand Analysis", "Market Presence"],
    #         remediation_plan=sov_rem,
    #         success_state=sov_success
    #     ))

    #     # Cluster Coverage Score
    #     if coverage >= 60:
    #         cov_value, cov_success, cov_rem = 1.0, f"Good cluster coverage ({coverage:.1f}%).", None
    #     else:
    #         cov_value, cov_success, cov_rem = -1.0, None, f"Low cluster coverage ({coverage:.1f}%). Expand content."

    #     scores.append(Score(
    #         value=cov_value,
    #         signal_name="cluster_coverage",
    #         signal_path=["LLM Brand Analysis", "Market Presence"],
    #         remediation_plan=cov_rem,
    #         success_state=cov_success
    #     ))

    # except StopIteration:
    #     print(f"Warning: Brand '{target_brand}' not found in market_comparison_combined")
    # except Exception as e:
    #     print(f"Warning: SOV/Coverage calculation failed: {e}")

    return RawScoreCard(scores=scores), ProblemCard(problems=[])


if __name__ == "__main__":
    async def main():
        import os
        script_dir = os.path.dirname(os.path.abspath(__file__))
        json_path = os.path.join(script_dir, 'test_example.json')

        with open(json_path, 'r') as f:
            test_data = json.load(f)

        # Since you dumped only llmsignals → directly load as LlmSignals
        llm_signals = LlmSignals.model_validate(test_data)

        # Get brand from entity_analysis if available, else fallback
        brand = "Test Brand"
        if llm_signals.signals and llm_signals.signals.entity_analysis:
            brand = llm_signals.signals.entity_analysis.entity

        print(f"Loaded LLM Signals successfully")
        print(f"Target brand detected: {brand}")
        print(f"Competitors: {len(llm_signals.signals.competitors) if llm_signals.signals else 0}")
        print("\n" + "=" * 70 + "\n")

        scorecard, problems = await calculate_llm_signals_score(llm_signals, brand)

        print("LLM SIGNALS SCORECARD RESULTS:")
        print("=" * 70)

        for i, score in enumerate(scorecard.scores, 1):
            if score.value > 0:
                status = "✅ PASS"
            elif score.value == 0:
                status = "⚠️  NEUTRAL"
            else:
                status = "❌ FAIL"

            print(f"\n{i}. {status} - {score.signal_name}")
            print(f"   Path : {' > '.join(score.signal_path)}")

            if score.success_state:
                print(f"   Success : {score.success_state}")
            if score.remediation_plan:
                print(f"   Remediation : {score.remediation_plan}")

        print("\n" + "=" * 70)

    asyncio.run(main())