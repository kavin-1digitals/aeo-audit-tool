from typing import List
from pydantic import BaseModel

from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import PydanticOutputParser

from src.config import LLM_PROVIDERS
from src.signals.llm_signals.llm_client import get_llm_client


# -----------------------------
# Pydantic Model (STABLE)
# -----------------------------

class CompetitorsList(BaseModel):
    competitors: List[str]


# -----------------------------
# Parser
# -----------------------------

parser = PydanticOutputParser(pydantic_object=CompetitorsList)


# -----------------------------
# Prompt Template
# -----------------------------

competitors_template = PromptTemplate(
    input_variables=["brand", "industry", "geo", "num_competitors"],
    partial_variables={
        "format_instructions": parser.get_format_instructions()
    },
    template="""
You are an expert market analyst.

Task:
List the top competitors for the given brand.

Context:
- Brand: {brand}
- Industry: {industry}
- Geography: {geo}

Instructions:
- Return exactly {num_competitors} competitor brand names
- DO NOT include the given brand ({brand})
- Only include real, well-known brands
- Focus on brands relevant in {geo}
- Include a mix of major and emerging competitors
- Avoid duplicates
- Return output ONLY in this JSON format:

{{
  "competitors": ["Brand1", "Brand2", "Brand3"]
}}

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

competitors_chain = competitors_template | llm | parser


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
    result = safe_invoke(competitors_chain, {
        "brand": "Nike",
        "industry": "Sportswear",
        "geo": "United States",
        "num_competitors": 8
    })

    print(f"\n=== Competitors for Nike in US Sportswear Market ===\n")

    for competitor in result.competitors:
        print(f"- {competitor}")