import json
from bs4 import BeautifulSoup
from src.config import JSONLD_CATEGORIES, JSONLD_VALIDATION_RULES
from pydantic import BaseModel
from typing import List, Dict, Any


# -------------------------
# Schema
# -------------------------
class JsonLdType(BaseModel):
    type_: str
    exists: bool
    is_valid: bool


class JsonLdSignal(BaseModel):
    types: List[JsonLdType]


# -------------------------
# Extract JSON-LD
# -------------------------
def extract_jsonld_from_soup(soup: BeautifulSoup) -> List[Dict[str, Any]]:
    scripts = soup.find_all("script", type="application/ld+json")
    data = []

    for script in scripts:
        try:
            content = script.string
            if not content:
                continue

            parsed = json.loads(content)

            if isinstance(parsed, list):
                data.extend(parsed)
            else:
                data.append(parsed)

        except Exception:
            continue

    return data


# -------------------------
# Detect schema types (ONE per type)
# -------------------------
def detect_schema_types(json_ld: List[Dict[str, Any]]) -> Dict[str, dict]:
    found = {}

    def extract_types(obj):
        t = obj.get("@type")

        if not t:
            return []

        if isinstance(t, list):
            return t

        return [t]

    for item in json_ld:
        if not isinstance(item, dict):
            continue

        items = [item]

        if "@graph" in item and isinstance(item["@graph"], list):
            items.extend(item["@graph"])

        for obj in items:
            if not isinstance(obj, dict):
                continue

            types = extract_types(obj)

            for t in types:
                if t not in found:
                    found[t] = obj

    return found


# -------------------------
# Nested field extractor
# -------------------------
def get_nested_value(obj: dict, path: str):
    keys = path.split(".")
    current = obj

    for key in keys:
        if isinstance(current, list):
            current = current[0] if current else {}

        if not isinstance(current, dict):
            return None

        current = current.get(key)

    return current


# -------------------------
# Generic validator (CONFIG-DRIVEN)
# -------------------------
def validate_jsonld_type(type_: str, obj: dict) -> bool:
    rules = JSONLD_VALIDATION_RULES.get(type_)

    if not rules:
        return False  # or True if you want lenient mode

    required_fields = rules.get("required", [])

    return all(
        get_nested_value(obj, field)
        for field in required_fields
    )


# -------------------------
# Main function
# -------------------------
async def find_jsonld_signals(
    soup: BeautifulSoup,
    category: str
) -> JsonLdSignal:

    jsonld_data = extract_jsonld_from_soup(soup)

    # ✅ detect schemas
    detected = detect_schema_types(jsonld_data)

    expected_types = JSONLD_CATEGORIES.get(category, [])

    result = []

    for type_ in expected_types:
        obj = detected.get(type_)

        if obj:
            is_valid = validate_jsonld_type(type_, obj)

            result.append(
                JsonLdType(
                    type_=type_,
                    exists=True,
                    is_valid=is_valid
                )
            )
        else:
            result.append(
                JsonLdType(
                    type_=type_,
                    exists=False,
                    is_valid=False
                )
            )

    return JsonLdSignal(types=result)