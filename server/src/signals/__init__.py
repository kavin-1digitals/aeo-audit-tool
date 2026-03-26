"""
Signal processing utilities for AEO audit tool
"""

import logging
import asyncio
from typing import Optional
from .domain_signals import DomainSignals, find_domain_signals
from .site_signals import SiteSignals, find_site_signals
from .llm_signals import LlmSignals, find_llm_signals
from pydantic import BaseModel

logger = logging.getLogger(__name__)

class Signals(BaseModel):
    full_domain: str
    domain_signals: DomainSignals
    site_signals: SiteSignals
    llm_signals: Optional[LlmSignals] = None

async def find_signals(full_domain: str, brand: Optional[str] = None, industry: Optional[str] = None, geo: Optional[str] = "United States") -> Signals:
    """Find all signals for a domain"""
    logger.info(f"Starting signals analysis for domain: {full_domain}")
    
    # Phase 1: Get domain-level signals (robots.txt, llm.txt, sitemap)
    logger.info("Phase 1: Fetching domain-level signals (robots.txt, llm.txt, sitemap)")
    domain_signals_task = asyncio.create_task(find_domain_signals(full_domain))
    
    # Phase 2: Start site signals (depends on domain signals for sitemap)
    # We'll wait for domain signals first since site signals depends on sitemap
    domain_signals = await domain_signals_task
    logger.info(f"Domain signals completed. Sitemap exists: {domain_signals.site_map_signal.sitemap.exists}")
    
    # Phase 3: Start site signals and LLM signals in parallel (if brand provided)
    logger.info("Phase 2: Fetching site-level signals (scraping individual pages)")
    site_signals_task = asyncio.create_task(find_site_signals(domain_signals.site_map_signal))
    
    llm_signals_task = None
    if brand and industry:
        logger.info("Phase 3: Fetching LLM signals (brand visibility analysis)")
        llm_signals_task = asyncio.create_task(find_llm_signals(brand, geo))
    
    # Wait for site signals to complete
    site_signals = await site_signals_task
    logger.info(f"Site signals completed. Categories found: {len(site_signals.categories)}")
    
    # Wait for LLM signals if started
    llm_signals = None
    if llm_signals_task:
        try:
            llm_signals = await llm_signals_task
            logger.info(f"LLM signals completed. Competitors found: {len(llm_signals.competitors)}")
        except Exception as e:
            logger.error(f"Error in LLM signals analysis: {e}")
            llm_signals = None
    
    logger.info("All signals analysis completed successfully")
    return Signals(
        full_domain=full_domain, 
        domain_signals=domain_signals, 
        site_signals=site_signals,
        llm_signals=llm_signals
    )

if __name__ == "__main__":
    import asyncio
    
    async def test_signals():
        # Test with LLM signals
        check = await find_signals(
            full_domain="https://www.aloyoga.com",
            brand="Alo Yoga",
            industry="Sportswear",
            geo="United States"
        )
        print(check.model_dump())
    
    asyncio.run(test_signals())
