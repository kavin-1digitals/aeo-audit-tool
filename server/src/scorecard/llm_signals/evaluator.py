from pydantic import BaseModel, computed_field
from src.signals.llm_signals import LlmSignals
from src.scorecard import Score, RawScoreCard
from src.config import NUM_PROMPTS
from typing import Optional, List
import asyncio
import json
from src.signals.llm_signals.citation_prompts_evaluator_chain import PromptAnswerClusters
from src.signals.llm_signals import LlmSignals

async def calculate_llm_signals_score(llm_signals: LlmSignals):
    """New scoring using PromptAnswerClusters"""

    clusters = llm_signals.citation_prompt_answers.root
    competitors = llm_signals.competitors
    target_brand = llm_signals.competitors[0] if llm_signals.competitors else "Unknown"

    scores = []

    # -----------------------------
    # ITERATE CLUSTERS
    # -----------------------------
    for cluster in clusters:

        cluster_name = cluster.cluster

        # -----------------------------
        # CLUSTER: BRAND PRESENCE
        # -----------------------------
        if cluster.is_brand_mentioned:
            scores.append(Score(
                value=1.0,
                signal_name="cluster_presence",
                signal_path=["LLM Signals", "Cluster Presence"],
                remediation_plan=None,
                success_state=f'Brand "{target_brand}" is present in "{cluster_name}" cluster.'
            ))
        else:
            scores.append(Score(
                value=-1.0,
                signal_name="cluster_presence",
                signal_path=["LLM Signals", "Cluster Presence"],
                remediation_plan=f'Brand "{target_brand}" is missing in "{cluster_name}" cluster. Create content targeting this intent category to improve visibility.',
                success_state=None
            ))

        # -----------------------------
        # CLUSTER: DOMINANCE (UPDATED LOGIC)
        # -----------------------------

        # Brand citation count (per prompt → 1 max)
        brand_citations = sum(p.is_brand_mentioned for p in cluster.prompts)

        # Competitor-wise citation counts
        competitor_counts = {}

        for comp in competitors:
            comp_count = sum(
                any(
                    c.competitor_brand == comp and c.is_competitor_mentioned
                    for c in p.competitor_citations
                )
                for p in cluster.prompts
            )
            competitor_counts[comp] = comp_count

        # Check dominance condition
        losing_competitors = [
            comp for comp, count in competitor_counts.items()
            if count > brand_citations
        ]

        is_dominant = len(losing_competitors) == 0

        # Build detailed message
        competitor_details = ", ".join(
            [f"{comp}: {count}" for comp, count in competitor_counts.items()]
        )

        if is_dominant:
            scores.append(Score(
                value=1.0,
                signal_name="cluster_dominance",
                signal_path=["LLM Signals", "Cluster Dominance"],
                remediation_plan=None,
                success_state=(
                    f'Brand "{target_brand}" dominates "{cluster_name}" cluster. '
                    f'Brand citations: {brand_citations}. '
                    f'Competitor citations → {competitor_details}. '
                    f'No competitor exceeds the brand.'
                )
            ))
        else:
            losing_str = ", ".join(
                [f"{comp} ({competitor_counts[comp]})" for comp in losing_competitors]
            )

            scores.append(Score(
                value=-1.0,
                signal_name="cluster_dominance",
                signal_path=["LLM Signals", "Cluster Dominance"],
                remediation_plan=(
                    f'Brand "{target_brand}" is not dominant in "{cluster_name}" cluster. '
                    f'Brand citations: {brand_citations}. '
                    f'Competitors outperforming brand: {losing_str}. '
                    f'Full competitor breakdown → {competitor_details}. '
                    f'Increase brand mentions in this cluster to exceed competitors.'
                ),
                success_state=None
            ))

        # -----------------------------
        # ITERATE PROMPTS
        # -----------------------------
        for prompt_data in cluster.prompts:

            if prompt_data.is_brand_mentioned:
                scores.append(Score(
                    value=1.0,
                    signal_name="prompt_citation",
                    signal_path=["LLM Signals", cluster_name],
                    remediation_plan=None,
                    success_state=f'Brand mentioned for prompt: "{prompt_data.prompt}"'
                ))
            else:
                scores.append(Score(
                    value=-1.0,
                    signal_name="prompt_citation",
                    signal_path=["LLM Signals", cluster_name],
                    remediation_plan=f'Brand missing for prompt: "{prompt_data.prompt}". Improve content targeting this query.',
                    success_state=None
                ))

    return RawScoreCard(scores=scores)

if __name__ == "__main__":

    async def main():
        # Load test data from JSON file using relative path
        import os
        script_dir = os.path.dirname(os.path.abspath(__file__))
        json_path = os.path.join(script_dir, 'test_example.json')
        
        with open(json_path, 'r') as f:
            test_data = json.load(f)
        
        # Create LlmSignals object from test data
        llm_signals = LlmSignals(
            competitors=test_data['competitors'],
            citation_prompt_answers=PromptAnswerClusters(root=test_data['citation_prompt_answers'])
        )
        
        print(f"Testing with {len(test_data['competitors'])} competitors and {len(test_data['citation_prompt_answers'])} clusters")
        print(f"Target brand: {llm_signals.competitors[0] if llm_signals.competitors else 'Unknown'}")
        print("\n" + "="*50 + "\n")
        
        # Calculate scores
        scorecard = await calculate_llm_signals_score(llm_signals)
        
        # Print results
        print("LLM SIGNALS SCORECARD RESULTS:")
        print("="*50)
        
        for i, score in enumerate(scorecard.scores, 1):
            status = "✅ PASS" if score.value > 0 else "❌ FAIL"
            print(f"\n{i}. {status} - {score.signal_name}")
            print(f"   Path: {' > '.join(score.signal_path)}")
            if score.success_state:
                print(f"   Success: {score.success_state}")
            if score.remediation_plan:
                print(f"   Action: {score.remediation_plan}")
        
        # Summary
        total_scores = len(scorecard.scores)
        passed_scores = sum(1 for s in scorecard.scores if s.value > 0)
        failed_scores = total_scores - passed_scores
        
        print(f"\n" + "="*50)
        print(f"SUMMARY: {passed_scores}/{total_scores} passed ({passed_scores/total_scores*100:.1f}%)")
        print(f"Passed: {passed_scores} | Failed: {failed_scores}")
    
    asyncio.run(main())