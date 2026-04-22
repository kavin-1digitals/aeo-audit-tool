from typing import List, Optional
from pydantic import BaseModel, Field
from openai import OpenAI
import asyncio
import json
import re
from src.config import OPENAI_API_KEY


# -----------------------------
# OpenAI Client
# -----------------------------
client = OpenAI(api_key=OPENAI_API_KEY)


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


class EntityProfile(BaseModel):
    entity_type: ProfileField
    category: ProfileField
    subcategory: ProfileField
    business_model: ProfileField
    price_tier: ProfileField
    target_audience: ProfileField
    core_offerings: ListProfileField
    key_use_cases: ListProfileField
    capability_surfaces: ListProfileField
    top_competitors: ListProfileField


class EntityAnalysis(BaseModel):
    entity: str
    entity_confidence: float = Field(..., ge=0.0, le=1.0)
    entity_confidence_reasoning: str
    profile: EntityProfile


# -----------------------------
# Prompt Builder (Updated with your new detailed structure)
# -----------------------------
def build_prompt(entity: str, geo: str) -> str:
    schema = EntityAnalysis.model_json_schema()
    
    return f"""
You are a Competitive Intelligence Analyst.

Analyse the entity "{entity}" in the market "{geo}".

════════════════════════════════════════════════════
MANDATORY RESEARCH PHASE (DO THIS FIRST)
════════════════════════════════════════════════════
You MUST use the web_search tool multiple times before answering.
Run targeted searches to establish:

1. What the entity actually sells / offers (core offering)
2. Its primary use case (why customers buy / use it)
3. Price range (budget / value / mid / upper-mid / premium / luxury)
4. Target audience (age, lifestyle, intent)
5. Business model (D2C, marketplace, offline-first, hybrid, etc.)

Suggested search queries:
- "{entity} what does it sell {geo}"
- "{entity} pricing OR price range {geo}"
- "{entity} target audience OR customer {geo}"
- "{entity} alternatives OR similar {geo}"
- "brands similar to {entity} {geo}"
- "{entity} competitors {geo}"

Do NOT proceed until you clearly understand the entity.

════════════════════════════════════════════════════
STEP 1 — ENTITY UNDERSTANDING
════════════════════════════════════════════════════
Internally define:
- Core category
- Primary use case (this is the SINGLE MOST IMPORTANT factor)
- Price tier
- Target audience
- Business model

════════════════════════════════════════════════════
STEP 2 — COMPETITOR GENERATION (CANDIDATES)
════════════════════════════════════════════════════
Generate an initial list of 8–12 possible competitors using search results.

════════════════════════════════════════════════════
STEP 3 — STRICT ELIMINATION FILTER (CRITICAL)
════════════════════════════════════════════════════
For EACH candidate, validate ALL conditions below.
A TRUE DIRECT COMPETITOR must satisfy **ALL**:

1. SAME CATEGORY
2. SAME PRIMARY USE CASE (customers use both for the exact same purpose)
3. SIMILAR PRICE TIER (max ±1 tier difference)
4. SAME TARGET AUDIENCE
5. SAME BUSINESS MODEL
6. REAL SUBSTITUTABILITY → "Would a real customer in {geo} realistically choose this instead of {entity}?"

════════════════════════════════════════════════════
🚫 HARD EXCLUSION RULES (ZERO TOLERANCE)
════════════════════════════════════════════════════
Immediately reject if:
- Different primary use case
- Different category
- Different target audience
- Marketplace/aggregator (unless the entity itself is one)
- Large price tier gap
- Loosely related or "somewhat similar" only

════════════════════════════════════════════════════
STEP 4 — FINAL COMPETITOR LIST
════════════════════════════════════════════════════
Return only 4-6 high-confidence direct competitors.
Quality > Quantity. If fewer than 3 truly qualify, return fewer.

════════════════════════════════════════════════════
STEP 5 — OUTPUT
════════════════════════════════════════════════════
Return ONLY valid JSON matching the schema below.
No explanations. No markdown. No extra text.

Schema:
{json.dumps(schema, indent=2)}
"""

# -----------------------------
# Safe JSON Loader
# -----------------------------
def safe_json_load(text: str):
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        raise ValueError(f"Failed to parse JSON. Raw output: {text[:500]}...")


# -----------------------------
# LLM Call
# -----------------------------
def call_openai(prompt: str) -> str:
    try:
        response = client.responses.create(
            model="gpt-4o",
            input=[{"role": "user", "content": prompt}],
            tools=[{"type": "web_search"}],
            temperature=0.1,
        )

        if hasattr(response, "output_text") and response.output_text:
            return response.output_text

        for item in response.output:
            if getattr(item, "type", None) == "message":
                if item.content and len(item.content) > 0:
                    content_part = item.content[0]
                    if hasattr(content_part, "text"):
                        text = getattr(content_part.text, "value", content_part.text)
                        return text

        raise ValueError("Could not extract text from response.")

    except Exception as e:
        print(f"OpenAI API Error: {e}")
        raise


# -----------------------------
# Core Analysis
# -----------------------------
async def run_analysis(entity: str, geo: str) -> EntityAnalysis:
    prompt = build_prompt(entity, geo)
    print(f"Analyzing entity: {entity} (Geo: {geo})")
    
    text_output = call_openai(prompt)
    data = safe_json_load(text_output)
    
    return EntityAnalysis(**data)


# -----------------------------
# Safe Invoke with Retry
# -----------------------------
async def safe_invoke(entity: str, geo: str, retries: int = 4):
    for attempt in range(retries):
        try:
            return await run_analysis(entity, geo)
        except Exception as e:
            if attempt == retries - 1:
                print(f"All {retries} attempts failed for entity '{entity}'")
                return None
            print(f"Retry {attempt + 1}/{retries} due to error: {type(e).__name__} - {e}")


# -----------------------------
# Main Execution
# -----------------------------
if __name__ == "__main__":
    entity = "Banana Club"
    geo = "India"

    result = asyncio.run(safe_invoke(entity, geo))

    print("\n=== Final Entity Analysis ===")
    print(result.model_dump_json(indent=2))