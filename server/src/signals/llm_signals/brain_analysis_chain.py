from typing import List, Optional
from pydantic import BaseModel, Field

from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import PydanticOutputParser

from src.config import LLM_PROVIDERS
from src.signals.llm_signals.llm_client import get_llm_client
import asyncio


# -----------------------------
# Field Models
# -----------------------------

class ConfidenceScore(BaseModel):
    value: float = Field(..., ge=0.0, le=1.0)
    reasoning: str


class ProfileField(BaseModel):
    value: str
    confidence: ConfidenceScore


class ListProfileField(BaseModel):
    values: List[str]
    confidence: ConfidenceScore


# -----------------------------
# Brand Profile (ONLY if known)
# -----------------------------

class BrandProfile(BaseModel):
    entity_type: ProfileField
    category: ProfileField
    subcategory: ProfileField
    business_model: ProfileField
    price_tier: ProfileField
    target_audience: ProfileField
    core_offerings: ListProfileField
    key_use_cases: ListProfileField
    capability_surfaces: ListProfileField


# -----------------------------
# Top-Level Analysis
# -----------------------------

class BrandAnalysis(BaseModel):
    brand: str

    # 🔥 Brand recognition confidence
    brand_confidence: float = Field(..., ge=0.0, le=1.0)

    # Why the model thinks it knows / doesn't know the brand
    brand_confidence_reasoning: str

    # 🔥 Only present if brand is recognized
    profile: Optional[BrandProfile]


# -----------------------------
# Parser
# -----------------------------

analysis_parser = PydanticOutputParser(pydantic_object=BrandAnalysis)


# -----------------------------
# Prompt Template (REDESIGNED)
# -----------------------------

brand_analysis_template = PromptTemplate(
    input_variables=["brand", "geo"],
    partial_variables={
        "format_instructions": analysis_parser.get_format_instructions()
    },
    template="""
You are a Brand Intelligence Analyst.

Your task is to analyze a brand using your internal knowledge.

════════════════════════════════════════════════════════════════
INPUT
════════════════════════════════════════════════════════════════

Brand: {brand}
Geo: {geo}

════════════════════════════════════════════════════════════════
STEP 1 — BRAND RECOGNITION (MANDATORY)
════════════════════════════════════════════════════════════════

Determine if you recognize this brand.

Return:

- brand_confidence (0–1)
- brand_confidence_reasoning

Rules:

- 0.8–1.0 → clearly known brand
- 0.5–0.8 → somewhat known
- <0.5 → unknown / unclear

DO NOT guess.

════════════════════════════════════════════════════════════════
STEP 2 — PROFILE GENERATION (ONLY IF CONFIDENT)
════════════════════════════════════════════════════════════════

IF brand_confidence ≥ 0.5:

- Generate a structured BrandProfile
- Use only reasonably confident knowledge
- Partial data is acceptable
- Do NOT over-expand or invent details

IF brand_confidence < 0.5:

- profile = null
- DO NOT generate any fields

════════════════════════════════════════════════════════════════
PROFILE RULES
════════════════════════════════════════════════════════════════

- Only include details you are confident about
- Fewer correct items > many incorrect ones
- Do NOT fabricate niche details

Fields:

entity_type, category, subcategory, business_model,
price_tier, target_audience

core_offerings, key_use_cases, capability_surfaces

════════════════════════════════════════════════════════════════
FIELD CONFIDENCE RULES
════════════════════════════════════════════════════════════════

0.9–1.0 → well-known fact  
0.7–0.9 → strong knowledge  
0.5–0.7 → reasonable inference  
0.3–0.5 → weak  

Each field MUST include reasoning.

════════════════════════════════════════════════════════════════
OUTPUT FORMAT
════════════════════════════════════════════════════════════════

{format_instructions}

Return ONLY JSON.
"""
)


# -----------------------------
# LLM Client
# -----------------------------

llm_client = get_llm_client(list(LLM_PROVIDERS.keys())[0])


# -----------------------------
# Chain
# -----------------------------

brand_analysis_chain = brand_analysis_template | llm_client | analysis_parser


# -----------------------------
# Safe Invoke
# -----------------------------

async def safe_invoke(chain, payload, retries=2):
    for attempt in range(retries):
        try:
            return await chain.ainvoke(payload)
        except Exception as e:
            if attempt == retries - 1:
                raise e
            print(f"Retry {attempt+1} due to error: {e}")


# -----------------------------
# Run
# -----------------------------

if __name__ == "__main__":
    brand = "Express"
    geo = "US"

    result = asyncio.run(
        safe_invoke(
            brand_analysis_chain,
            {"brand": brand, "geo": geo}
        )
    )

    print(result.model_dump_json(indent=2))