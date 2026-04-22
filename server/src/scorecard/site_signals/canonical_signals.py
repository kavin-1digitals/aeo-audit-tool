from pydantic import BaseModel, computed_field
from src.signals.site_signals.canonical_signals import CanonicalSignal
from src.signals.site_signals import SiteSignal
from src.scorecard import Score, RawScoreCard

from typing import Optional, List

async def calculate_canonical_score(site_signal: SiteSignal, site_types: Optional[List[str]] = None):
    scores = []
    canonical_signal = site_signal.canonical_signal
    
    # Rule 1: Canonical exists or not
    if canonical_signal.exists:
        scores.append(Score(value=1.0, signal_name='canonical_exists', signal_path=['Site Signals', 'Canonical URLs'], remediation_plan=None, success_state=f'Canonical tag successfully found on {site_signal.url}. This helps prevent duplicate content issues and consolidates ranking signals to your preferred URL.'))
    else:
        scores.append(Score(value=-1.0, signal_name='canonical_exists', signal_path=['Site Signals', 'Canonical URLs'], remediation_plan=f'Add a canonical tag to this page\'s HTML head section: <link rel="canonical" href="{site_signal.url}">. This helps prevent duplicate content issues and tells search engines which version of the page to index.', success_state=None))
        scores.append(Score(value=-1.0, signal_name='canonical_matches', signal_path=['Site Signals', 'Canonical URLs'], remediation_plan=f'Update canonical URL to match page URL for {site_signal.url}', success_state=None))
        scores.append(Score(value=-0.5, signal_name='canonical_clean', signal_path=['Site Signals', 'Canonical URLs'], remediation_plan=f'Remove query parameters from canonical URL for {site_signal.url}', success_state=None))
    
    # Rule 2: Canonical matches or not
    if canonical_signal.exists:
        if canonical_signal.matches_final_url:
            scores.append(Score(value=1.0, signal_name='canonical_matches', signal_path=['Site Signals', 'Canonical URLs'], remediation_plan=None, success_state=f'Canonical URL matches page URL for {site_signal.url}'))
        else:
            scores.append(Score(value=-1.0, signal_name='canonical_matches', signal_path=['Site Signals', 'Canonical URLs'], remediation_plan=f'Update canonical URL to match page URL for {site_signal.url}', success_state=None))
            scores.append(Score(value=-0.5, signal_name='canonical_clean', signal_path=['Site Signals', 'Canonical URLs'], remediation_plan=f'Remove query parameters from canonical URL for {site_signal.url}', success_state=None))
    else:
        # If canonical doesn't exist, no matching validation needed
        pass
    
    
    if canonical_signal.exists:
        if canonical_signal.is_clean:
            scores.append(Score(value=1.0, signal_name='canonical_clean', signal_path=['Site Signals', 'Canonical URLs'], remediation_plan=None, success_state=f'Canonical URL is clean (no query parameters) for {site_signal.url}'))
        else:
            scores.append(Score(value=-0.5, signal_name='canonical_clean', signal_path=['Site Signals', 'Canonical URLs'], remediation_plan=f'Remove query parameters from canonical URL for {site_signal.url}', success_state=None))
    
    return RawScoreCard(scores=scores)