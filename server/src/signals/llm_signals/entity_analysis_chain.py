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
STEP 2 — COMPETITOR DISCOVERY + SCORING (MERGED)
════════════════════════════════════════════════════

Continuously discover AND evaluate competitors until you have enough strong candidates.

Start with 10–15 candidates from:
- "{entity} competitors {geo}"
- "{entity} alternatives"
- Category-level competitors
- Substitute solutions

For EACH candidate:

1. Assign a score:

+3 → SAME PRIMARY USE CASE (MANDATORY anchor)
+2 → SAME CATEGORY
+1 → SIMILAR TARGET AUDIENCE
+1 → SIMILAR PRICE TIER
+1 → SIMILAR BUSINESS MODEL
+1 → REALISTIC SUBSTITUTE in {geo}

Max score = 9

2. Apply controlled exclusion:

REJECT ONLY if:
- Primary use case is COMPLETELY different ❗
- Not a realistic substitute under any scenario

Otherwise:
→ KEEP and score

════════════════════════════════════════════════════
STEP 3 — SELECTION + RELAXATION LOOP (CRITICAL FIX)
════════════════════════════════════════════════════

Sort candidates by score (highest → lowest)

Select top candidates.

IF total selected < 3:

→ CONTINUE SEARCHING and RELAX constraints in this EXACT order:

1. Allow different business model  
2. Expand price tolerance to ±2 tiers  
3. Allow adjacent category (BUT SAME USE CASE)  
4. Allow broader audience overlap  

After each relaxation:
→ Add new candidates
→ Score them
→ Re-rank

🔁 REPEAT until you have at least 3 candidates

════════════════════════════════════════════════════
STRICT RULES (NON-NEGOTIABLE)
════════════════════════════════════════════════════
- Primary use case MUST remain similar
- Substitutes ARE valid competitors
- Do NOT stop early with <3 candidates
- Do NOT rely only on “perfect matches”

Think:
"Would a real customer realistically choose this instead?"

════════════════════════════════════════════════════
FINAL VALIDATION (MANDATORY)
════════════════════════════════════════════════════

- If competitors < 3 → KEEP EXPANDING (DO NOT STOP)
- If competitors > 5 → keep top 5 by score
- Final list MUST contain 3–5 competitors

If this condition is not met → your response is INVALID

════════════════════════════════════════════════════
STEP 4 — OUTPUT
════════════════════════════════════════════════════

Return ONLY valid JSON matching the schema below.

CRITICAL:
- "top_competitors" MUST contain 3-5 items
- No explanations
- No markdown
- No extra text

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
    entity = "myntra"
    geo = "India"

    result = asyncio.run(safe_invoke(entity, geo))

    print("\n=== Final Entity Analysis ===")
    print(result.model_dump_json(indent=2))