
from pydantic import BaseModel
import json
import os

from ..scorecard import ScoreCard

class Summary(BaseModel):
    performance_highlights: list[str]
    improvement_areas: list[str]


def generate_summary(scorecard: ScoreCard) -> Summary:
    # Load summary messages from JSON file
    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(script_dir, 'summary_messages.json')
    
    with open(json_path, 'r') as f:
        summary_messages = json.load(f)
    
    performance_highlights = []
    improvement_areas = []
    
    path_evaluations = scorecard.path_scorecard
    
    for path, data in path_evaluations.items():
        percentage = data.get('total_percentage', 0)
        
        # Performance highlights (70% and above)
        if percentage >= 90:
            messages = summary_messages['performance_highlights']['90']
            if path in messages:
                performance_highlights.append(messages[path].format(percentage=round(percentage, 1)))
        elif percentage >= 80:
            messages = summary_messages['performance_highlights']['80']
            if path in messages:
                performance_highlights.append(messages[path].format(percentage=round(percentage, 1)))
        elif percentage >= 70:
            messages = summary_messages['performance_highlights']['70']
            if path in messages:
                performance_highlights.append(messages[path].format(percentage=round(percentage, 1)))
        
        # Improvement areas (below 70%)
        elif percentage >= 50:
            messages = summary_messages['improvement_areas']['50']
            if path in messages:
                improvement_areas.append(messages[path].format(percentage=round(percentage, 1)))
        elif percentage >= 30:
            messages = summary_messages['improvement_areas']['30']
            if path in messages:
                improvement_areas.append(messages[path].format(percentage=round(percentage, 1)))
        else:
            messages = summary_messages['improvement_areas']['0']
            if path in messages:
                improvement_areas.append(messages[path].format(percentage=round(percentage, 1)))
    
    return Summary(
        performance_highlights=performance_highlights,
        improvement_areas=improvement_areas
    )
        