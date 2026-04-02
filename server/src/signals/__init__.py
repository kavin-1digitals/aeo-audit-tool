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


async def find_signals(
    full_domain: str,
    brand: Optional[str] = None,
    geo: Optional[str] = "United States",
    site_type: Optional[str] = None
) -> Signals:

    logger.info(f"Starting signals analysis for domain: {full_domain}")
    logger.info("Starting all signal collection tasks in parallel...")

    # -----------------------------
    # Create tasks
    # -----------------------------
    domain_task = asyncio.create_task(find_domain_signals(full_domain, site_type))
    site_task = asyncio.create_task(find_site_signals(full_domain, site_type, None))

    tasks = [domain_task, site_task]

    # Optional LLM task
    if brand:
        logger.info("Starting LLM signals (brand visibility analysis)")
        llm_task = asyncio.create_task(find_llm_signals(brand, geo))
        tasks.append(llm_task)
    else:
        llm_task = None

    # -----------------------------
    # Run ALL in parallel
    # -----------------------------
    logger.info("Awaiting all tasks concurrently...")

    results = await asyncio.gather(*tasks, return_exceptions=True)

    # -----------------------------
    # Extract results safely
    # -----------------------------
    domain_signals = results[0]
    site_signals = results[1]

    logger.info(
        f"Domain signals completed. Sitemap exists: "
        f"{getattr(domain_signals.site_map_signal.sitemap, 'exists', 'unknown')}"
    )

    logger.info(
        f"Site signals completed. Site signals found: {len(site_signals.site_signals)}"
    )
    logger.info(
        f"JSON-LD signals found: {len(site_signals.jsonld_signals)}"
    )

    # -----------------------------
    # Handle LLM signals
    # -----------------------------
    llm_signals = None

    if brand:
        llm_result = results[2]

        if isinstance(llm_result, Exception):
            logger.error(f"Error in LLM signals analysis: {llm_result}")
            llm_signals = LlmSignals(
                status=False,
                issue_found="LLM Signal is not available",
                cause_of_issue="Internal Error: Try again later"
            )
        else:
            llm_signals = llm_result
            logger.info(
                f"LLM signals completed. Competitors found: "
                f"{len(llm_signals.signals.competitors) if llm_signals.signals else 0}"
            )

    logger.info("All signals analysis completed successfully")

    return Signals(
        full_domain=full_domain,
        domain_signals=domain_signals,
        site_signals=site_signals,
        llm_signals=llm_signals
    )


# -----------------------------
# Run
# -----------------------------
if __name__ == "__main__":

    async def test_signals():
        result = await find_signals(
            full_domain="https://www.aloyoga.com",
            brand="Alo Yoga",
            geo="United States"
        )
        print(result.model_dump())

    asyncio.run(test_signals())