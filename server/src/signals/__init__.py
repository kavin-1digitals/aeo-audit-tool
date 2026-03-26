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
    
    # Start all signal tasks in parallel
    logger.info("Starting all signal collection tasks in parallel...")
    
    # Domain signals task
    domain_signals_task = asyncio.create_task(find_domain_signals(full_domain))
    
    # Site signals task
    site_signals_task = asyncio.create_task(find_site_signals(full_domain, None))
    
    # LLM signals task (if brand provided)
    llm_signals_task = None
    if brand and industry:
        logger.info("Starting LLM signals (brand visibility analysis)")
        llm_signals_task = asyncio.create_task(find_llm_signals(brand, geo))
    
    # Wait for all tasks to complete
    logger.info("Waiting for all signal tasks to complete...")
    
    # Get domain signals
    domain_signals = await domain_signals_task
    logger.info(f"Domain signals completed. Sitemap exists: {domain_signals.site_map_signal.sitemap.exists}")
    
    # Get site signals
    site_signals = await site_signals_task
    logger.info(f"Site signals completed. Site signals found: {len(site_signals.site_signals)}")
    logger.info(f"JSON-LD signals found: {len(site_signals.jsonld_signals)}")
    
    # Get LLM signals if started
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
