from typing import List
from pydantic import BaseModel, RootModel

from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import PydanticOutputParser

from src.config import LLM_PROVIDERS
from src.signals.llm_signals.llm_client import get_llm_client


# -----------------------------
# Pydantic Models (FIXED for v2)
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
# Prompt Template
# -----------------------------

prompt_gen_template = PromptTemplate(
    input_variables=["brand", "industry", "geo", "num_prompts"],
    partial_variables={
        "format_instructions": parser.get_format_instructions()
    },
    template="""
You are an expert in Generative Engine Optimization (GEO).

Your task is to generate grouped user prompts that are GUARANTEED to trigger AI models to list, compare, or recommend brands.

Context:
- Brand: {brand}
- Industry: {industry}
- Geography: {geo}

Goal:
- Generate prompts ONLY where AI responses are highly likely to include brand names
- Group prompts into meaningful "Intent Clusters" for analysis

STRICT INSTRUCTIONS:
- EVERY prompt MUST strongly encourage brand mentions
- DO NOT include the given brand or any specific brand names in the prompts
- DO NOT generate generic or educational questions
- DO NOT generate "how to", "tips", or "factors to consider" type questions
- Each prompt must clearly imply:
  - listing brands OR
  - comparing brands OR
  - recommending brands

INDUSTRY REQUIREMENT:
- Prompts MUST explicitly reference the industry using natural phrasing
  (e.g., "sportswear brands", "athletic clothing brands")
- Do NOT use generic terms like "products" or "items"

GEOGRAPHY HANDLING:
- Include "{geo}" explicitly in 30–50% of prompts
- Keep remaining prompts geography-neutral
- When used, geography must feel natural (e.g., "in {geo}", "available in {geo}")

CLUSTERS TO INCLUDE:
1. Brand Discovery (best/top brands)
2. Brand Recommendation (which brands should I buy/choose)
3. Brand Comparison (which brands are better / alternatives)
4. Pricing & Value (affordable brands / value for money)
5. Quality & Durability (brands known for quality)
6. Style & Trends (brands leading in style/trends)
7. Fit & Sizing (brands known for fit/sizing)

REQUIREMENTS:
- Distribute {num_prompts} prompts across clusters
- Each cluster must have at least 2 prompts
- EVERY prompt must contain at least one of:
  - "brands"
  - "which brands"
  - "best"
  - "top"
  - "alternatives"
- Ensure variation in phrasing and structure
- Avoid vague prompts like "good brands"

GOOD EXAMPLES:
- "What are the best sportswear brands right now?"
- "Which sportswear brands offer the best value for money?"
- "What are good alternatives to expensive sportswear brands?"
- "Which sportswear brands are popular in {geo}?"

BAD EXAMPLES (DO NOT GENERATE):
- "What should I look for when buying sportswear?"
- "How to choose good athletic clothing?"
- "What factors matter when buying sportswear?"

Output format:
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
# Optional: Safe Invoke (retry)
# -----------------------------

def safe_invoke(chain, payload, retries=2):
    for attempt in range(retries):
        try:
            return chain.invoke(payload)
        except Exception as e:
            if attempt == retries - 1:
                raise e


# -----------------------------
# Run
# -----------------------------

if __name__ == "__main__":
    result = safe_invoke(citation_prompts_chain, {
        "brand": "Nike",
        "industry": "Sportswear",
        "geo": "United States",
        "num_prompts": 20
    })

    # Pretty print
    for cluster in result.root:
        print(f"\n=== {cluster.cluster} ===")
        for prompt in cluster.prompts:
            print(f"- {prompt}")