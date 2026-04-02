from typing import List, Dict, Optional, Tuple
from pydantic import BaseModel, RootModel

from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import PydanticOutputParser

from src.config import LLM_PROVIDERS
from src.signals.llm_signals.llm_client import get_llm_client

from src.signals.llm_signals.entity_analysis_chain import (
    EntityAnalysis,
    safe_invoke as analysis_safe_invoke
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
# Prompt Template (UPDATED → DYNAMIC CLUSTERS)
# -----------------------------

prompt_gen_template = PromptTemplate(
    input_variables=["profile", "geo"],
    partial_variables={
        "format_instructions": parser.get_format_instructions()
    },
    template="""
You are a Senior Generative Engine Optimization (GEO) Strategist.

You are given a VERIFIED entity profile.

════════════════════════════════════════════════════════════════
ENTITY PROFILE (GROUND TRUTH)
════════════════════════════════════════════════════════════════
{profile}

⚠️ STRICT:
- DO NOT reinterpret or change domain
- USE ONLY this data
- ALL outputs must be grounded in this profile

════════════════════════════════════════════════════════════════
OBJECTIVE
════════════════════════════════════════════════════════════════
Generate realistic user prompts that real people would type into ChatGPT, Claude, or Google.

These prompts will be used to measure:
- which brands get mentioned (citation count)
- how often they appear vs competitors (share of voice)

👉 Therefore prompts MUST trigger selective, competitive responses — not generic lists.

════════════════════════════════════════════════════════════════
🚫 STRICT PROHIBITIONS (CRITICAL)
════════════════════════════════════════════════════════════════
- DO NOT mention the entity name
- DO NOT hint at the entity
- DO NOT ask for "alternatives to X"
- DO NOT bias the prompt toward any specific brand
- DO NOT generate prompts for which the unrelated entity types can appear as answer

All prompts must be completely neutral and unbiased.

════════════════════════════════════════════════════════════════
STEP 0 — EXTRACT ENTITY SIGNALS (MANDATORY)
════════════════════════════════════════════════════════════════
From the profile, identify:
- product types
- materials or quality signals
- pricing level
- target audience
- use-cases
- style / positioning

These MUST drive all clusters and prompts.

════════════════════════════════════════════════════════════════
STEP 0.5 — RETRIEVAL ALIGNMENT (CRITICAL)
════════════════════════════════════════════════════════════════
Each prompt MUST be constructed such that it naturally leads an AI system to retrieve entities similar to the given profile.

The prompt should:
- activate the same category and subcategory
- reflect the same use-cases and decision factors
- align with the same target audience and intent

The goal is to ensure that when an AI answers this prompt, it is most likely to surface:
- the given entity
- its competitors
- or highly similar entities

If a prompt is too broad or generic such that it could trigger unrelated entities, it MUST be rewritten to be more specific and context-driven.

════════════════════════════════════════════════════════════════
STEP 1 — GENERATE CLUSTERS
════════════════════════════════════════════════════════════════
Generate **6 to 7 clusters** based on how users evaluate brands in this category.

Each cluster MUST:
- represent a decision-making factor
- reflect real user intent
- be clearly distinct

❌ Avoid:
- generic labels (e.g., "Products", "Brands")
- overlapping ideas

✅ Prefer:
- "Breathability & Fabric"
- "Everyday Versatility"
- "Price vs Quality"
- "Fit Consistency"
- "Office-to-Casual Wear"

Cluster names:
- max 2–4 words
- specific and meaningful

════════════════════════════════════════════════════════════════
STEP 2 — GENERATE HUMAN-LIKE PROMPTS (CRITICAL)
════════════════════════════════════════════════════════════════
For EACH cluster:
- Generate EXACTLY **3 prompts**

Each prompt MUST:
- be 1–2 sentences
- sound like a real person asking from a real situation
- include a clear personal context, intent, or problem

💡 Think:
- Why is the user asking this?
- What triggered this search?
- What are they trying to avoid or achieve?

════════════════════════════════════════════════════════════════
🔥 CONTEXTUAL PROMPTING (MANDATORY)
════════════════════════════════════════════════════════════════
Each prompt MUST include:
1. A REALISTIC USER CONTEXT
   - life situation, use-case, frustration, or goal

2. A SPECIFIC NEED OR CONSTRAINT
   - derived from entity profile signals

3. A NATURAL QUESTION FORM

❌ Avoid:
- robotic or generic phrasing
- pure keyword-style queries

════════════════════════════════════════════════════════════════
✅ EXAMPLES (STYLE REFERENCE)
════════════════════════════════════════════════════════════════

❌ Weak:
Which are good engineering colleges in India with placements?

✅ Strong:
I'm trying to find a good engineering college in India where placements are actually reliable and not just marketing claims—any suggestions?

---

❌ Weak:
What are some good menswear brands?

✅ Strong:
I’ve bought a few shirts that looked good online but didn’t last more than a couple of washes—what are some menswear brands in India that actually hold up over time?

---

❌ Weak:
Affordable fashion brands in India

✅ Strong:
I’m trying to upgrade my wardrobe without spending too much, but I don’t want clothes that feel cheap after a few wears—any good menswear brands in India?

════════════════════════════════════════════════════════════════
🔥 ENTITY SIGNAL INJECTION (CRITICAL)
════════════════════════════════════════════════════════════════
Each prompt MUST subtly incorporate attributes from the entity profile:
- materials / quality signals
- pricing expectations
- use-cases
- audience
- positioning

👉 These should appear naturally inside the user's situation, NOT as keywords.

════════════════════════════════════════════════════════════════
🔥 DIFFERENTIATION PRESSURE
════════════════════════════════════════════════════════════════
Each prompt must:
- include a constraint that narrows results
- force the model to choose selectively

Examples:
- durability vs price
- comfort vs style
- affordability vs quality
- versatility vs specialization

════════════════════════════════════════════════════════════════
🔥 DIVERSITY RULES
════════════════════════════════════════════════════════════════
- Each prompt must represent a DIFFERENT situation
- Do NOT reuse the same scenario
- Vary tone, intent, and motivation
- Avoid repeating the same constraint phrasing

════════════════════════════════════════════════════════════════
🌍 GEO USAGE
════════════════════════════════════════════════════════════════
- Include "{geo}" naturally in ~70% of prompts

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
    retries: int = 4
) -> Tuple[Optional[EntityAnalysis], Optional[CitationPromptClusters]]:
    
    # 🔥 STEP 1: GET Entity Analysis
    analysis: EntityAnalysis = await analysis_safe_invoke(
        brand, geo
    )

    if analysis is None:
        return None, None

    # 🔥 STEP 2: GENERATE PROMPTS
    for attempt in range(retries):
        try:
            payload = {
                "profile": analysis.profile.model_dump_json(indent=2),
                "geo": geo
            }

            result = await citation_prompts_chain.ainvoke(payload)
            return analysis, result

        except Exception as e:
            if attempt == retries - 1:
                return None, None


# -----------------------------
# Run
# -----------------------------

if __name__ == "__main__":
    analysis, result = asyncio.run(safe_invoke("PSG College of Technology", "India"))

    print("=== Entity Analysis ===")
    print(analysis.model_dump_json(indent=2))

    print("\n=== Citation Prompts ===")
    print(result.model_dump_json(indent=2))