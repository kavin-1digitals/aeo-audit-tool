from pydantic import BaseModel, computed_field
from src.signals.site_signals.canonical_signals import CanonicalSignal
from src.scorecard import Score, RawScoreCard

from typing import Optional, List

async def calculate_canonical_score(canonical_signal: CanonicalSignal):
    scores = []
    
    # Rule 1: Canonical exists or not
    if canonical_signal.exists:
        scores.append(Score(value=1.0, signal_name='canonical_exists', signal_path=['Site Signals', 'Canonical URLs'], remediation_plan=None, success_state='Canonical tag successfully found on this page. This helps prevent duplicate content issues and consolidates ranking signals to your preferred URL.'))
    else:
        scores.append(Score(value=-1.0, signal_name='canonical_exists', signal_path=['Site Signals', 'Canonical URLs'], remediation_plan='Add a canonical tag to this page\'s HTML head section: <link rel="canonical" href="https://yourdomain.com/this-page">. This helps prevent duplicate content issues and tells search engines which version of the page to index.', success_state=None))
    
    # Rule 2: Canonical matches or not
    if canonical_signal.exists:
        if canonical_signal.matches_final_url:
            scores.append(Score(value=1.0, signal_name='canonical_matches', signal_path=['Site Signals', 'Canonical URLs'], remediation_plan=None, success_state='Canonical URL matches page URL'))
        else:
            scores.append(Score(value=-1.0, signal_name='canonical_matches', signal_path=['Site Signals', 'Canonical URLs'], remediation_plan='Update canonical URL to match page URL', success_state=None))
    else:
        # If canonical doesn't exist, no matching validation needed
        pass
    
    # Rule 3: Is clean or not
    if canonical_signal.exists:
        if canonical_signal.is_clean:
            scores.append(Score(value=1.0, signal_name='canonical_clean', signal_path=['Site Signals', 'Canonical URLs'], remediation_plan=None, success_state='Canonical URL is clean (no query parameters)'))
        else:
            scores.append(Score(value=-1.0, signal_name='canonical_clean', signal_path=['Site Signals', 'Canonical URLs'], remediation_plan='Remove query parameters from canonical URL', success_state=None))
    else:
        # If canonical doesn't exist, no clean URL validation needed
        pass
    
    return RawScoreCard(scores=scores)