from typing import List
from pydantic import BaseModel

from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import PydanticOutputParser

from src.config import LLM_PROVIDERS
from src.signals.llm_signals.llm_client import get_llm_client
import asyncio


# -----------------------------
# Pydantic Model
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
    input_variables=["brand", "geo"],
    partial_variables={
        "format_instructions": parser.get_format_instructions()
    },
    template="""
You are a Senior Competitive Intelligence Analyst.

Your task is to identify TRUE DIRECT ONLINE COMPETITORS for "{brand}" in "{geo}".

A DIRECT COMPETITOR is:
→ A substitute a customer would realistically consider at the moment of decision
→ For the SAME use case, SAME price tier, SAME type of offering
→ AND competing in the ONLINE/DIGITAL space

════════════════════════════════════════════════════════════════
PHASE 1 — UNDERSTAND THE SUBJECT
════════════════════════════════════════════════════════════════

Step 1A — Determine ENTITY TYPE:

Classify "{brand}" as ONE of:

→ [Standalone Brand]
→ [Marketplace / Platform]
→ [Multi-brand Retailer]

---

Step 1B — Define:

- Category (specific)
- Price Tier (Budget / Value / Mid / Upper-Mid / Premium / Luxury)
- Primary Use Case (ONE dominant job)
- Target Customer

════════════════════════════════════════════════════════════════
PHASE 2 — COMPETITOR LOGIC
════════════════════════════════════════════════════════════════

⚠️ DO NOT mix entity types

IF Standalone Brand:
→ Return competing BRANDS

IF Marketplace / Platform:
→ Return competing PLATFORMS

IF Multi-brand Retailer:
→ Return competing RETAILERS

════════════════════════════════════════════════════════════════
PHASE 2.5 — DIGITAL PRESENCE FILTER (MANDATORY)
════════════════════════════════════════════════════════════════

ONLY include competitors with strong ONLINE presence.

A valid competitor MUST:
- Have active website or app
- Enable users to browse, transact, or engage digitally
- Be relevant in "{geo}"

REMOVE:
- Offline-first brands with weak digital presence
- Businesses without meaningful online engagement

════════════════════════════════════════════════════════════════
PHASE 3 — CANDIDATE GENERATION
════════════════════════════════════════════════════════════════

Generate 8–10 candidates.

════════════════════════════════════════════════════════════════
PHASE 4 — HARD FILTER
════════════════════════════════════════════════════════════════

REMOVE if:

- Entity type mismatch
- Price mismatch (>1 tier difference)
- PRIMARY USE CASE MISMATCH
  - Must match EXACTLY (not partially or occasionally)
  - If the competitor serves the use case only secondarily → REMOVE
- Different target audience
- Category mismatch

════════════════════════════════════════════════════════════════
PHASE 5 — SUBSTITUTION TEST
════════════════════════════════════════════════════════════════

Ask:

"Would a user consider this instead of {brand} ONLINE for the same purpose?"

If NO → REMOVE

════════════════════════════════════════════════════════════════
PHASE 6 — FINAL OUTPUT
════════════════════════════════════════════════════════════════

- Return top 3–5 competitors
- Precision > Recall

DO NOT INCLUDE:
- Fast fashion (if mid/premium brand)
- Budget vs premium mismatch
- Platforms vs brands mismatch
- Popular but irrelevant entities
- Declining, niche, or weakly relevant brands with low current market presence

Prefer:
- Strong DTC brands
- Strong SEO / app / traffic presence
- Competitors with strong current market relevance and active user base
════════════════════════════════════════════════════════════════
FINAL OUTPUT
════════════════════════════════════════════════════════════════

Return ONLY competitor names.

No explanation.

Market: {geo}

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
# Safe Invoke
# -----------------------------

async def safe_invoke(chain, payload, retries=2):
    for attempt in range(retries):
        try:
            return await chain.ainvoke(payload)
        except Exception as e:
            if attempt == retries - 1:
                raise e


# -----------------------------
# Run
# -----------------------------

if __name__ == "__main__":
    test_cases = [
        {"brand": "Alo Yoga", "geo": "United States"},
        {"brand": "Nike", "geo": "United States"},
        {"brand": "Uniqlo", "geo": "United States"},
        {"brand": "Levi's", "geo": "United States"},
        {"brand": "Amazon", "geo": "United States"},
        {"brand": "Myntra", "geo": "India"},
        {"brand": "Ajio", "geo": "India"},
        {"brand": "Zomato", "geo": "India"},
        {"brand": "DoorDash", "geo": "United States"},
        {"brand": "Slack", "geo": "United States"},
        {"brand": "Stripe", "geo": "United States"},
        {"brand": "Razorpay", "geo": "India"},
    ]

    for case in test_cases:
        brand, geo = case["brand"], case["geo"]

        result = asyncio.run(safe_invoke(competitors_chain, case))

        print(f"\n=== Competitors for {brand} - {geo} ===\n")

        if not result.competitors:
            print("No direct competitors found.")
        else:
            for competitor in result.competitors:
                print(f"- {competitor}")