import json
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Load configuration from JSON file
config_path = os.path.join(os.path.dirname(__file__), 'config.json')

with open(config_path, 'r') as f:
    config = json.load(f)

AI_CRAWLERS = config['ai_crawlers']
SEARCH_CRAWLERS = config['search_crawlers']
CRITICAL_PATTERNS = config['critical_patterns']
SITEMAP_PATTERNS = config['sitemap_patterns']
JSONLD_CATEGORIES = config['jsonld_categories']
JSONLD_VALIDATION_RULES = config['jsonld_validation_rules']

LLM_PROVIDERS = config['llm']
SCORING_WEIGHTS = config['scoring_weights']

# Convert scoring weights from strings to floats for calculations
def convert_weights_to_floats(weights_dict):
    """Recursively convert all weight values from strings to floats"""
    if isinstance(weights_dict, dict):
        return {k: convert_weights_to_floats(v) for k, v in weights_dict.items()}
    elif isinstance(weights_dict, (str, int)):
        return float(weights_dict)
    else:
        return weights_dict

# Apply conversion to scoring weights
SCORING_WEIGHTS = convert_weights_to_floats(SCORING_WEIGHTS)

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
SCRAPERAPI_API_KEY = os.getenv('SCRAPERAPI_API_KEY')