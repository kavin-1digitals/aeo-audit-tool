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

class Problem(BaseModel):
    signal_names: List[str]
    signal_path: List[str]
    issue_found: str
    cause_of_issue: str

class ProblemCard(BaseModel):
    problems: List[Problem]


async def create_aeo_scorecard(signals: Signals, brand: str = None, site_type: str = None) -> ScoreCard:
    from .domain_signals.llms_txt_signals import calculate_llms_txt_score
    from .domain_signals.robots_txt_signals import calculate_robots_txt_score
    from .domain_signals.sitemap_signals import calculate_sitemap_score
    from .site_signals.canonical_signals import calculate_canonical_score
    from .site_signals.jsonld_signals import calculate_jsonld_score
    from .llm_signals.evaluator import calculate_llm_signals_score
    
    all_scores, all_problems = [], []
    
    # Domain signals scoring - always process since DomainSignals always includes these signals
    print(f"DEBUG: signals.domain_signals keys: {dir(signals.domain_signals)}")
    print(f"DEBUG: llms_txt_signal exists: {hasattr(signals.domain_signals, 'llms_txt_signal')}")
    print(f"DEBUG: llms_txt_signal value: {getattr(signals.domain_signals, 'llms_txt_signal', 'NOT_FOUND')}")
    
    # LLM.txt signals - always process since DomainSignals always includes it (even if file doesn't exist)
    if hasattr(signals.domain_signals, 'llms_txt_signal'):
        print("DEBUG: Processing LLM.txt signals...")
        llms_txt_scorecard, llms_txt_problem_card = await calculate_llms_txt_score(signals.domain_signals.llms_txt_signal)
        print(f"DEBUG: LLM.txt scorecard: {llms_txt_scorecard.dict()}")
        all_scores.extend(llms_txt_scorecard.scores)
        all_problems.extend(llms_txt_problem_card.problems)
        print("DEBUG: LLM.txt scores and problems added to all_scores and all_problems")
    else:
        print("DEBUG: LLM.txt signal not found - skipping")
    
    # Robots.txt signals - always process since DomainSignals always includes it
    if hasattr(signals.domain_signals, 'robots_txt_signal'):
        robots_txt_scorecard, robots_txt_problem_card = await calculate_robots_txt_score(signals.domain_signals.robots_txt_signal)
        all_scores.extend(robots_txt_scorecard.scores)
        all_problems.extend(robots_txt_problem_card.problems)
    
    # Sitemap signals - always process since DomainSignals always includes it
    if hasattr(signals.domain_signals, 'site_map_signal'):
        sitemap_scorecard = await calculate_sitemap_score(signals.domain_signals.site_map_signal)
        all_scores.extend(sitemap_scorecard.scores)
    
    # Site signals scoring - handle None cases and is_scrapable check
    if hasattr(signals, 'site_signals') and signals.site_signals:
        # Check if site is scrapable first
        if hasattr(signals.site_signals, 'is_scrapable') and signals.site_signals.is_scrapable:
            # Site is scrapable - give +1 score and process signals
            all_scores.append(Score(
                value=1.0, 
                signal_name='site_scrapable', 
                signal_path=['Site Signals', 'Scrapability'], 
                remediation_plan=None, 
                success_state='Website is successfully scrapable and accessible for content analysis.'
            ))
            
            # Process each site signal (page)
            for site_signal in signals.site_signals.site_signals:
                if hasattr(site_signal, 'canonical_signal') and site_signal.canonical_signal:
                    canonical_scorecard = await calculate_canonical_score(site_signal)
                    all_scores.extend(canonical_scorecard.scores)
            
            # Process JSON-LD signals
            all_jsonld_signals = list(signals.site_signals.jsonld_signals)
            if all_jsonld_signals:
                jsonld_scorecard = await calculate_jsonld_score(all_jsonld_signals, site_type)
                all_scores.extend(jsonld_scorecard.scores)
                
        else:
            # Site is not scrapable - give -1 score and skip processing
            all_scores.append(Score(
                value=-1.0, 
                signal_name='site_scrapable', 
                signal_path=['Site Signals', 'Scrapability'], 
                remediation_plan='Website could not be scraped properly. Check for: 1) Server blocking/access issues, 2) JavaScript rendering problems, 3) Rate limiting, 4) Invalid HTML structure. Consider implementing server-side rendering or fixing accessibility issues.', 
                success_state=None
            ))

            affected_site_signals = ['canonical_exists', 'canonical_matches', 'canonical_clean','jsonld_exists',  'jsonld_valid']

            if hasattr(signals.site_signals, 'is_scrapable') and signals.site_signals.issue_found is not None:
                all_problems.append(Problem(
                    signal_names=affected_site_signals,
                    signal_path=['Site Signals', 'Scrapability'],
                    issue_found = signals.site_signals.issue_found,
                    cause_of_issue = signals.site_signals.cause_of_issue
                ))
            else:
                all_problems.append(Problem(
                    signal_names=affected_site_signals,
                    signal_path=['Site Signals', 'Scrapability'],
                    issue_found = "Site is not scrapable",
                    cause_of_issue = "Failed due to server blocking/access issues, JavaScript rendering problems, rate limiting, or invalid HTML structure"
                ))
    
    # LLM signals scoring - handle None cases
    
    if hasattr(signals, 'llm_signals') and signals.llm_signals:
        print("DEBUG: Processing LLM signals...")
        llm_signals_scorecard, llm_signals_problem_card = await calculate_llm_signals_score(signals.llm_signals, brand)
        print(f"DEBUG: LLM signals scorecard: {llm_signals_scorecard.dict()}")
        all_scores.extend(llm_signals_scorecard.scores)
        print(f"DEBUG: LLM signals problem card: {llm_signals_problem_card.dict()}")
        all_problems.extend(llm_signals_problem_card.problems)
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
    ), ProblemCard(problems=all_problems)

