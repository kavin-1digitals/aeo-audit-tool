from pydantic import BaseModel, computed_field
from src.signals.site_signals.jsonld_signals import JsonLdSignal
from src.scorecard import Score, RawScoreCard

from typing import Optional, List

async def calculate_jsonld_score(jsonld_signal: JsonLdSignal):
    scores = []
    
    # Process each JSON-LD type based on JSONLD_CATEGORIES
    for jsonld_type in jsonld_signal.types:
        type_name = jsonld_type.type_
        
        # Rule 1: Exists +1/-1
        if jsonld_type.exists:
            scores.append(Score(value=1.0, signal_name='jsonld_exists', signal_path=['Site Signals', 'Structured Data'], remediation_plan=None, success_state=f'JSON-LD schema {type_name} found'))
        else:
            scores.append(Score(value=-1.0, signal_name='jsonld_exists', signal_path=['Site Signals', 'Structured Data'], remediation_plan=f'Add JSON-LD schema {type_name} to page', success_state=None))
        
        # Rule 2: Valid +1/-1 (only check if exists)
        if jsonld_type.exists:
            if jsonld_type.is_valid:
                scores.append(Score(value=1.0, signal_name='jsonld_valid', signal_path=['Site Signals', 'Structured Data'], remediation_plan=None, success_state=f'JSON-LD schema {type_name} is valid'))
            else:
                scores.append(Score(value=-1.0, signal_name='jsonld_valid', signal_path=['Site Signals', 'Structured Data'], remediation_plan=f'Fix JSON-LD schema {type_name} validation issues', success_state=None))
        else:
            # If schema doesn't exist, no validation needed
            pass
    
    return RawScoreCard(scores=scores)