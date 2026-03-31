from pydantic import BaseModel
from typing import List, Dict, Any
import json
import os

# Load configuration
def load_config():
    config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'quick_remediations_config.json')
    try:
        with open(config_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading quick_remediations config: {e}")
        return {}

class RemediationPlan(BaseModel):
    category: str  # "Quick Fix", "Secondary Fix", "Complete Fix"
    title: str
    description: str
    difficulty: str  # "Easy", "Medium", "Hard"
    impact_level: str  # "High", "Medium", "Low"
    signals_count: int
    signal_names: List[str]
    current_score: float
    target_score: float
    improvement_percentage: float

class QuickRemediations(BaseModel):
    current_overall_score: float
    plans: List[RemediationPlan]

def analyze_quick_remediations(scorecard_data: Dict[str, Any]) -> QuickRemediations:
    """Analyze scorecard data and create prioritized remediation plans"""
    
    current_score = scorecard_data.get('total_percentage', 0)
    raw_scorecard = scorecard_data.get('raw_scorecard', {})
    all_scores = raw_scorecard.get('scores', [])
    
    # 1. Group signals by name to ensure no duplicates across groups
    signal_groups = {}
    for score in all_scores:
        if score.get('value', 0) < 1.0:
            name = score.get('signal_name', 'Unknown')
            if name not in signal_groups:
                signal_groups[name] = []
            signal_groups[name].append(score)
    
    if not signal_groups:
        return QuickRemediations(current_overall_score=current_score, plans=[])
        
    # 2. Form grouped items with their difficulty
    grouped_items = []
    for name, instances in signal_groups.items():
        # All instances of the same name are assumed to have similar difficulty
        difficulty = assess_difficulty_for_single_signal(instances[0])
        grouped_items.append({
            'name': name,
            'difficulty': difficulty,
            'instances': instances,
            'total_count': len(instances)
        })
        
    # 3. Sort grouped types by difficulty
    sorted_groups = sorted(grouped_items, key=lambda g: (
        g['difficulty'] != "Easy",
        g['difficulty'] == "Hard"
    ))
    
    total_group_types = len(sorted_groups)
    final_plans = []
    config = load_config()
    
    # 4. Determine tiered strategy based on the number of unique signal types
    initial_positive = scorecard_data.get('total_score', 0)
    total_checks = scorecard_data.get('total_checks', 0)
    
    def calculate_improvement_delta(signals):
        """Points added to total_positive_score by fixing these signals"""
        return sum(1.0 - max(0, s.get('value', 0)) for s in signals if isinstance(s, dict))
    
    def get_all_instances(items):
        res = []
        for item in items:
            res.extend(item['instances'])
        return res

    def get_target_percentage(current_pos):
        if total_checks == 0: return current_score
        pct = (current_pos / total_checks) * 100
        config = load_config()
        max_score = config.get('target_scores', {}).get('maximum', 98.0)
        return min(max_score, pct)

    final_plans = []
    
    if total_group_types < 3:
        # Case A: Minimal failing types (< 3) - Only one comprehensive 'Complete Fix' plan
        all_instances = get_all_instances(sorted_groups)
        delta = calculate_improvement_delta(all_instances)
        target = get_target_percentage(initial_positive + delta)
        
        final_plans.append(RemediationPlan(
            category="Complete Fix",
            title="Comprehensive Optimization",
            description=config.get('category_priorities', {}).get('Complete Fix', {}).get('description', '').format(signals_count=len(all_instances)),
            difficulty="Medium",
            impact_level="High",
            signals_count=len(all_instances),
            signal_names=[g['name'] for g in sorted_groups],
            current_score=current_score,
            target_score=target,
            improvement_percentage=max(0, target - current_score)
        ))
    elif total_group_types < 5:
        # Case B: Low number of failing types (< 5) - Two plans: 'Quick Fix' and 'Complete Fix'
        quick_idx = 1 if total_group_types == 3 else 2
        quick_items = sorted_groups[:quick_idx]
        complete_items = sorted_groups[quick_idx:]
        
        # 1. Quick Fix
        q_instances = get_all_instances(quick_items)
        q_delta = calculate_improvement_delta(q_instances)
        quick_target = get_target_percentage(initial_positive + q_delta)
        final_plans.append(RemediationPlan(
            category="Quick Fix",
            title="Quick Win: Essential Fixes",
            description=config.get('category_priorities', {}).get('Quick Fix', {}).get('description', '').format(signals_count=len(q_instances)),
            difficulty="Easy",
            impact_level="High",
            signals_count=len(q_instances),
            signal_names=[g['name'] for g in quick_items],
            current_score=current_score,
            target_score=quick_target,
            improvement_percentage=max(0, quick_target - current_score)
        ))
        
        # 2. Complete Fix
        c_instances = get_all_instances(complete_items)
        c_delta = calculate_improvement_delta(c_instances)
        # Target for Complete includes Quick improvements
        complete_target = get_target_percentage(initial_positive + q_delta + c_delta)
        final_plans.append(RemediationPlan(
            category="Complete Fix",
            title="Comprehensive Optimization",
            description=config.get('category_priorities', {}).get('Complete Fix', {}).get('description', '').format(signals_count=len(c_instances)),
            difficulty="Hard",
            impact_level="Complete",
            signals_count=len(c_instances),
            signal_names=[g['name'] for g in complete_items],
            current_score=quick_target,
            target_score=complete_target,
            improvement_percentage=max(0, complete_target - quick_target)
        ))
    else:
        # Case C: Full three-tier strategy (>= 5 unique signal types)
        quick_count = max(1, total_group_types // 3)
        secondary_count = max(1, (total_group_types - quick_count) // 2)
        
        quick_items = sorted_groups[:quick_count]
        secondary_items = sorted_groups[quick_count:quick_count + secondary_count]
        complete_items = sorted_groups[quick_count + secondary_count:]
        
        # 1. Quick Fix
        q_instances = get_all_instances(quick_items)
        q_delta = calculate_improvement_delta(q_instances)
        q_target = get_target_percentage(initial_positive + q_delta)
        final_plans.append(RemediationPlan(
            category="Quick Fix",
            title="Quick Win: Essential Fixes",
            description=config.get('category_priorities', {}).get('Quick Fix', {}).get('description', '').format(signals_count=len(q_instances)),
            difficulty="Easy",
            impact_level="High",
            signals_count=len(q_instances),
            signal_names=[g['name'] for g in quick_items],
            current_score=current_score,
            target_score=q_target,
            improvement_percentage=max(0, q_target - current_score)
        ))
        
        # 2. Secondary Fix
        s_instances = get_all_instances(secondary_items)
        s_delta = calculate_improvement_delta(s_instances)
        s_target = get_target_percentage(initial_positive + q_delta + s_delta)
        final_plans.append(RemediationPlan(
            category="Secondary Fix",
            title="Strategic: Priority Improvements",
            description=config.get('category_priorities', {}).get('Secondary Fix', {}).get('description', '').format(signals_count=len(s_instances)),
            difficulty="Medium",
            impact_level="Medium",
            signals_count=len(s_instances),
            signal_names=[g['name'] for g in secondary_items],
            current_score=q_target,
            target_score=s_target,
            improvement_percentage=max(0, s_target - q_target)
        ))
        
        # 3. Complete Fix
        c_instances = get_all_instances(complete_items)
        c_delta = calculate_improvement_delta(c_instances)
        c_target = get_target_percentage(initial_positive + q_delta + s_delta + c_delta)
        final_plans.append(RemediationPlan(
            category="Complete Fix",
            title="Comprehensive Optimization",
            description=config.get('category_priorities', {}).get('Complete Fix', {}).get('description', '').format(signals_count=len(c_instances)),
            difficulty="Hard",
            impact_level="Complete",
            signals_count=len(c_instances),
            signal_names=[g['name'] for g in complete_items],
            current_score=s_target,
            target_score=c_target,
            improvement_percentage=max(0, c_target - s_target)
        ))

    return QuickRemediations(
        current_overall_score=current_score,
        plans=final_plans
    )

def analyze_failing_signals(all_scores: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """Group failing signals by category dynamically. Includes all failing instances."""
    
    categories = {}
    
    for score in all_scores:
        # A signal is "failing" if it has value <= 0 or is not fully optimized (< 1.0)
        # Note: We NO LONGER filter by unique signal_name here to ensure all instances are counted for the score.
        if score.get('value', 0) < 1.0:
            signal_path = score.get('signal_path', [])
            category = signal_path[0] if signal_path else 'General Signals'
            
            if category not in categories:
                categories[category] = []
            
            categories[category].append(score)
    
    return categories

def create_category_plan(category_name: str, failing_signals: List[Dict[str, Any]], current_score: float, scorecard_data: Dict[str, Any]) -> Dict:
    """Create remediation plan for a specific category"""
    
    if not failing_signals:
        return None
    
    target_score = calculate_target_score(scorecard_data, failing_signals)
    improvement = target_score - current_score
    
    difficulty = assess_difficulty(category_name, failing_signals)
    impact_level = assess_impact(category_name, failing_signals, improvement)
    
    return {
        'category_name': category_name,
        'title': f"{category_name} Optimization",
        'signals': failing_signals,
        'signals_count': len(failing_signals),
        'target_score': target_score,
        'improvement_percentage': improvement,
        'difficulty': difficulty,
        'impact_level': impact_level,
        'signal_names': [s.get('signal_name', '') for s in failing_signals]
    }

def assess_difficulty_for_single_signal(signal: Dict[str, Any]) -> str:
    """Assess difficulty for a single signal based on its category"""
    signal_path = signal.get('signal_path', [])
    category = signal_path[0] if signal_path else 'Other'
    
    config = load_config()
    difficulty_rules = config.get('difficulty_rules', {})
    
    if category in difficulty_rules:
        return difficulty_rules[category].get('default', 'Medium')
    return "Medium"

def assess_difficulty(category_name: str, failing_signals: List[Dict[str, Any]]) -> str:
    """Assess difficulty based on signal types and configuration"""
    
    config = load_config()
    difficulty_rules = config.get('difficulty_rules', {})
    
    if category_name in difficulty_rules:
        category_rules = difficulty_rules[category_name]
        signal_count = len(failing_signals)
        
        if 'threshold' in category_rules:
            threshold = category_rules['threshold']
            if 'hard' in threshold and signal_count >= threshold['hard']:
                return "Hard"
            elif 'medium' in threshold and signal_count >= threshold['medium']:
                return "Medium"
        
        return category_rules.get('default', 'Medium')
    
    return "Medium"

def assess_impact(category_name: str, failing_signals: List[Dict[str, Any]], improvement: float) -> str:
    """Assess impact based on signal count and improvement percentage using configuration"""
    
    config = load_config()
    impact_rules = config.get('impact_rules', {})
    high_threshold = impact_rules.get('high_threshold', {})
    medium_threshold = impact_rules.get('medium_threshold', {})
    
    signal_count = len(failing_signals)
    
    if (improvement >= high_threshold.get('improvement_percentage', 15) or 
        signal_count >= high_threshold.get('signals_count', 3)):
        return "High"
    elif (improvement >= medium_threshold.get('improvement_percentage', 8) or 
          signal_count >= medium_threshold.get('signals_count', 2)):
        return "Medium"
    else:
        return "Low"

def calculate_target_score(scorecard_data: Dict[str, Any], failing_signals: List[Dict[str, Any]]) -> float:
    """Calculate what the score would be if these signals are fixed. 
    Accepts scorecard_data and a list of signal objects."""
    
    if not isinstance(scorecard_data, dict):
        return 0.0
        
    current_positive = scorecard_data.get('total_score', 0)
    total_checks = scorecard_data.get('total_checks', 0)
    
    if total_checks == 0:
        return 0.0
    
    # Calculate improvement for each failing signal
    additional_positive = 0
    for failing_signal in failing_signals:
        if isinstance(failing_signal, dict):
            current_value = failing_signal.get('value', 0)
            # In scorecard.py, only values > 0 contribute to total_positive_score.
            # So improvement is 1.0 minus what it currently contributes (0 if negative/zero).
            improvement = 1.0 - max(0, current_value)
            additional_positive += improvement
    
    new_positive = current_positive + additional_positive
    new_percentage = (new_positive / total_checks) * 100
    
    # Cap at target score maximum from config
    config = load_config()
    max_score = config.get('target_scores', {}).get('maximum', 98.0)
    
    return min(max_score, new_percentage)

def calculate_final_target(current_score: float, remaining_signals: List[str], scorecard_data: Dict[str, Any]) -> float:
    """Legacy helper, now uses updated calculate_target_score logic"""
    all_scores = scorecard_data.get('raw_scorecard', {}).get('scores', [])
    remaining_signal_objects = []
    
    for signal_name in remaining_signals:
        for score in all_scores:
            if score.get('signal_name') == signal_name and score.get('value', 0) <= 0:
                remaining_signal_objects.append(score)
                break
    
    if remaining_signal_objects:
        return calculate_target_score(scorecard_data, remaining_signal_objects)
    return current_score

def prioritize_plans(plans: List[Dict]) -> List[Dict]:
    """Prioritize plans by impact and difficulty"""
    return sorted(
        plans,
        key=lambda p: (
            p.get('impact_level') != 'High',
            p.get('difficulty') != 'Easy',
            -p.get('signals_count', 0)
        )
    )
