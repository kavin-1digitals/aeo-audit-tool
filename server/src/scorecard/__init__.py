from pydantic import BaseModel, computed_field
from typing import Optional, List
from src.signals import Signals

class Score(BaseModel):
    value: float
    signal_name: str
    signal_path: List[str]
    remediation_plan: Optional[str] = None
    success_state: Optional[str] = None

class RawScoreCard(BaseModel):
    scores: List[Score]

class ScoreCard(BaseModel):
    raw_scorecard: RawScoreCard
    path_scorecard: dict
    total_checks: int
    total_score: float
    total_percentage: float


async def create_aeo_scorecard(signals: Signals, brand: str = None) -> ScoreCard:
    from .domain_signals.llms_txt_signals import calculate_llms_txt_score
    from .domain_signals.robots_txt_signals import calculate_robots_txt_score
    from .domain_signals.sitemap_signals import calculate_sitemap_score
    from .site_signals.canonical_signals import calculate_canonical_score
    from .site_signals.jsonld_signals import calculate_jsonld_score
    from .llm_signals.evaluator import calculate_llm_signals_score
    
    all_scores = []
    
    # Domain signals scoring - always process since DomainSignals always includes these signals
    print(f"DEBUG: signals.domain_signals keys: {dir(signals.domain_signals)}")
    print(f"DEBUG: llm_txt_signal exists: {hasattr(signals.domain_signals, 'llm_txt_signal')}")
    print(f"DEBUG: llm_txt_signal value: {getattr(signals.domain_signals, 'llm_txt_signal', 'NOT_FOUND')}")
    
    # LLM.txt signals - always process since DomainSignals always includes it (even if file doesn't exist)
    if hasattr(signals.domain_signals, 'llm_txt_signal'):
        print("DEBUG: Processing LLM.txt signals...")
        llms_txt_scorecard = await calculate_llms_txt_score(signals.domain_signals.llm_txt_signal)
        print(f"DEBUG: LLM.txt scorecard: {llms_txt_scorecard.dict()}")
        all_scores.extend(llms_txt_scorecard.scores)
        print("DEBUG: LLM.txt scores added to all_scores")
    else:
        print("DEBUG: LLM.txt signal not found - skipping")
    
    # Robots.txt signals - always process since DomainSignals always includes it
    if hasattr(signals.domain_signals, 'robots_txt_signal'):
        robots_txt_scorecard = await calculate_robots_txt_score(signals.domain_signals.robots_txt_signal)
        all_scores.extend(robots_txt_scorecard.scores)
    
    # Sitemap signals - always process since DomainSignals always includes it
    if hasattr(signals.domain_signals, 'site_map_signal'):
        sitemap_scorecard = await calculate_sitemap_score(signals.domain_signals.site_map_signal)
        all_scores.extend(sitemap_scorecard.scores)
    
    # Site signals scoring - handle None cases
    if hasattr(signals, 'site_signals') and signals.site_signals:
        # Process each site signal (page)
        for site_signal in signals.site_signals.site_signals:
            if hasattr(site_signal, 'canonical_signal') and site_signal.canonical_signal:
                canonical_scorecard = await calculate_canonical_score(site_signal)
                all_scores.extend(canonical_scorecard.scores)
        
        # Process JSON-LD signals
        all_jsonld_signals = list(signals.site_signals.jsonld_signals)
        if all_jsonld_signals:
            jsonld_scorecard = await calculate_jsonld_score(all_jsonld_signals)
            all_scores.extend(jsonld_scorecard.scores)
    
    # LLM signals scoring - handle None cases
    if hasattr(signals, 'llm_signals') and signals.llm_signals:
        print("DEBUG: Processing LLM signals...")
        llm_signals_scorecard = await calculate_llm_signals_score(signals.llm_signals, brand)
        print(f"DEBUG: LLM signals scorecard: {llm_signals_scorecard.dict()}")
        all_scores.extend(llm_signals_scorecard.scores)
        print("DEBUG: LLM signals scores added to all_scores")
    else:
        print("DEBUG: LLM signals not found - skipping")
    
    # Create raw scorecard
    raw_scorecard = RawScoreCard(scores=all_scores)
    
    # Create pathwise scorecard
    path_scorecard = {}
    total_checks = 0
    total_positive_score = 0.0
    
    # Group scores by signal path
    for score in all_scores:
        path_key = " -> ".join(score.signal_path)
        
        if path_key not in path_scorecard:
            path_scorecard[path_key] = {
                'signal_path': score.signal_path,
                'scores': [],
                'total_checks': 0,
                'total_score': 0.0,
                'total_positive_score': 0.0,
                'total_percentage': 0.0
            }
        
        path_scorecard[path_key]['scores'].append(score)
        path_scorecard[path_key]['total_checks'] += 1
        path_scorecard[path_key]['total_score'] += score.value
        
        # Only count positive scores for total_positive_score
        if score.value > 0:
            path_scorecard[path_key]['total_positive_score'] += score.value
    
    # Calculate percentages for each path (not negative)
    for path_data in path_scorecard.values():
        if path_data['total_checks'] > 0:
            # Use positive score divided by total checks for percentage
            path_data['total_percentage'] = (path_data['total_positive_score'] / path_data['total_checks']) * 100
        
        total_checks += path_data['total_checks']
        total_positive_score += path_data['total_positive_score']
    
    # Calculate overall percentage (not negative)
    overall_percentage = (total_positive_score / total_checks) * 100 if total_checks > 0 else 0
    
    return ScoreCard(
        raw_scorecard=raw_scorecard,
        path_scorecard=path_scorecard,
        total_checks=total_checks,
        total_score=total_positive_score,
        total_percentage=overall_percentage
    )
