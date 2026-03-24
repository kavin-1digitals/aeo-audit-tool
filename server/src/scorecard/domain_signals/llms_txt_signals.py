from pydantic import BaseModel, computed_field
from src.signals.domain_signals.llms_txt_signals import LlmsTxtSignals
from src.scorecard import Score, RawScoreCard

from typing import Optional, List



async def calculate_llms_txt_score(llms_txt_signal: LlmsTxtSignals):
    llm_txts = llms_txt_signal.llm_txts
    
    if llm_txts.exists:
        return RawScoreCard(scores=[Score(value=1.0, signal_name='llm_txt_exists', signal_path=['Domain Signals', 'LLM.txt File'], remediation_plan=None, success_state='LLM-Sitemap.txt file successfully found and accessible. This file provides structured information about your website content to help AI models better understand and represent your brand in AI-powered search and responses.')])
    else:
        if llm_txts.status:
            return RawScoreCard(scores=[Score(value=0.0, signal_name='llm_txt_exists', signal_path=['Domain Signals', 'LLM.txt File'], remediation_plan='Create and upload an LLM-Sitemap.txt file to your website root directory. This file should contain structured information about your brand, products, services, and content to help AI models accurately represent your business in AI-powered search results and conversational AI responses.', success_state=None)])
        else:
            return RawScoreCard(scores=[Score(value=0.0, signal_name='llm_txt_exists', signal_path=['Domain Signals', 'LLM.txt File'], remediation_plan='LLM-Sitemap.txt file URL is not accessible or returning errors. Ensure the file exists at yourdomain.com/llm-sitemap.txt and check server configuration. This file is crucial for AI model understanding of your website content and brand representation.', success_state=None)])