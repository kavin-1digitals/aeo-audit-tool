from .citation_prompts_chain import safe_invoke as async_generate_citation_prompts
from .citation_prompts_evaluator_chain import safe_invoke as async_evaluate_citation_prompts
from .entity_analysis_chain import EntityAnalysis
from .citation_prompts_evaluator_chain import PromptAnswerClusters
from pydantic import BaseModel
from typing import Optional, List
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s"
)

logger = logging.getLogger(__name__)


# -----------------------------
# Models
# -----------------------------

class MarketComparison(BaseModel):
    entity: str
    sov: float
    citations: int
    cluster_coverage: float


class LlmSignal(BaseModel):
    entity_analysis: EntityAnalysis
    competitors: List[str]
    citation_prompt_answers: PromptAnswerClusters

    market_comparison_web: List[MarketComparison]
    market_comparison_llm: List[MarketComparison]
    market_comparison_combined: List[MarketComparison]


class LlmSignals(BaseModel):
    signals: Optional[LlmSignal] = None
    status: bool = False
    issue_found: Optional[str] = None
    cause_of_issue: Optional[str] = None


# -----------------------------
# Helpers
# -----------------------------

def normalize_prompt_clusters(data):
    if isinstance(data, PromptAnswerClusters):
        return data

    if isinstance(data, tuple) and len(data) == 2 and data[0] == "root":
        return PromptAnswerClusters(root=data[1])

    if isinstance(data, dict):
        return PromptAnswerClusters.model_validate(data)

    if isinstance(data, list):
        return PromptAnswerClusters(root=data)

    raise ValueError(f"Invalid citation_prompt_answers format: {type(data)}")


def has_valid_competitors(entity_analysis):
    return (
        entity_analysis
        and entity_analysis.profile
        and entity_analysis.profile.top_competitors
        and entity_analysis.profile.top_competitors.values
    )


def has_valid_prompts(citation_prompts_result):
    return (
        citation_prompts_result
        and citation_prompts_result.root
        and len(citation_prompts_result.root) > 0
        and citation_prompts_result.root[0].prompts
    )


# -----------------------------
# Main Function
# -----------------------------

async def find_llm_signals(entity: str, geo: str) -> LlmSignals:

    logger.info(f"Starting LLM signals analysis for entity: {entity}")

    entity_analysis, citation_prompts_result = await async_generate_citation_prompts(
        entity, geo
    )

    if not has_valid_competitors(entity_analysis) or not has_valid_prompts(citation_prompts_result):
        return LlmSignals(
            status=False,
            issue_found="LLM Signal is not available",
            cause_of_issue="Internal Error: Try again later"
        )

    competitors = entity_analysis.profile.top_competitors.values

    citation_prompt_answers_raw = await async_evaluate_citation_prompts(
        citation_prompts_result.root,
        entity,
        competitors
    )

    if citation_prompt_answers_raw is None:
        return LlmSignals(
            status=False,
            issue_found="LLM Signal is not available",
            cause_of_issue="Internal Error: Try again later"
        )

    citation_prompt_answers = normalize_prompt_clusters(citation_prompt_answers_raw)

    logger.info("Evaluation complete")

    # -----------------------------
    # Phase 3: Market Analysis (FIXED + OPTIMIZED)
    # -----------------------------

    # Deduplicate entities safely
    all_entities = list(dict.fromkeys([entity] + list(competitors)))

    web_citations = {}
    llm_citations = {}
    combined_citations = {}

    total_web = 0
    total_llm = 0
    total_combined = 0

    for cluster in citation_prompt_answers.root:
        for prompt in cluster.prompts:

            # -----------------------------
            # ENTITY FLAGS
            # -----------------------------
            entity_web_flag = prompt.web_entity_mentioned
            entity_llm_flag = prompt.llm_entity_mentioned
            entity_combined_flag = entity_web_flag or entity_llm_flag

            if entity_web_flag:
                web_citations[entity] = web_citations.get(entity, 0) + 1
                total_web += 1

            if entity_llm_flag:
                llm_citations[entity] = llm_citations.get(entity, 0) + 1
                total_llm += 1

            if entity_combined_flag:
                combined_citations[entity] = combined_citations.get(entity, 0) + 1
                total_combined += 1

            # -----------------------------
            # PRECOMPUTE COMPETITOR SETS (PERFORMANCE FIX)
            # -----------------------------
            web_comp_set = {
                c.competitor_entity
                for c in prompt.competitor_citations_web
                if c.is_competitor_mentioned
            }

            llm_comp_set = {
                c.competitor_entity
                for c in prompt.competitor_citations_llm
                if c.is_competitor_mentioned
            }

            # -----------------------------
            # COMPETITORS
            # -----------------------------
            for comp in competitors:

                comp_web_flag = comp in web_comp_set
                comp_llm_flag = comp in llm_comp_set
                comp_combined_flag = comp_web_flag or comp_llm_flag

                if comp_web_flag:
                    web_citations[comp] = web_citations.get(comp, 0) + 1
                    total_web += 1

                if comp_llm_flag:
                    llm_citations[comp] = llm_citations.get(comp, 0) + 1
                    total_llm += 1

                if comp_combined_flag:
                    combined_citations[comp] = combined_citations.get(comp, 0) + 1
                    total_combined += 1

    # -----------------------------
    # Safety logs
    # -----------------------------
    if total_combined == 0:
        logger.warning("No combined mentions found — SOV may be meaningless")

    # -----------------------------
    # Coverage Helper (optimized)
    # -----------------------------
    def compute_coverage(entity_name, mode, main_entity):
        covered = 0
        total_clusters = len(citation_prompt_answers.root)

        for cluster in citation_prompt_answers.root:
            for p in cluster.prompts:

                if entity_name == main_entity:
                    if (
                        (mode == "web" and p.web_entity_mentioned)
                        or (mode == "llm" and p.llm_entity_mentioned)
                        or (mode == "combined" and (p.web_entity_mentioned or p.llm_entity_mentioned))
                    ):
                        covered += 1
                        break

                else:
                    combined_set = {
                        c.competitor_entity
                        for c in (
                            p.competitor_citations_web if mode == "web"
                            else p.competitor_citations_llm if mode == "llm"
                            else (p.competitor_citations_web + p.competitor_citations_llm)
                        )
                        if c.is_competitor_mentioned
                    }

                    if entity_name in combined_set:
                        covered += 1
                        break

        return (covered / total_clusters * 100) if total_clusters > 0 else 0

    # -----------------------------
    # Build Market Comparisons
    # -----------------------------
    market_comparison_web = []
    market_comparison_llm = []
    market_comparison_combined = []

    for e in all_entities:

        web_count = web_citations.get(e, 0)
        llm_count = llm_citations.get(e, 0)
        combined_count = combined_citations.get(e, 0)

        web_sov = (web_count / total_web * 100) if total_web > 0 else 0
        llm_sov = (llm_count / total_llm * 100) if total_llm > 0 else 0
        combined_sov = (combined_count / total_combined * 100) if total_combined > 0 else 0

        market_comparison_web.append(
            MarketComparison(
                entity=e,
                sov=round(web_sov, 1),
                citations=web_count,
                cluster_coverage=round(compute_coverage(e, "web", entity), 1)
            )
        )

        market_comparison_llm.append(
            MarketComparison(
                entity=e,
                sov=round(llm_sov, 1),
                citations=llm_count,
                cluster_coverage=round(compute_coverage(e, "llm", entity), 1)
            )
        )

        market_comparison_combined.append(
            MarketComparison(
                entity=e,
                sov=round(combined_sov, 1),
                citations=combined_count,
                cluster_coverage=round(compute_coverage(e, "combined", entity), 1)
            )
        )

    return LlmSignals(
        signals=LlmSignal(
            entity_analysis=entity_analysis,
            competitors=list(competitors),
            citation_prompt_answers=citation_prompt_answers,
            market_comparison_web=market_comparison_web,
            market_comparison_llm=market_comparison_llm,
            market_comparison_combined=market_comparison_combined
        ),
        status=True
    )


if __name__ == "__main__":
    import asyncio
    import json

    result = asyncio.run(find_llm_signals("Banana Club", "India"))

    with open("test_example.json", "w", encoding="utf-8") as f:
        json.dump(result.model_dump(), f, indent=2, ensure_ascii=False)