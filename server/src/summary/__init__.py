
from pydantic import BaseModel

from .signals import Signals
from ..scorecard import ScoreCard

class Summary(BaseModel):
    performance_highlights: list[str]
    improvement_areas: list[str]



def generate_summary(scorecard: ScoreCard) -> Summary:
    path_evaluations = scorecard.path_scorecard
    for path, data in path_evaluations.items():
        