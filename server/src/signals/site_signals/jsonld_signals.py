import json
from bs4 import BeautifulSoup
from src.config import JSONLD_VALIDATION_RULES
from pydantic import BaseModel
from typing import List, Dict, Any
import logging

# Setup JSON-LD validation logger
jsonld_logger = logging.getLogger('jsonld_validation')

# Control logging - set to False to pause JSON-LD logging
ENABLE_JSONLD_LOGGING = False

if not ENABLE_JSONLD_LOGGING:
    # Set to higher level to effectively disable logging
    jsonld_logger.setLevel(logging.CRITICAL + 1)


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
def detect_schema_types(json_ld: List[Dict[str, Any]]) -> Dict[str, List[dict]]:
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
                    found[t] = []

                found[t].append(obj)  # 🔥 store ALL instances

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
def validate_jsonld_type(type_: str, objects: List[dict]) -> bool:
    jsonld_logger.info(f"=== VALIDATING SCHEMA: {type_} ===")
    jsonld_logger.info(f"Found {len(objects)} objects for this type")
    
    rules = JSONLD_VALIDATION_RULES.get(type_)
    jsonld_logger.info(f"Validation rules: {rules}")

    # Check if no rules exist
    if not rules:
        jsonld_logger.info(f"No validation rules for {type_} - treating as valid")
        return True

    required_fields = rules.get("required", [])
    jsonld_logger.info(f"Required fields: {required_fields}")

    # Validate each object
    for i, obj in enumerate(objects):
        jsonld_logger.info(f"--- Validating object {i+1}/{len(objects)} ---")
        jsonld_logger.info(f"Object data: {json.dumps(obj, indent=2)}")
        
        is_valid = True
        missing_fields = []

        for field in required_fields:
            value = get_nested_value(obj, field)
            jsonld_logger.info(f"Checking field '{field}': {value}")

            if value is None or value == "":
                is_valid = False
                missing_fields.append(field)
                jsonld_logger.warning(f"Missing or empty field: {field}")

        if is_valid:
            jsonld_logger.info(f"Object {i+1} is VALID - all required fields present")
            return True
        else:
            jsonld_logger.warning(f"Object {i+1} is INVALID - missing fields: {missing_fields}")

    jsonld_logger.warning(f"ALL objects failed validation for {type_}")
    return False


# -------------------------
# MAIN FUNCTION (UPDATED)
# -------------------------
def find_jsonld_signal(
    full_domain: str,
    content: str,
    validation_types: List[str]
) -> JsonLdSignals:

    jsonld_logger.info(f"=== JSON-LD ANALYSIS FOR: {full_domain} ===")
    jsonld_logger.info(f"Looking for validation types: {validation_types}")

    soup = BeautifulSoup(content, "html.parser")

    jsonld_data = extract_jsonld_from_soup(soup)
    jsonld_logger.info(f"Found {len(jsonld_data)} JSON-LD objects in HTML")
    
    if jsonld_data:
        jsonld_logger.info(f"JSON-LD data preview: {json.dumps(jsonld_data[:2], indent=2)}")
    
    detected = detect_schema_types(jsonld_data)
    jsonld_logger.info(f"Detected schema types: {list(detected.keys())}")
    
    for schema_type, objects in detected.items():
        jsonld_logger.info(f"Found {len(objects)} objects of type '{schema_type}'")

    result = []

    for type_ in validation_types:
        objects = detected.get(type_)
        jsonld_logger.info(f"--- Processing validation type: {type_} ---")
        jsonld_logger.info(f"Objects found: {len(objects) if objects else 0}")

        if objects:
            is_valid = validate_jsonld_type(type_, objects)
            jsonld_logger.info(f"Validation result for {type_}: {'VALID' if is_valid else 'INVALID'}")

            result.append(
                JsonLdType(
                    url=full_domain,
                    type_=type_,
                    exists=True,
                    is_valid=is_valid
                )
            )
        else:
            jsonld_logger.warning(f"No objects found for type: {type_}")
            result.append(
                JsonLdType(
                    url=full_domain,
                    type_=type_,
                    exists=False,
                    is_valid=False
                )
            )

    jsonld_logger.info(f"=== JSON-LD ANALYSIS COMPLETE FOR: {full_domain} ===")
    return JsonLdSignals(jsonld_signals=result)