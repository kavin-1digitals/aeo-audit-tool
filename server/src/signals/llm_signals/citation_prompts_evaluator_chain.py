from typing import List

from pydantic import BaseModel, RootModel

from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import PydanticOutputParser

from src.config import LLM_PROVIDERS
from src.signals.llm_signals.llm_client import get_llm_client
from src.signals.llm_signals.citation_prompts_chain import CitationPromptCluster
import asyncio

# -----------------------------
# Pydantic Models
# -----------------------------

class CompetitorCitation(BaseModel):
    competitor_brand: str
    is_competitor_mentioned: bool

class PromptAnswer(BaseModel):
    prompt: str
    answer: str

class PromptInput(PromptAnswer):
    cluster: str

class PromptAnswers(RootModel[List[PromptInput]]):
    pass

class PromptAnswerCitations(PromptAnswer):
    is_brand_mentioned: bool
    competitor_citations: List[CompetitorCitation]

class PromptAnswerCluster(BaseModel):
    cluster: str
    prompts: List[PromptAnswerCitations]
    is_brand_mentioned: bool
    competitor_citations: List[CompetitorCitation]

class PromptAnswerClusters(RootModel[List[PromptAnswerCluster]]):
    pass

# -----------------------------
# Parser
# -----------------------------

parser = PydanticOutputParser(pydantic_object=PromptAnswers)


# -----------------------------
# Prompt Template
# -----------------------------

prompt_eval_template = PromptTemplate(
    input_variables=["prompts"],
    partial_variables={
        "format_instructions": parser.get_format_instructions()
    },
template="""
You are simulating responses from advanced AI assistants like ChatGPT, Perplexity, or Gemini.

Your task is to answer EACH user query individually in a realistic, high-quality manner.

════════════════════════════════════════════════════════════════
INPUT PROMPTS
════════════════════════════════════════════════════════════════

{prompts}

INPUT FORMAT:

Each prompt is prefixed with its cluster like:
[CLUSTER: <cluster_name>] <prompt>

You MUST:
- Extract ONLY the cluster_name exactly as provided
- REMOVE the "[CLUSTER: ...]" wrapper
- Return only the clean cluster value

Example:
Input: [CLUSTER: Pricing & Value]
Output: "Pricing & Value"

════════════════════════════════════════════════════════════════
CORE INSTRUCTIONS
════════════════════════════════════════════════════════════════

- Answer EVERY prompt
- Do NOT skip any prompt
- Do NOT merge prompts
- Maintain strict 1:1 mapping:
  → one prompt → one answer

════════════════════════════════════════════════════════════════
ANSWER QUALITY REQUIREMENTS (CRITICAL)
════════════════════════════════════════════════════════════════

Each answer MUST:

1. Include 3–5 relevant brands
2. NOT just list brands — provide context
3. Include light comparison or differentiation
4. Reflect implicit ranking or positioning

GOOD STYLE:
- "Nike and Lululemon are among the leading brands..."
- "Fabletics is a more affordable alternative to..."
- "Alo Yoga stands out for..."

BAD STYLE:
- "Some brands include Nike, Adidas..."

════════════════════════════════════════════════════════════════
VARIATION RULES (IMPORTANT)
════════════════════════════════════════════════════════════════

- Do NOT repeat the same brand order in every answer
- Do NOT always start with the same brands
- Vary phrasing across answers
- Avoid repetitive sentence structures

════════════════════════════════════════════════════════════════
REALISM GUIDELINES
════════════════════════════════════════════════════════════════

- Answers should feel like real AI assistant outputs
- Be slightly opinionated when appropriate
- Include natural comparisons (premium vs budget, etc.)
- Reflect real-world positioning of brands

════════════════════════════════════════════════════════════════
FORMAT RULES
════════════════════════════════════════════════════════════════

Each answer must:
- Be 2–5 sentences
- Be concise but informative
- NOT repeat the prompt text
- NOT reference other prompts
- NOT summarize multiple prompts

════════════════════════════════════════════════════════════════
FINAL VALIDATION STEP (MANDATORY)
════════════════════════════════════════════════════════════════

Before output:
- Ensure every prompt has exactly one answer
- Ensure answers are not generic lists
- Ensure variation across answers

════════════════════════════════════════════════════════════════
OUTPUT FORMAT
════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS:

For EACH prompt return:
- cluster (exactly as given)
- prompt
- answer

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

citation_prompts_evaluator_chain = prompt_eval_template | llm | parser


# -----------------------------
# Helpers
# -----------------------------

def flatten_prompts_with_clusters(clusters: List[CitationPromptCluster]):
    flat = []
    for cluster in clusters:
        for prompt in cluster.prompts:
            flat.append({
                "prompt": prompt,
                "cluster": cluster.cluster
            })
    return flat


def format_prompts(prompts):
    return "\n".join([
        f"{i+1}. [CLUSTER: {p['cluster']}] {p['prompt']}"
        for i, p in enumerate(prompts)
    ])

def normalize(text: str) -> str:
    return text.lower()


def is_mentioned(text: str, brand: str) -> bool:
    return brand.lower() in text.lower()


# -----------------------------
# Safe Invoke
# -----------------------------

async def safe_invoke(chain, clusters, brand: str, competitors: List[str], retries=2):
    flat_prompts = flatten_prompts_with_clusters(clusters)
    formatted = format_prompts(flat_prompts)

    for attempt in range(retries):
        try:
            result = await chain.ainvoke({
                "prompts": formatted
            })

            responses = result.root

            # -----------------------------
            # STEP 1: Enrich prompt-level
            # -----------------------------
            enriched = []

            for item in responses:

                if not item.cluster:
                    raise ValueError("Missing cluster in LLM output")

                answer_text = item.answer
                cluster_name = item.cluster

                brand_flag = is_mentioned(answer_text, brand)

                competitor_list = [
                    CompetitorCitation(
                        competitor_brand=comp,
                        is_competitor_mentioned=is_mentioned(answer_text, comp)
                    )
                    for comp in competitors
                ]

                enriched.append({
                    "cluster": cluster_name,
                    "data": PromptAnswerCitations(
                        prompt=item.prompt,
                        answer=answer_text,
                        is_brand_mentioned=brand_flag,
                        competitor_citations=competitor_list
                    )
                })

            # -----------------------------
            # STEP 2: Group by cluster
            # -----------------------------
            cluster_map = {}

            for item in enriched:
                cluster = item["cluster"]

                if cluster not in cluster_map:
                    cluster_map[cluster] = []

                cluster_map[cluster].append(item["data"])

            # -----------------------------
            # STEP 3: Cluster aggregation
            # -----------------------------
            final_output: List[PromptAnswerCluster] = []

            for cluster_name, prompts in cluster_map.items():

                cluster_brand_flag = any(p.is_brand_mentioned for p in prompts)

                competitor_agg = []

                for comp in competitors:
                    comp_flag = any(
                        any(
                            c.competitor_brand == comp and c.is_competitor_mentioned
                            for c in p.competitor_citations
                        )
                        for p in prompts
                    )

                    competitor_agg.append(
                        CompetitorCitation(
                            competitor_brand=comp,
                            is_competitor_mentioned=comp_flag
                        )
                    )

                final_output.append(
                    PromptAnswerCluster(
                        cluster=cluster_name,
                        prompts=prompts,
                        is_brand_mentioned=cluster_brand_flag,
                        competitor_citations=competitor_agg
                    )
                )

            # ✅ FIX HERE
            return PromptAnswerClusters(root=final_output)

        except Exception as e:
            if attempt == retries - 1:
                raise e
# -----------------------------
# Run
# -----------------------------

if __name__ == "__main__":

    # Example input (simulate previous chain output)
    sample_clusters = [
        CitationPromptCluster(
            cluster="Brand Discovery",
            prompts=[
                "What are some popular activewear brands in the United States?",
                "Which brands offer stylish yoga apparel for women?",
                "What are the best brands for high-quality workout leggings?"
            ]
        ),
        CitationPromptCluster(
            cluster="Brand Recommendation",
            prompts=[
                "Can you recommend some top brands for yoga clothes that are eco-friendly?",
                "What are the best brands for comfortable athleisure wear in the United States?",
                "Which brands are known for their premium yoga mats?"
            ]
        ),
        CitationPromptCluster(
            cluster="Brand Comparison",
            prompts=[
                "How do the top yoga apparel brands compare in terms of price and quality?",
                "Which brands offer the best value for yoga pants?",
                "What are the differences between popular activewear brands in the United States?"
            ]
        ),
        CitationPromptCluster(
            cluster="Pricing & Value",
            prompts=[
                "What are the price ranges for the best yoga clothing brands?",
                "Which brands provide the best value for money in workout gear?",
                "How do the prices of premium activewear brands compare in the United States?"
            ]
        ),
        CitationPromptCluster(
            cluster="Quality & Durability",
            prompts=[
                "Which brands are known for their durable yoga mats?",
                "What are the best brands for high-quality workout clothes that last?"
            ]
        ),
        CitationPromptCluster(
            cluster="Style & Trends",
            prompts=[
                "What are the trending brands for stylish yoga wear right now?",
                "Which activewear brands are popular among fitness influencers in the United States?",
                "What are the best brands for fashionable athleisure outfits?"
            ]
        ),
        CitationPromptCluster(
            cluster="Fit & Usability",
            prompts=[
                "Which brands offer the best fit for plus-size yoga clothing?",
                "What are the top brands for comfortable and functional workout gear?",
            ]
        )
    ]

    brand = "Alo Yoga"
    competitors = ["Athleta", "Lululemon", "Outdoor Voices", "Vuori"]

    result = asyncio.run(safe_invoke(
        citation_prompts_evaluator_chain,
        sample_clusters,
        brand,
        competitors
    ))

    print(result.model_dump_json(indent=2))
