
import logging
from typing import Optional
from .robots_txt_signals import RobotsTxtSignals, find_robots_txt_signals
from .llms_txt_signals import LlmsTxtSignals, find_llm_txt_signals, LlmsTxtMeta, EnrichmentSignals
from .sitemap_signals import SiteMapSignals, find_sitemap_signals
from pydantic import BaseModel
import asyncio

logger = logging.getLogger(__name__)

class DomainSignals(BaseModel):
    robots_txt_signal: RobotsTxtSignals
    llms_txt_signal: LlmsTxtSignals
    site_map_signal: SiteMapSignals

async def find_domain_signals(full_domain: str, site_type: Optional[str] = None) -> DomainSignals:
    """
    Aggregate all domain-level signals for a given domain.
    
    Args:
        full_domain: The full domain URL (e.g., "https://www.example.com")
    
    Returns:
        DomainSignals: Combined signals from robots.txt, llm.txt, and sitemap
    """
    
    logger.info(f"Starting domain signals analysis for: {full_domain}")
    
    # First, fetch robots.txt and llm.txt signals in parallel
    logger.info("Fetching robots.txt and llm.txt signals in parallel...")
    robots_txt_task = find_robots_txt_signals(full_domain, site_type or "ecommerce")
    llms_txt_task = find_llm_txt_signals(full_domain)
    
    # Wait for robots.txt and llm.txt to complete
    logger.info("Waiting for robots.txt and llm.txt to complete...")
    robots_txt_signal, llms_txt_signal = await asyncio.gather(
        robots_txt_task,
        llms_txt_task,
        return_exceptions=True
    )
    
    # Handle exceptions for robots.txt and llm.txt
    if isinstance(robots_txt_signal, Exception):
        logger.error(f"Error fetching robots.txt: {robots_txt_signal}")
        robots_txt_signal = RobotsTxtSignals(
            robots={"exists": False, "status": None},
            sitemaps={"exists": False, "urls": []},
            ai_crawlers=None,
            search_crawlers=None,
            status=False,
            issue_found="robots.txt file is inaccessible",
            cause_of_issue="Failed to fetch robots.txt due to internal server error, retry after some time"
        )
    else:
        logger.info("Robots.txt signals fetched successfully")
    
    if isinstance(llms_txt_signal, Exception):
        logger.error(f"Error fetching llm.txt: {llms_txt_signal}")
        llms_txt_signal = LlmsTxtSignals(
            llm_txts=LlmsTxtMeta(
                exists=False,
                is_valid=False,
                enriched=EnrichmentSignals(),
                status=None
            ),
            status=False,
            issue_found="llms.txt file is inaccessible",
            cause_of_issue="Failed to fetch llms.txt due to internal server error, retry after some time"
        )
    else:
        logger.info("LLM.txt signals fetched successfully")
    
    # Debug: Check the llms_txt_signal structure
    logger.info(f"DEBUG: llms_txt_signal type: {type(llms_txt_signal)}")
    logger.info(f"DEBUG: llms_txt_signal dict: {llms_txt_signal.dict() if hasattr(llms_txt_signal, 'dict') else 'NO_DICT_METHOD'}")
    logger.info(f"DEBUG: hasattr(llms_txt_signal, 'llm_txts'): {hasattr(llms_txt_signal, 'llm_txts')}")
    if hasattr(llms_txt_signal, 'llm_txts'):
        logger.info(f"DEBUG: llms_txts value: {llms_txt_signal.llm_txts}")
    
    # Extract sitemap URL from robots.txt signal
    sitemap_url = None
    if (robots_txt_signal.sitemaps.exists and 
        robots_txt_signal.sitemaps.urls):
        sitemap_url = robots_txt_signal.sitemaps.urls[0]  # Use first sitemap URL
        logger.info(f"Found sitemap URL from robots.txt: {sitemap_url}")
    else:
        logger.info("No sitemap URL found in robots.txt")
    
    # Now fetch sitemap signals using the URL from robots.txt
    logger.info("Fetching sitemap signals...")
    sitemap_task = find_sitemap_signals(full_domain, sitemap_url)
    sitemap_signal = await sitemap_task
    
    # Handle exception for sitemap
    if isinstance(sitemap_signal, Exception):
        logger.error(f"Error fetching sitemap: {sitemap_signal}")
        sitemap_signal = SiteMapSignals(
            sitemap={"exists": False, "status": None, "url": None},
            last_updated=None
        )
    else:
        logger.info(f"Sitemap signals fetched successfully")
    
    logger.info("Domain signals analysis completed")
    return DomainSignals(
        robots_txt_signal=robots_txt_signal,
        llms_txt_signal=llms_txt_signal,
        site_map_signal=sitemap_signal
    )
