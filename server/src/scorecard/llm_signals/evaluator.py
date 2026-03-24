from pydantic import BaseModel, computed_field
from src.signals.llm_signals import LlmSignals
from src.scorecard import Score, RawScoreCard
from src.config import NUM_PROMPTS
from typing import Optional, List

async def calculate_llm_signals_score(llm_signals: LlmSignals, target_brand: str = None):
    """Calculate LLM signals score based on individual prompt and cluster checks"""
    
    evaluation_results = llm_signals.evaluation_results
    brand_counts = evaluation_results['brand_counts']
    sov = evaluation_results['sov']
    cluster_summary = evaluation_results['cluster_summary']
    total_mentions = evaluation_results['total_mentions']
    prompt_responses = evaluation_results.get('prompt_responses', [])  # Individual prompt responses
    
    # Use the provided target_brand or fall back to the first brand in counts
    if target_brand:
        # Use the provided target brand
        actual_target_brand = target_brand
    else:
        # Extract brand name from the first competitor or use a default (fallback)
        all_brands = list(brand_counts.keys())
        actual_target_brand = all_brands[0] if all_brands else "Unknown"
    
    scores = []
    
    # Rule 1: Individual Brand Citation Checks (one per prompt)
    brand_mentions = brand_counts.get(actual_target_brand, 0)
    citation_rate = brand_mentions / NUM_PROMPTS  # mentions per prompt
    
    # Create individual scores for each prompt
    for prompt_index in range(NUM_PROMPTS):
        # Get the actual prompt response if available
        prompt_response = prompt_responses[prompt_index] if prompt_index < len(prompt_responses) else {}
        prompt_text = prompt_response.get('prompt', '')
        response_text = prompt_response.get('response', '')
        brand_mentioned = prompt_index < brand_mentions  # Simplified logic
        
        # Create informative prompt description
        if prompt_text:
            prompt_description = f'"{prompt_text}"'
        else:
            # Provide more descriptive fallback based on common prompt types
            prompt_types = [
                "brand discovery query (best/top brands)",
                "brand recommendation query (which brands to buy/choose)", 
                "brand comparison query (which brands are better/alternatives)",
                "pricing & value query (affordable/value for money brands)",
                "quality & durability query (brands known for quality)",
                "style & trends query (brands leading in style/trends)",
                "fit & sizing query (brands known for fit/sizing)"
            ]
            prompt_type = prompt_types[prompt_index % len(prompt_types)]
            prompt_description = f'{prompt_type} #{prompt_index + 1}'
        
        if brand_mentioned:
            scores.append(Score(
                value=1.0, 
                signal_name='brand_citation', 
                signal_path=['LLM Brand Analysis', 'Brand Citations'], 
                remediation_plan=None, 
                success_state=f'Brand "{actual_target_brand}" successfully mentioned in response to: {prompt_description}'
            ))
        else:
            # Create informative response description
            if response_text:
                response_description = f'Current response: "{response_text}"'
            else:
                response_description = 'Brand was not mentioned in the generated response'
                
            scores.append(Score(
                value=-1.0, 
                signal_name='brand_citation', 
                signal_path=['LLM Brand Analysis', 'Brand Citations'], 
                remediation_plan=f'Improve brand visibility for {prompt_description}. {response_description} does not mention "{actual_target_brand}". Consider creating content that addresses this specific query type and naturally incorporates your brand.', 
                success_state=None
            ))
    
    # Rule 2: Individual Cluster Coverage Checks
    cluster_names = list(cluster_summary.keys())
    for cluster_name in cluster_names:
        cluster_data = cluster_summary[cluster_name]
        brand_present = cluster_data.get('brand_present', False)
        cluster_keywords = cluster_data.get('keywords', [])
        sample_queries = cluster_data.get('sample_queries', [])
        
        # Create informative cluster description
        keywords_str = ", ".join(cluster_keywords[:4]) if cluster_keywords else "various keywords"
        queries_str = "; ".join(sample_queries[:2]) if sample_queries else "related queries"
        
        if brand_present:
            scores.append(Score(
                value=1.0, 
                signal_name='cluster_coverage', 
                signal_path=['LLM Brand Analysis', 'Cluster Coverage'], 
                remediation_plan=None, 
                success_state=f'Brand "{actual_target_brand}" successfully covered in "{cluster_name}" content cluster. Keywords: {keywords_str}. This ensures brand visibility for queries like: {queries_str}'
            ))
        else:
            scores.append(Score(
                value=-1.0, 
                signal_name='cluster_coverage', 
                signal_path=['LLM Brand Analysis', 'Cluster Coverage'], 
                remediation_plan=f'Create content targeting "{cluster_name}" cluster to improve coverage. Focus on keywords: {keywords_str}. Address sample queries like: {queries_str}. Develop blog posts, guides, or product pages that naturally incorporate "{actual_target_brand}" while addressing these specific topics to enhance brand visibility in this content area.', 
                success_state=None
            ))
    
    # Rule 3: Individual Competitive Gap Checks
    for cluster_name in cluster_names:
        cluster_data = cluster_summary[cluster_name]
        has_gap = cluster_data.get('gap', False)
        competitors_mentioned = cluster_data.get('competitors_mentioned', [])
        cluster_keywords = cluster_data.get('keywords', [])
        
        # Create informative competitor description
        competitors_str = ", ".join(competitors_mentioned[:4]) if competitors_mentioned else "competitors"
        keywords_str = ", ".join(cluster_keywords[:4]) if cluster_keywords else "relevant keywords"
        
        if has_gap:
            scores.append(Score(
                value=-1.0, 
                signal_name='competitive_gap', 
                signal_path=['LLM Brand Analysis', 'Competitive Gaps'], 
                remediation_plan=f'Address competitive gap in "{cluster_name}" cluster. Competitors {competitors_str} are being mentioned but "{actual_target_brand}" is missing. Create content specifically competing with these competitors on keywords: {keywords_str}. Analyze competitor content strategies and develop superior alternatives that highlight "{actual_target_brand}"\'s unique advantages to capture this market segment.', 
                success_state=None
            ))
        else:
            scores.append(Score(
                value=1.0, 
                signal_name='competitive_gap', 
                signal_path=['LLM Brand Analysis', 'Competitive Gaps'], 
                remediation_plan=None, 
                success_state=f'No competitive gap detected in "{cluster_name}" cluster. Brand "{actual_target_brand}" is successfully competing alongside {competitors_str} for keywords: {keywords_str}. This indicates strong competitive positioning in this content area.'
            ))
    
    return RawScoreCard(scores=scores)