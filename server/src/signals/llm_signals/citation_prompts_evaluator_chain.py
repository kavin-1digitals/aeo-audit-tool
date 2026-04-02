from typing import List, Optional
from pydantic import BaseModel, RootModel
from openai import OpenAI

from src.config import OPENAI_API_KEY
from src.signals.llm_signals.citation_prompts_chain import CitationPromptCluster

import asyncio


client = OpenAI(api_key=OPENAI_API_KEY)


# -----------------------------
# Models
# -----------------------------

class CompetitorCitation(BaseModel):
    competitor_entity: str
    is_competitor_mentioned: bool


class PromptAnswer(BaseModel):
    cluster: str
    prompt: str
    answer: str


class PromptAnswers(RootModel[List[PromptAnswer]]):
    pass


class PromptAnswerDual(BaseModel):
    prompt: str
    web_answer: str
    llm_answer: str
    web_entity_mentioned: bool
    llm_entity_mentioned: bool
    competitor_citations_web: List[CompetitorCitation]
    competitor_citations_llm: List[CompetitorCitation]


class PromptAnswerCluster(BaseModel):
    cluster: str
    prompts: List[PromptAnswerDual]


class PromptAnswerClusters(RootModel[List[PromptAnswerCluster]]):
    pass


# -----------------------------
# Helpers
# -----------------------------

def flatten_prompts_with_clusters(clusters: List[CitationPromptCluster]):
    return [
        {"prompt": p, "cluster": c.cluster}
        for c in clusters
        for p in c.prompts
    ]


def format_prompts(prompts):
    return "\n".join([
        f"{i+1}. [CLUSTER: {p['cluster']}] {p['prompt']}"
        for i, p in enumerate(prompts)
    ])


def is_mentioned(text: str, entity: str) -> bool:
    return entity.lower() in text.lower()


# -----------------------------
# 🔥 Prompt Builders (Batch Mode)
# -----------------------------

def build_batch_web_prompt(formatted_prompts: str):
    return f"""
You are an AI assistant with access to a web search tool.

MANDATORY:
- You MUST use web_search before answering

Answer ALL queries below.

{formatted_prompts}

Rules:
- Answer EACH prompt separately
- Maintain 1:1 mapping
- Include 4-7 entities per answer (relevant ones)
- Return structured output

Return JSON list:
[
  {{ "cluster": "...", "prompt": "...", "answer": "..." }}
]
"""


def build_batch_no_web_prompt(formatted_prompts: str):
    return f"""
You are an AI assistant WITHOUT web access.

Answer ALL queries below using general knowledge.

{formatted_prompts}

Rules:
- Answer EACH prompt separately
- Maintain strict 1:1 mapping between prompt and answer
- Each answer MUST include 4-7 relevant entities
- DO NOT return just entity names
- For each entity, include a brief explanation (1 short line) of why it fits the query
- Keep answers concise but informative (2–4 lines total)

Answer format per prompt:
- Write a short natural paragraph OR
- A short list where each entity has a reason

❌ BAD:
A, B, C, D

✅ GOOD:
A – known for X  
B – strong in Y  
C – popular for Z  

Return ONLY JSON list:
[
  {{ "cluster": "...", "prompt": "...", "answer": "..." }}
]
"""


# -----------------------------
# OpenAI Calls
# -----------------------------

def call_openai(prompt: str, use_web=False):
    kwargs = {
        "model": "gpt-4o",
        "input": [{"role": "user", "content": prompt}],
        "temperature": 0.3,
    }

    if use_web:
        kwargs["tools"] = [{"type": "web_search"}]

    response = client.responses.create(**kwargs)

    if hasattr(response, "output_text") and response.output_text:
        return response.output_text

    raise ValueError("No output")


# -----------------------------
# Parse JSON safely
# -----------------------------

import json
import re

def safe_json_load(text):
    try:
        return json.loads(text)
    except:
        match = re.search(r"\[.*\]", text, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise


# -----------------------------
# Safe Invoke
# -----------------------------

async def safe_invoke(
    clusters: List[CitationPromptCluster],
    entity: str,
    competitors: List[str],
    retries: int = 4
) -> Optional[PromptAnswerClusters]:

    flat = flatten_prompts_with_clusters(clusters)
    formatted = format_prompts(flat)

    loop = asyncio.get_event_loop()

    for attempt in range(retries):
        try:
            web_task = loop.run_in_executor(
                None,
                call_openai,
                build_batch_web_prompt(formatted),
                True
            )

            llm_task = loop.run_in_executor(
                None,
                call_openai,
                build_batch_no_web_prompt(formatted),
                False
            )

            web_raw, llm_raw = await asyncio.gather(web_task, llm_task)

            web_res = safe_json_load(web_raw)
            llm_res = safe_json_load(llm_raw)

            merged = []

            for w, l in zip(web_res, llm_res):

                web_ans = w["answer"]
                llm_ans = l["answer"]

                merged.append({
                    "cluster": w["cluster"],
                    "data": PromptAnswerDual(
                        prompt=w["prompt"],
                        web_answer=web_ans,
                        llm_answer=llm_ans,
                        web_entity_mentioned=is_mentioned(web_ans, entity),
                        llm_entity_mentioned=is_mentioned(llm_ans, entity),
                        competitor_citations_web=[
                            CompetitorCitation(
                                competitor_entity=c,
                                is_competitor_mentioned=is_mentioned(web_ans, c)
                            ) for c in competitors
                        ],
                        competitor_citations_llm=[
                            CompetitorCitation(
                                competitor_entity=c,
                                is_competitor_mentioned=is_mentioned(llm_ans, c)
                            ) for c in competitors
                        ]
                    )
                })

            # group
            cluster_map = {}
            for item in merged:
                cluster_map.setdefault(item["cluster"], []).append(item["data"])

            return PromptAnswerClusters(
                root=[
                    PromptAnswerCluster(cluster=k, prompts=v)
                    for k, v in cluster_map.items()
                ]
            )

        except Exception as e:
            if attempt == retries - 1:
                return None