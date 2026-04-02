from src.quick_remediations import analyze_quick_remediations


def generate_quick_remediations(scorecard_data):
    """Generate quick remediations for a scorecard"""
    try:
        weights = {
        'llm_signals': {
            'cluster_presence': 12,
            'cluster_dominance': 12,
            'prompt_citation': 16,
            'total_weight': 40
        },

        'domain_signals': {
            'llms_txt_exists': 4,
            'llms_txt_valid': 3,
            'llms_txt_enriched': 3,

            'robots_txt_exists': 3,

            'sitemap_exists': 3,
            'sitemap_type_valid': 3,
            'sitemap_freshness': 3,

            'ai_crawler_access': 4,
            'search_crawler_access': 4,

            'total_weight': 30
        },

        'site_signals': {
            'site_scrapable': 8,

            'canonical_exists': 5,
            'canonical_matches': 5,
            'canonical_clean': 4,

            'jsonld_exists': 4,
            'jsonld_valid': 4,

            'total_weight': 30
        }
    }
        # Handle both dict and object cases
        if hasattr(scorecard_data, 'model_dump'):
            data = scorecard_data.model_dump()
        elif hasattr(scorecard_data, 'dict'):
            data = scorecard_data.dict()
        else:
            data = scorecard_data
            
        return analyze_quick_remediations(data, weights)
    except Exception as e:
        print(f"Error generating quick remediations: {e}")
        return None
