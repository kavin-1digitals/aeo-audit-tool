from typing import List, Dict, Optional
from src.signals.site_signals.jsonld_signals import JsonLdType
from src.scorecard import Score, RawScoreCard
from src.config import JSONLD_VALIDATION_RULES, JSONLD_CATEGORIES


async def calculate_jsonld_score(jsonld_signals: List[JsonLdType], site_types: Optional[List[str]] = None):
    scores = []

    # Get site-specific expected types, fallback to all types if site_types not provided
    if site_types:
        # For multiple site types, collect all expected types
        expected_types = []
        for st in site_types:
            expected_types.extend(JSONLD_CATEGORIES.get(st, []))
    else:
        expected_types = list(JSONLD_VALIDATION_RULES.keys())

    # -----------------------------
    # SITE-LEVEL: EXISTS (once per type)
    # -----------------------------
    found_types: set = {signal.type_ for signal in jsonld_signals}

    for expected_type in expected_types:
        if expected_type in found_types:
            scores.append(
                Score(
                    value=1.0,
                    signal_name='jsonld_exists',
                    signal_path=['Site Signals', 'Structured Data'],
                    remediation_plan=None,
                    success_state=f'JSON-LD schema {expected_type} found'
                )
            )
        else:
            scores.append(
                Score(
                    value=-1.0,
                    signal_name='jsonld_exists',
                    signal_path=['Site Signals', 'Structured Data'],
                    remediation_plan=f'Add JSON-LD schema {expected_type}',
                    success_state=None
                )
            )
    # -----------------------------
    # PAGE-LEVEL: VALID (every occurrence)
    # -----------------------------
    for signal in jsonld_signals:
        if signal.type_ not in expected_types:
            continue

        if signal.is_valid:
            scores.append(
                Score(
                    value=1.0,
                    signal_name='jsonld_valid',
                    signal_path=['Site Signals', 'Structured Data'],
                    remediation_plan=None,
                    success_state=f'JSON-LD schema {signal.type_} is valid on {signal.url}'
                )
            )
        else:
            scores.append(
                Score(
                    value=-1.0,
                    signal_name='jsonld_valid',
                    signal_path=['Site Signals', 'Structured Data'],
                    remediation_plan=f'Fix JSON-LD schema {signal.type_} validation issues on {signal.url}',
                    success_state=None
                )
            )

    return RawScoreCard(scores=scores)
