import json
from bs4 import BeautifulSoup
from src.config import JSONLD_VALIDATION_RULES
from pydantic import BaseModel
from typing import List, Dict, Any


# -------------------------
# Schema
# -------------------------
class JsonLdType(BaseModel):
    url: str
    type_: str
    exists: bool
    is_valid: bool


class JsonLdSignals(BaseModel):
    jsonld_signals: List[JsonLdType]


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
# Detect schema types
# -------------------------
def detect_schema_types(json_ld: List[Dict[str, Any]]) -> Dict[str, dict]:
    found = {}

    def extract_types(obj):
        t = obj.get("@type")
        if not t:
            return []
        return t if isinstance(t, list) else [t]

    for item in json_ld:
        if not isinstance(item, dict):
            continue

        items = [item]

        if "@graph" in item and isinstance(item["@graph"], list):
            items.extend(item["@graph"])

        for obj in items:
            if not isinstance(obj, dict):
                continue

            for t in extract_types(obj):
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
# Validator
# -------------------------
def validate_jsonld_type(type_: str, obj: dict) -> bool:
    rules = JSONLD_VALIDATION_RULES.get(type_)
    if not rules:
        return False

    required_fields = rules.get("required", [])

    return all(get_nested_value(obj, field) for field in required_fields)


# -------------------------
# MAIN FUNCTION (UPDATED)
# -------------------------
def find_jsonld_signal(
    full_domain: str,
    content: str,
    validation_types: List[str]
) -> JsonLdSignals:

    soup = BeautifulSoup(content, "html.parser")

    jsonld_data = extract_jsonld_from_soup(soup)
    detected = detect_schema_types(jsonld_data)

    result = []

    for type_ in validation_types:
        obj = detected.get(type_)

        if obj:
            is_valid = validate_jsonld_type(type_, obj)
            result.append(JsonLdType(url=full_domain, type_=type_, exists=True, is_valid=is_valid))

    return JsonLdSignals(jsonld_signals=result)
