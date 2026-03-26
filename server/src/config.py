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
SITEMAP_CATEGORY_PATTERNS = config['sitemap_category_patterns']
SITEMAP_CATEGORY_COUNTS = config['sitemap_category_counts']
JSONLD_CATEGORIES = config['jsonld_categories']
JSONLD_VALIDATION_RULES = config['jsonld_validation_rules']

LLM_PROVIDERS = config['llm']
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
NUM_PROMPTS = config['num_prompts']
NUM_COMPETITORS = config['num_competitors']
CITATION_PROMPT_CLUSTERS = config['citation_prompt_clusters']

