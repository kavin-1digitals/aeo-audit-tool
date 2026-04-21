from pydantic import BaseModel
from typing import Optional, List, Dict
from src.signals import Signals
from src.scorecard.category_score import calculate_category_scores, CategoryScoringResult


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

    # ✅ NEW (Injected Category Metrics)
    category_scores: Optional[Dict] = None
    total_weighted_score: Optional[float] = None
    max_possible_score: Optional[float] = None
    percentage: Optional[float] = None


class Problem(BaseModel):
    signal_names: List[str]
    signal_path: List[str]
    issue_found: str
    cause_of_issue: str


class ProblemCard(BaseModel):
    problems: List[Problem]


async def create_aeo_scorecard(signals: Signals, brand: str = None, site_types: Optional[List[str]] = None):

    from .domain_signals.llms_txt_signals import calculate_llms_txt_score
    from .domain_signals.robots_txt_signals import calculate_robots_txt_score
    from .domain_signals.sitemap_signals import calculate_sitemap_score
    from .site_signals.canonical_signals import calculate_canonical_score
    from .site_signals.jsonld_signals import calculate_jsonld_score
    from .llm_signals.evaluator import calculate_llm_signals_score

    all_scores, all_problems = [], []

    # -----------------------------
    # DOMAIN SIGNALS
    # -----------------------------
    if hasattr(signals.domain_signals, 'llms_txt_signal'):
        llms_txt_scorecard, llms_txt_problem_card = await calculate_llms_txt_score(
            signals.domain_signals.llms_txt_signal
        )
        all_scores.extend(llms_txt_scorecard.scores)
        all_problems.extend(llms_txt_problem_card.problems)

    if hasattr(signals.domain_signals, 'robots_txt_signal'):
        robots_txt_scorecard, robots_txt_problem_card = await calculate_robots_txt_score(
            signals.domain_signals.robots_txt_signal
        )
        all_scores.extend(robots_txt_scorecard.scores)
        all_problems.extend(robots_txt_problem_card.problems)

    if hasattr(signals.domain_signals, 'site_map_signal'):
        sitemap_scorecard = await calculate_sitemap_score(
            signals.domain_signals.site_map_signal
        )
        all_scores.extend(sitemap_scorecard.scores)

    # -----------------------------
    # SITE SIGNALS
    # -----------------------------
    if hasattr(signals, 'site_signals') and signals.site_signals:

        if getattr(signals.site_signals, 'is_scrapable', False):

            all_scores.append(Score(
                value=1.0,
                signal_name='site_scrapable',
                signal_path=['Site Signals', 'Scrapability'],
                success_state='Website is scrapable'
            ))

            for site_signal in signals.site_signals.site_signals:
                if getattr(site_signal, 'canonical_signal', None):
                    canonical_scorecard = await calculate_canonical_score(site_signal)
                    all_scores.extend(canonical_scorecard.scores)

            jsonld_signals = list(signals.site_signals.jsonld_signals)
            if jsonld_signals:
                jsonld_scorecard = await calculate_jsonld_score(jsonld_signals, site_types)
                all_scores.extend(jsonld_scorecard.scores)

        else:
            all_scores.append(
                Score(
                    value=-1.0,
                    signal_name='site_scrapable',
                    signal_path=['Site Signals', 'Scrapability'],
                    remediation_plan="Site not scrapable"
                ),
                
                # Score(
                #     value=-1.0,
                #     signal_name='site_scrapable',
                #     signal_path=['Site Signals', 'Scrapability'],
                #     remediation_plan="Site not scrapable"
                # ),
            )
            all_problems.append(
                Problem(
                    signal_names=["canonical_exists", "canonical_matches", "canonical_clean", "jsonld_exists", "jsonld_valid"],
                    signal_path=['Site Signals', 'Scrapability'],
                    issue_found=signals.site_signals.issue_found,
                    cause_of_issue=signals.site_signals.cause_of_issue,
                )
            )

    # -----------------------------
    # LLM SIGNALS
    # -----------------------------
    if hasattr(signals, 'llm_signals') and signals.llm_signals:
        llm_scorecard, llm_problem_card = await calculate_llm_signals_score(
            signals.llm_signals,
            brand
        )
        all_scores.extend(llm_scorecard.scores)
        all_problems.extend(llm_problem_card.problems)

    # -----------------------------
    # RAW SCORECARD
    # -----------------------------
    raw_scorecard = RawScoreCard(scores=all_scores)

    # -----------------------------
    # CATEGORY SCORING (🔥 FIX)
    # -----------------------------
    

    category_result: CategoryScoringResult = calculate_category_scores(
        raw_scorecard,
        brand
    )

    # -----------------------------
    # PATH SCORECARD
    # -----------------------------
    path_scorecard = {}
    total_checks = 0
    total_positive_score = 0.0

    for score in all_scores:
        path_key = " -> ".join(score.signal_path)

        if path_key not in path_scorecard:
            path_scorecard[path_key] = {
                'signal_path': score.signal_path,
                'scores': [],
                'total_checks': 0,
                'total_positive_score': 0.0,
                'total_percentage': 0.0
            }

        path_scorecard[path_key]['scores'].append(score)
        path_scorecard[path_key]['total_checks'] += 1

        if score.value > 0:
            path_scorecard[path_key]['total_positive_score'] += score.value

    for path_data in path_scorecard.values():
        if path_data['total_checks'] > 0:
            path_data['total_percentage'] = (
                path_data['total_positive_score'] / path_data['total_checks']
            ) * 100

        total_checks += path_data['total_checks']
        total_positive_score += path_data['total_positive_score']

    overall_percentage = (
        (total_positive_score / total_checks) * 100
        if total_checks > 0 else 0
    )

    # -----------------------------
    # FINAL RETURN (🔥 INJECTED)
    # -----------------------------
    return ScoreCard(
        raw_scorecard=raw_scorecard,
        path_scorecard=path_scorecard,
        total_checks=total_checks,
        total_score=total_positive_score,
        total_percentage=overall_percentage,

        # ✅ Injected category metrics
        category_scores=category_result.category_scores,
        total_weighted_score=category_result.total_weighted_score,
        max_possible_score=category_result.max_possible_weighted_score,
        percentage=category_result.percentage_influence
    ), ProblemCard(problems=all_problems)