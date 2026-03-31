from typing import List, Dict, Optional, Tuple
from pydantic import BaseModel, RootModel

from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import PydanticOutputParser

from src.config import LLM_PROVIDERS, CITATION_PROMPT_CLUSTERS
from src.signals.llm_signals.llm_client import get_llm_client

# 🔥 IMPORT PREVIOUS CHAIN
from src.signals.llm_signals.brain_analysis_chain import (
    brand_analysis_chain,
    safe_invoke as analysis_safe_invoke,
    BrandAnalysis
)

import asyncio


# -----------------------------
# Pydantic Models
# -----------------------------

class CitationPromptCluster(BaseModel):
    cluster: str
    prompts: List[str]


class CitationPromptClusters(RootModel[List[CitationPromptCluster]]):
    pass


# -----------------------------
# Parser
# -----------------------------

parser = PydanticOutputParser(pydantic_object=CitationPromptClusters)


# -----------------------------
# Helper
# -----------------------------

def format_distribution(dist: Dict[str, int]) -> str:
    return "\n".join([f"- {k}: {v} prompts" for k, v in dist.items()])


# -----------------------------
# Prompt Template (UPDATED → USE PROFILE)
# -----------------------------

prompt_gen_template = PromptTemplate(
    input_variables=["profile", "geo", "cluster_distribution"],
    partial_variables={
        "format_instructions": parser.get_format_instructions()
    },
    template="""
You are a Senior Generative Engine Optimization (GEO) Strategist.

You are given a VERIFIED brand profile.

════════════════════════════════════════════════════════════════
BRAND PROFILE (GROUND TRUTH)
════════════════════════════════════════════════════════════════
{profile}

⚠️ STRICT:
- DO NOT reinterpret or change domain
- USE ONLY this data

════════════════════════════════════════════════════════════════
OBJECTIVE
════════════════════════════════════════════════════════════════
Generate realistic user prompts that real people would actually type into ChatGPT, Claude, or Google. 
These prompts must force AI systems to return MULTIPLE BRAND NAMES (3-5) so we can measure visibility and citations.

════════════════════════════════════════════════════════════════
PROMPT REQUIREMENTS
════════════════════════════════════════════════════════════════
Each prompt MUST:
- explicitly ask for exactly **3-5 brands** (never "some" or "a few")
- use natural human starters like:
  - "Which 3-5 brands..."
  - "What are the top 3-5 brands..."
  - "Can you recommend 3-5 brands..."
  - "List 3-5 brands that..."
  - "I'm looking for 3-5 brands..."
  - "Help me find 3-5 brands..."

- stay strictly within the domain of the profile
- refer only to brands (not platforms, stores, or websites)

Each prompt SHOULD:
- sound like a real person casually asking (conversational tone, contractions, personal motivation)
- be 1–2 natural sentences max (not forced "line 1 + line 2")
- weave in realistic user intent (style, performance, price, durability, comfort, trends, etc.) as a personal reason, NOT as a meta explanation
- feel like a human shopping or researching thought ("for my hot yoga classes", "that actually last", "without spending a fortune", "that look cute too")

🌍 GEO USAGE:
- Include "{geo}" naturally in ~70% of prompts (e.g. "in the US", "available in the US", "popular in the US")

════════════════════════════════════════════════════════════════
GOOD HUMAN EXAMPLES (copy this natural style)
════════════════════════════════════════════════════════════════
✅ Good:
Which 3-5 brands make premium yoga apparel in the US? I need stuff that actually holds up in hot yoga classes.

✅ Good:
Can you recommend 3-5 stylish yoga clothing brands in the US? I'm tired of leggings that pill after two washes.

✅ Good:
What are the top 3-5 yoga brands available in the US right now? Looking for ones that are comfy for long flows but still look good.

❌ Bad (avoid these patterns):
Which 3-5 brands offer premium yoga apparel in the US? This will help identify top players in the market.
List 3-5 brands known for their yoga clothing in the US. I'm looking for popular options.

════════════════════════════════════════════════════════════════
CLUSTER DISTRIBUTION
════════════════════════════════════════════════════════════════
{cluster_distribution}

Rules:
- Generate exactly the number of prompts shown for each cluster
- Do not skip or rename any cluster

════════════════════════════════════════════════════════════════
OUTPUT FORMAT
════════════════════════════════════════════════════════════════
{format_instructions}
"""
)


# -----------------------------
# LLM Client
# -----------------------------

llm = get_llm_client(list(LLM_PROVIDERS.keys())[0])


# -----------------------------
# Chain
# -----------------------------

citation_prompts_chain = prompt_gen_template | llm | parser


# -----------------------------
# Safe Invoke (FULL ORCHESTRATION)
# -----------------------------

async def safe_invoke(
    brand: str,
    geo: str,
    retries: int = 2
) -> Tuple[BrandAnalysis, Optional[CitationPromptClusters]]:
    
    # 🔥 STEP 1: GET BRAND ANALYSIS
    analysis: BrandAnalysis = await analysis_safe_invoke(
        brand_analysis_chain,
        {"brand": brand, "geo": geo}
    )

    # 🔥 STEP 2: CONFIDENCE GATE
    if analysis.brand_confidence < 0.5 or analysis.profile is None:
        return analysis, None

    # 🔥 STEP 3: GENERATE PROMPTS
    for attempt in range(retries):
        try:
            payload = {
                "profile": analysis.profile.model_dump_json(indent=2),
                "geo": geo,
                "cluster_distribution": format_distribution(CITATION_PROMPT_CLUSTERS)
            }

            result = await citation_prompts_chain.ainvoke(payload)
            return analysis, result

        except Exception as e:
            if attempt == retries - 1:
                raise e


# -----------------------------
# Run
# -----------------------------

if __name__ == "__main__":
    brand = "Alo Yoga"
    geo = "US"

    analysis, prompts = asyncio.run(
        safe_invoke(brand, geo)
    )

    print("\n=== BRAND ANALYSIS ===")
    print(analysis.model_dump_json(indent=2))

    if prompts:
        print("\n=== PROMPTS ===")
        for cluster in prompts.root:
            print(f"\n=== {cluster.cluster} ===")
            for prompt in cluster.prompts:
                print(f"- {prompt}")
    else:
        print("\nNo prompts generated due to low confidence.")