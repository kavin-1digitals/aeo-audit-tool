import logging
import asyncio
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

from .citation_prompts_chain import safe_invoke as async_generate_citation_prompts
from .competitors_chain import competitors_chain, safe_invoke as async_find_competitors
from .citation_prompts_evaluator_chain import (
    citation_prompts_evaluator_chain,
    safe_invoke as async_evaluate_citation_prompts,
    PromptAnswerClusters
)
from .evaluator import evaluate
from .brain_analysis_chain import BrandAnalysis
from src.config import LLM_PROVIDERS, NUM_PROMPTS, NUM_COMPETITORS

logger = logging.getLogger(__name__)


# -----------------------------
# Patch: Add `.clusters` alias (FIX)
# -----------------------------
# This avoids changing rest of your code
if not hasattr(PromptAnswerClusters, "clusters"):
    PromptAnswerClusters.clusters = property(lambda self: self.root)


# -----------------------------
# Models
# -----------------------------

class MarketComparison(BaseModel):
    brand: str
    brand_sov: float
    brand_citations: int
    cluster_coverage: float


class LlmSignals(BaseModel):
    competitors: list[str]
    brand_analysis: BrandAnalysis
    citation_prompt_answers: Optional[PromptAnswerClusters] = None
    market_comparison: List[MarketComparison]
    low_confidence_reasoning: Optional[str] = None


# -----------------------------
# Main Function
# -----------------------------

async def find_llm_signals(brand: str, geo: str) -> LlmSignals:
    """Find all LLM signals for a brand"""
    logger.info(f"Starting LLM signals analysis for brand: {brand}")

    # -----------------------------
    # Phase 1: Generate citation prompts and find competitors
    # -----------------------------
    logger.info("Phase 1: Generating citation prompts and finding competitors")

    # Get brand analysis and citation prompts
    brand_analysis, clusters_result = await async_generate_citation_prompts(
        brand, geo
    )

    # Find competitors in parallel
    competitors_task = asyncio.create_task(
        async_find_competitors(competitors_chain, {
            "brand": brand,
            "geo": geo,
        })
    )

    competitors_result = await competitors_task
    if isinstance(competitors_result, Exception):
        logger.error(f"Error finding competitors: {competitors_result}")
        raise competitors_result

    competitors_list = competitors_result.competitors

    # -----------------------------
    # Check if prompts were generated
    # -----------------------------
    if clusters_result is None:
        logger.warning("No citation prompts generated due to low confidence")
        
        # Create empty market comparison with just the brand
        market_comparison = [
            MarketComparison(
                brand=brand,
                brand_sov=0.0,
                brand_citations=0,
                cluster_coverage=0.0
            )
        ]
        
        return LlmSignals(
            competitors=list(competitors_list),
            brand_analysis=brand_analysis,
            citation_prompt_answers=None,
            market_comparison=market_comparison,
            low_confidence_reasoning=f"Low confidence score ({brand_analysis.brand_confidence:.2f}) - insufficient brand information for prompt generation"
        )

    logger.info(
        f"Generated {len(clusters_result.root)} prompt clusters "
        f"and found {len(competitors_list)} competitors"
    )

    # -----------------------------
    # Phase 2: Evaluate prompts (only if prompts exist)
    # -----------------------------
    logger.info("Phase 2: Evaluating citation prompts")

    citation_prompt_answers = None
    if clusters_result:
        citation_prompts_evaluator_task = asyncio.create_task(
            async_evaluate_citation_prompts(
                citation_prompts_evaluator_chain,
                clusters_result.root,
                brand,
                competitors_list
            )
        )

        citation_prompt_answers = await citation_prompts_evaluator_task

        if isinstance(citation_prompt_answers, Exception):
            logger.error(f"Error evaluating citation prompts: {citation_prompt_answers}")
            raise citation_prompt_answers

    # -----------------------------
    # Phase 3: Market metrics (only if citation answers exist)
    # -----------------------------
    market_comparison = []
    
    if citation_prompt_answers:
        logger.info("Phase 3: Calculating market comparison metrics")

        all_brands = [brand] + list(competitors_list)

        brand_citations = {}
        total_citations = 0

        # -----------------------------
        # Citation counting
        # -----------------------------
        for cluster in citation_prompt_answers.clusters:
            for prompt_answer in cluster.prompts:

                # Main brand
                if prompt_answer.is_brand_mentioned:
                    brand_citations[brand] = brand_citations.get(brand, 0) + 1
                    total_citations += 1

                # Competitors
                for competitor_citation in prompt_answer.competitor_citations:
                    if competitor_citation.is_competitor_mentioned:
                        comp_name = competitor_citation.competitor_brand
                        brand_citations[comp_name] = brand_citations.get(comp_name, 0) + 1
                        total_citations += 1

        # -----------------------------
        # SOV Calculation
        # -----------------------------
        brand_sov = {}

        for comp in all_brands:
            citations = brand_citations.get(comp, 0)
            sov = (citations / total_citations * 100) if total_citations > 0 else 0
            brand_sov[comp] = round(sov, 1)

        # -----------------------------
        # Cluster Coverage (per brand)
        # -----------------------------
        total_clusters = len(citation_prompt_answers.clusters)

        cluster_coverage_map = {}

        for b in all_brands:
            covered_clusters = 0

            for cluster in citation_prompt_answers.clusters:
                if any(
                    (
                        (b == brand and p.is_brand_mentioned) or
                        (b != brand and any(
                            c.competitor_brand == b and c.is_competitor_mentioned
                            for c in p.competitor_citations
                        ))
                    )
                    for p in cluster.prompts
                ):
                    covered_clusters += 1

            coverage = (
                (covered_clusters / total_clusters * 100)
                if total_clusters > 0 else 0
            )

            cluster_coverage_map[b] = round(coverage, 1)


        # -----------------------------
        # Final Market Comparison (ALL BRANDS)
        # -----------------------------
        for b in all_brands:
            market_comparison.append(
                MarketComparison(
                    brand=b,
                    brand_sov=brand_sov.get(b, 0),
                    brand_citations=brand_citations.get(b, 0),
                    cluster_coverage=cluster_coverage_map.get(b, 0)
                )
            )

            logger.info(
                f"{b} → SOV: {brand_sov.get(b, 0)}%, "
                f"Citations: {brand_citations.get(b, 0)}, "
                f"Coverage: {cluster_coverage_map.get(b, 0)}%"
            )
    else:
        # No citation answers - create basic market comparison
        logger.info("Phase 3: No citation answers available - creating basic market comparison")
        all_brands = [brand] + list(competitors_list)
        
        for b in all_brands:
            market_comparison.append(
                MarketComparison(
                    brand=b,
                    brand_sov=0.0,
                    brand_citations=0,
                    cluster_coverage=0.0
                )
            )


    # -----------------------------
    # Return
    # -----------------------------
    return LlmSignals(
        competitors=list(competitors_list),
        brand_analysis=brand_analysis,
        citation_prompt_answers=citation_prompt_answers,
        market_comparison=market_comparison
    )


# -----------------------------
# Run
# -----------------------------

if __name__ == "__main__":
    result = asyncio.run(find_llm_signals("Express", "US"))
    print(result.model_dump_json(indent=2))