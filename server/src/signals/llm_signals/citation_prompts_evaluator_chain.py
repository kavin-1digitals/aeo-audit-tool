from typing import List, Optional
from pydantic import BaseModel, RootModel
from openai import OpenAI

from src.config import OPENAI_API_KEY
from src.signals.llm_signals.citation_prompts_chain import CitationPromptCluster

import asyncio
import os


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


import re
import string

def normalize_entity(entity: str) -> str:
    """Normalize entity for matching: lowercase, remove punctuation, handle plural/singular, and common variations"""
    # Convert to lowercase
    normalized = entity.lower()
    
    # Handle common punctuation variations
    replacements = {
        '&': ' and ',
        '+': ' plus ',
        '@': ' at ',
        '#': ' number ',
    }
    
    for old, new in replacements.items():
        normalized = normalized.replace(old, new)
    
    # Remove remaining punctuation
    normalized = normalized.translate(str.maketrans('', '', string.punctuation))
    
    # Remove extra spaces
    normalized = ' '.join(normalized.split())
    
    return normalized

def is_mentioned(text: str, entity: str) -> bool:
    """Improved entity matching with plural/singular normalization, punctuation removal, and word boundaries"""
    # Normalize both text and entity
    normalized_text = normalize_entity(text)
    normalized_entity = normalize_entity(entity)
    
    # Handle plural/singular variations
    entity_variations = [normalized_entity]
    
    # Add plural form (simple 's' addition)
    if not normalized_entity.endswith('s'):
        entity_variations.append(normalized_entity + 's')
    
    # Remove trailing 's' for singular form
    if normalized_entity.endswith('s') and len(normalized_entity) > 1:
        entity_variations.append(normalized_entity[:-1])
    
    # Check each variation with word boundaries
    for variation in entity_variations:
        # Create regex pattern with word boundaries
        pattern = r'\b' + re.escape(variation) + r'\b'
        if re.search(pattern, normalized_text):
            return True
    
    return False


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
# Pairing helpers (web answer <-> LLM answer, matched by prompt text)
# -----------------------------

def _prompt_key(text: str) -> str:
    """Whitespace/case/edge-punctuation tolerant key so a lightly re-worded echo still matches."""
    return " ".join((text or "").casefold().split()).strip(" .?!:;\"'`")


def pair_answers(requested: List[str], web_res: list, llm_res: list) -> List[Optional[tuple]]:
    """Return, for each requested prompt (in order), ``(web_answer, llm_answer)`` or ``None``.

    Matching is by prompt text, so a dropped/reordered item can never attach to the wrong prompt.
    Safety net: if the text of an item was altered by the model but BOTH responses still have exactly
    one item per requested prompt, the same index is used (identical to the old behaviour in the
    happy path). Prompts that cannot be paired in both modes are returned as ``None`` (dropped).
    """
    def index(res):
        return {_prompt_key(r.get("prompt", "")): r.get("answer", "") for r in res if isinstance(r, dict)}

    web_idx, llm_idx = index(web_res), index(llm_res)
    same_shape = len(web_res) == len(llm_res) == len(requested)

    paired: List[Optional[tuple]] = []
    for i, prompt in enumerate(requested):
        key = _prompt_key(prompt)
        web_ans, llm_ans = web_idx.get(key), llm_idx.get(key)
        if (web_ans is None or llm_ans is None) and same_shape:
            try:
                web_ans = web_ans if web_ans is not None else web_res[i]["answer"]
                llm_ans = llm_ans if llm_ans is not None else llm_res[i]["answer"]
            except (KeyError, TypeError):
                web_ans = llm_ans = None
        paired.append((web_ans, llm_ans) if web_ans is not None and llm_ans is not None else None)
    return paired


# -----------------------------
# Safe Invoke
# -----------------------------

AI_ANSWER_CONCURRENCY = int(os.getenv("AI_ANSWER_CONCURRENCY", "3"))


async def _answer_cluster(
    cluster: CitationPromptCluster,
    entity: str,
    competitors: List[str],
    retries: int,
) -> List[PromptAnswerDual]:
    """Answer one cluster's prompts (web + no-web in parallel), retrying only this cluster."""
    flat = flatten_prompts_with_clusters([cluster])
    formatted = format_prompts(flat)
    loop = asyncio.get_running_loop()
    last_error: Optional[Exception] = None

    for attempt in range(retries):
        try:
            web_raw, llm_raw = await asyncio.gather(
                loop.run_in_executor(None, call_openai, build_batch_web_prompt(formatted), True),
                loop.run_in_executor(None, call_openai, build_batch_no_web_prompt(formatted), False),
            )
            pairs = pair_answers(list(cluster.prompts), safe_json_load(web_raw), safe_json_load(llm_raw))
            results = [
                PromptAnswerDual(
                    prompt=prompt,
                    web_answer=pair[0],
                    llm_answer=pair[1],
                    web_entity_mentioned=is_mentioned(pair[0], entity),
                    llm_entity_mentioned=is_mentioned(pair[1], entity),
                    competitor_citations_web=[
                        CompetitorCitation(competitor_entity=c, is_competitor_mentioned=is_mentioned(pair[0], c))
                        for c in competitors
                    ],
                    competitor_citations_llm=[
                        CompetitorCitation(competitor_entity=c, is_competitor_mentioned=is_mentioned(pair[1], c))
                        for c in competitors
                    ],
                )
                for prompt, pair in zip(cluster.prompts, pairs) if pair is not None
            ]
            if not results:
                raise ValueError(f"No prompt of cluster '{cluster.cluster}' could be paired")
            return results
        except Exception as exc:  # retried below; final failure propagates to the caller
            last_error = exc
            if attempt < retries - 1:
                await asyncio.sleep(attempt + 1)

    raise last_error  # type: ignore[misc]


async def safe_invoke(
    clusters: List[CitationPromptCluster],
    entity: str,
    competitors: List[str],
    retries: int = 4,
    progress=None,
) -> Optional[PromptAnswerClusters]:
    """Evaluate all prompts per cluster with bounded concurrency.

    Result schema/ordering are unchanged. All-or-nothing: if any cluster still fails after its
    retries the function returns ``None`` exactly like before, so the existing
    "LLM signals unavailable" handling is untouched and no partial data can skew SOV/coverage.
    """
    total = sum(len(c.prompts) for c in clusters)
    done = 0
    if progress:
        progress.stage_progress("ai_answers", 0, total)

    sem = asyncio.Semaphore(max(1, AI_ANSWER_CONCURRENCY))

    async def run(cluster: CitationPromptCluster):
        nonlocal done
        async with sem:
            result = await _answer_cluster(cluster, entity, competitors, retries)
        done += len(cluster.prompts)
        if progress:
            progress.stage_progress("ai_answers", done, total)
        return result

    outcomes = await asyncio.gather(*[run(c) for c in clusters], return_exceptions=True)
    if any(isinstance(o, Exception) for o in outcomes):
        return None

    return PromptAnswerClusters(
        root=[PromptAnswerCluster(cluster=c.cluster, prompts=o) for c, o in zip(clusters, outcomes)]
    )
