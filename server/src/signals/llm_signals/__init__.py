

"""
LLM signals processing utilities for AEO audit tool
"""

import logging
import asyncio
from typing import Dict, Any
from pydantic import BaseModel

from .citation_prompts_chain import citation_prompts_chain
from .competitors_chain import competitors_chain
from .evaluator import evaluate
from src.config import LLM_PROVIDERS, NUM_PROMPTS, NUM_COMPETITORS

logger = logging.getLogger(__name__)

class LlmSignals(BaseModel):
    clusters: Any
    competitors: list[str]
    evaluation_results: Dict[str, Any]

async def find_llm_signals(full_domain: str, brand: str, industry: str, geo: str) -> LlmSignals:
    """Find all LLM signals for a brand"""
    logger.info(f"Starting LLM signals analysis for brand: {brand}")
    
    # Phase 1: Generate citation prompts and find competitors in parallel
    logger.info("Phase 1: Generating citation prompts and finding competitors")
    
    # Create tasks for parallel execution
    prompts_task = asyncio.create_task(
        citation_prompts_chain.ainvoke({
            "brand": brand,
            "industry": industry,
            "geo": geo,
            "num_prompts": NUM_PROMPTS
        })
    )
    
    competitors_task = asyncio.create_task(
        competitors_chain.ainvoke({
            "brand": brand,
            "industry": industry,
            "geo": geo,
            "num_competitors": NUM_COMPETITORS
        })
    )
    
    # Wait for both tasks to complete
    clusters, competitors_result = await asyncio.gather(
        prompts_task,
        competitors_task,
        return_exceptions=True
    )
    
    # Handle exceptions
    if isinstance(clusters, Exception):
        logger.error(f"Error generating citation prompts: {clusters}")
        raise clusters
    
    if isinstance(competitors_result, Exception):
        logger.error(f"Error finding competitors: {competitors_result}")
        raise competitors_result
    
    competitors_list = competitors_result.competitors
    logger.info(f"Generated {len(clusters.root)} prompt clusters and found {len(competitors_list)} competitors")
    
    # Phase 2: Evaluate brand visibility across prompts
    logger.info("Phase 2: Evaluating brand visibility across prompts")
    
    evaluation_results = evaluate(
        clusters=clusters,
        target_brand=brand,
        competitors=competitors_list,
        max_workers=5
    )
    
    logger.info(f"Evaluation completed. Total mentions: {evaluation_results['total_mentions']}")
    logger.info(f"Brand SOV: {evaluation_results['sov'].get(brand, 0)}%")
    
    logger.info("LLM signals analysis completed successfully")
    return LlmSignals(
        clusters=clusters,
        competitors=competitors_list,
        evaluation_results=evaluation_results
    )

if __name__ == "__main__":
    import asyncio
    
    async def test_llm_signals():
        result = await find_llm_signals(
            full_domain="https://www.express.com",
            brand="Express",
            industry="Fashion",
            geo="United States"
        )
        
        print("\n=== LLM SIGNALS RESULTS ===")
        print(f"Competitors: {result.competitors}")
        print(f"Brand Counts: {result.evaluation_results['brand_counts']}")
        print(f"SOV: {result.evaluation_results['sov']}")
        print(f"Total Mentions: {result.evaluation_results['total_mentions']}")
        
        print("\n=== CLUSTER ANALYSIS ===")
        for cluster, data in result.evaluation_results['cluster_summary'].items():
            gap_status = "🚨 GAP" if data['gap'] else "✅ COVERED"
            print(f"{cluster}: {gap_status}")
    
    asyncio.run(test_llm_signals())
    