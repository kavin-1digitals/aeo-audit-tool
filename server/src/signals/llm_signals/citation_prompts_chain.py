from typing import List, Dict
from pydantic import BaseModel, RootModel

from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import PydanticOutputParser

from src.config import LLM_PROVIDERS, CITATION_PROMPT_CLUSTERS
from src.signals.llm_signals.llm_client import get_llm_client
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
# Helper: Format distribution
# -----------------------------

def format_distribution(dist: Dict[str, int]) -> str:
    return "\n".join([f"- {k}: {v} prompts" for k, v in dist.items()])


# -----------------------------
# Prompt Template (UPDATED)
# -----------------------------

prompt_gen_template = PromptTemplate(
    input_variables=["brand", "geo", "cluster_distribution"],
    partial_variables={
        "format_instructions": parser.get_format_instructions()
    },
template="""
You are a Senior Generative Engine Optimization (GEO) Strategist.

Your job is to generate REALISTIC, HUMAN-LIKE prompts that users would ask AI systems when exploring brands similar to "{brand}".

════════════════════════════════════════════════════════════════
PHASE 1 — UNDERSTAND THE BRAND
════════════════════════════════════════════════════════════════

Classify "{brand}":

- Entity Type
- Category (specific)
- Price Tier
- Target Audience

════════════════════════════════════════════════════════════════
PHASE 2 — CAPABILITY SURFACES (CRITICAL)
════════════════════════════════════════════════════════════════

Identify 3–5 MAJOR CAPABILITY SURFACES.

A capability surface = a key way users interact with or buy from the brand.

Examples:
- product types
- use cases
- contexts of usage

⚠️ RULES:
- Each surface must be DISTINCT
- Avoid overlapping surfaces
- Cover both broad + specific areas if applicable
- For broad brands → include diverse surfaces
- For niche brands → stay focused

════════════════════════════════════════════════════════════════
PHASE 3 — USER INTENT MODELING
════════════════════════════════════════════════════════════════

Think like a REAL user:

- Users explore options
- Compare alternatives
- Ask casually
- Often imply brands without naming them

════════════════════════════════════════════════════════════════
PHASE 4 — PROMPT GENERATION
════════════════════════════════════════════════════════════════

Generate prompts that:

✅ Trigger:
- brand listings
- comparisons
- recommendations
- explicit brand name requests

✅ Feel like:
- natural human questions
- real buying intent
- specific brand discovery queries

✅ Structure:
- 2-3 lines each (detailed context)
- explicitly ask for brand lists
- include specific scenarios
- mention {geo} for localization

Each prompt MUST:
- clearly ask for BRAND NAMES or BRAND LISTS
- relate to ONE capability surface
- feel specific (not generic)
- include context that would naturally lead to brand mentions

❌ DO NOT:
- sound like SEO
- be educational
- be vague
- ask generic questions without brand context

✅ EXPLICIT BRAND REQUESTS:
- "Can you list 3-5 top brands..."
- "Which 3-5 brands would you recommend..."
- "What are the 3-5 best brands for..."
- "Can you name 3-5 brands that..."
- "Which 3-5 fashion brands offer..."
- "List 3-5 top brands for..."
- "Recommend 3-5 brands that..."

════════════════════════════════════════════════════════════════
CLUSTER DISTRIBUTION (STRICT)
════════════════════════════════════════════════════════════════

Generate prompts EXACTLY as per this distribution:

{cluster_distribution}

RULES:

- Each cluster must appear EXACTLY ONCE
- Each cluster must contain EXACTLY the specified number of prompts
- DO NOT rename clusters
- DO NOT merge clusters
- DO NOT create new clusters
- DO NOT skip any cluster

════════════════════════════════════════════════════════════════
STRICT RULES
════════════════════════════════════════════════════════════════

- DO NOT mention "{brand}" or any brand names
- At least 70–90% prompts should include "{geo}"
- Use VARIED contexts across prompts
- Avoid repeating same wording

Each prompt MUST include at least one of:
- "list 3-5 brands"
- "which 3-5 brands"
- "3-5 best brands"
- "3-5 top brands"
- "3-5 brand names"
- "recommend 3-5 brands"
- "name 3-5 brands"

════════════════════════════════════════════════════════════════
GOOD EXAMPLES (STYLE ONLY)
════════════════════════════════════════════════════════════════

✅ Brand Discovery (2-3 lines, explicit brand request):
"Can you list 3-5 top running shoe brands that are popular in {geo} right now? 
I'm looking for brands that offer both performance and style for daily workouts.
Which 3-5 brands would you recommend for someone serious about fitness?"

✅ Brand Recommendations (detailed context, brand list):
"What are the 3-5 best workout clothing brands for intense training sessions in {geo}?
I need brands that specialize in moisture-wicking fabrics and durable construction.
Can you name 3-5 brands that professional athletes actually use and trust?"

✅ Brand Comparison (explicit brand comparison):
"Which 3-5 sneaker brands are currently trending among young adults in {geo}?
I want to compare brands like Nike, Adidas, and newer emerging brands.
Can you list 3-5 top brands and explain what makes each brand unique?"

✅ Explicit Brand List Request:
"List 3-5 top sustainable fashion brands that operate in {geo}.
I'm interested in brands that use eco-friendly materials and ethical production.
Which 3-5 brands are leading the sustainable fashion movement right now?"

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
# Safe Invoke (UPDATED)
# -----------------------------

async def safe_invoke(chain, payload, retries=2):
    for attempt in range(retries):
        try:
            payload_with_clusters = {
                **payload, 
                "cluster_distribution": format_distribution(CITATION_PROMPT_CLUSTERS)
            }
            result = await chain.ainvoke(payload_with_clusters)
            return result
        except Exception as e:
            if attempt == retries - 1:
                raise e


# -----------------------------
# Run
# -----------------------------

if __name__ == "__main__":
    brand = "Express"
    geo = "US"

    result = asyncio.run(safe_invoke(
        citation_prompts_chain,
        {"brand": brand, "geo": geo}
    ))

    for cluster in result.root:
        print(f"\n=== {cluster.cluster} ===")
        for prompt in cluster.prompts:
            print(f"- {prompt}")