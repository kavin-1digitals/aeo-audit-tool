from src.quick_remediations import analyze_quick_remediations


def generate_quick_remediations(scorecard_data):
    """Generate quick remediations for a scorecard"""
    try:
        # Handle both dict and object cases
        if hasattr(scorecard_data, 'model_dump'):
            data = scorecard_data.model_dump()
        elif hasattr(scorecard_data, 'dict'):
            data = scorecard_data.dict()
        else:
            data = scorecard_data
            
        return analyze_quick_remediations(data)
    except Exception as e:
        print(f"Error generating quick remediations: {e}")
        return None
