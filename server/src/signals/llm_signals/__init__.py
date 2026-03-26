import logging
import asyncio
from typing import Dict, Any, List
from pydantic import BaseModel

from .citation_prompts_chain import citation_prompts_chain, safe_invoke as async_generate_citation_prompts
from .competitors_chain import competitors_chain, safe_invoke as async_find_competitors
from .citation_prompts_evaluator_chain import (
    citation_prompts_evaluator_chain,
    safe_invoke as async_evaluate_citation_prompts,
    PromptAnswerClusters
)
from .evaluator import evaluate
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
    citation_prompt_answers: PromptAnswerClusters
    market_comparison: List[MarketComparison]


# -----------------------------
# Main Function
# -----------------------------

async def find_llm_signals(brand: str, geo: str) -> LlmSignals:
    """Find all LLM signals for a brand"""
    logger.info(f"Starting LLM signals analysis for brand: {brand}")

    # -----------------------------
    # Phase 1: Parallel execution
    # -----------------------------
    logger.info("Phase 1: Generating citation prompts and finding competitors")

    prompts_task = asyncio.create_task(
        async_generate_citation_prompts(citation_prompts_chain, {
            "brand": brand,
            "geo": geo,
        })
    )

    competitors_task = asyncio.create_task(
        async_find_competitors(competitors_chain, {
            "brand": brand,
            "geo": geo,
        })
    )

    clusters_result, competitors_result = await asyncio.gather(
        prompts_task,
        competitors_task,
        return_exceptions=True
    )

    # -----------------------------
    # Error handling
    # -----------------------------
    if isinstance(clusters_result, Exception):
        logger.error(f"Error generating citation prompts: {clusters_result}")
        raise clusters_result

    if isinstance(competitors_result, Exception):
        logger.error(f"Error finding competitors: {competitors_result}")
        raise competitors_result

    competitors_list = competitors_result.competitors

    logger.info(
        f"Generated {len(clusters_result.root)} prompt clusters "
        f"and found {len(competitors_list)} competitors"
    )

    # -----------------------------
    # Phase 2: Evaluate prompts
    # -----------------------------
    logger.info("Phase 2: Evaluating citation prompts")

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
    # Phase 3: Market metrics
    # -----------------------------
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
    market_comparison = []

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


    # -----------------------------
    # Return
    # -----------------------------
    return LlmSignals(
        competitors=list(competitors_list),
        citation_prompt_answers=citation_prompt_answers,
        market_comparison=market_comparison
    )


# -----------------------------
# Run
# -----------------------------

if __name__ == "__main__":
    result = asyncio.run(find_llm_signals("Express", "US"))
    print(result.model_dump_json(indent=2))