import json
import logging
from src.signals.domain_signals.sitemap_signals import SiteMapSignals
import httpx
from bs4 import BeautifulSoup
from pydantic import BaseModel
from typing import List
from .canonical_signals import CanonicalSignal, find_canonical_signal
from .jsonld_signals import JsonLdSignal, find_jsonld_signals

logger = logging.getLogger(__name__)


# -------------------------
# Schema
# -------------------------
class CategoryPageSignals(BaseModel):
    original_url: str
    final_url: str
    canonical_signal: CanonicalSignal
    jsonld_signal: JsonLdSignal


class SiteCategoryData(BaseModel):
    category: str
    category_pages: List[CategoryPageSignals]


class SiteSignals(BaseModel):
    categories: List[SiteCategoryData]


# -------------------------
# Fetch page
# -------------------------
async def scrap_url(url: str):
    logger.debug(f"Scraping URL: {url}")
    
    async with httpx.AsyncClient(
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        },
        follow_redirects=True
    ) as client:
        try:
            logger.debug(f"Making HTTP request to: {url}")
            resp = await client.get(url)

            if resp.status_code == 200:
                logger.debug(f"Successfully fetched {url}, content length: {len(resp.text)}")
                soup = BeautifulSoup(resp.text, "lxml")
                return soup, str(resp.url)
            else:
                logger.warning(f"Failed to fetch {url}, status: {resp.status_code}")

        except httpx.RequestError as e:
            logger.error(f"Request error for {url}: {e}")

    return None, None


# -------------------------
# Scrap category
# -------------------------
async def scrap_category(category: str, category_urls: list[str]) -> SiteCategoryData:
    logger.info(f"Scraping category '{category}' with {len(category_urls)} URLs")
    pages = []

    if not category_urls:
        logger.warning(f"No URLs provided for category '{category}'")
        return SiteCategoryData(category=category, category_pages=[])

    for i, url in enumerate(category_urls):
        logger.info(f"Processing URL {i+1}/{len(category_urls)} for category '{category}': {url}")
        
        soup, final_url = await scrap_url(url)

        if not soup:
            logger.warning(f"Failed to fetch content for URL: {url}")
            continue

        logger.debug(f"Analyzing signals for {final_url}")
        canonical_signal = await find_canonical_signal(soup, final_url)
        jsonld_signal = await find_jsonld_signals(soup, category)

        pages.append(
            CategoryPageSignals(
                original_url=url,
                final_url=final_url,
                canonical_signal=canonical_signal,
                jsonld_signal=jsonld_signal
            )
        )
        
        logger.debug(f"Completed analysis for URL: {final_url}")

    logger.info(f"Completed scraping category '{category}', successfully processed {len(pages)}/{len(category_urls)} URLs")
    return SiteCategoryData(
        category=category,
        category_pages=pages
    )


# -------------------------
# Main aggregation
# -------------------------
async def find_site_signals(site_map: SiteMapSignals) -> SiteSignals:
    logger.info("Starting site-level signals analysis")
    categories = []

    if not site_map.category_urls:
        logger.warning("No category URLs found in sitemap, returning empty site signals")
        return SiteSignals(categories=[])

    logger.info(f"Found {len(site_map.category_urls)} categories to process")
    
    for category_obj in site_map.category_urls:
        logger.info(f"Processing category: {category_obj.category}")
        category_data = await scrap_category(
            category_obj.category,
            category_obj.urls
        )
        categories.append(category_data)
        logger.info(f"Completed category: {category_obj.category}")

    logger.info(f"Site signals analysis completed, processed {len(categories)} categories")
    return SiteSignals(categories=categories)


# -------------------------
# CLI test
# -------------------------
if __name__ == "__main__":
    import asyncio
    import os

    json_path = os.path.join(
        os.path.dirname(__file__),
        'sitemap_signals_test.json'
    )

    with open(json_path, 'r') as f:
        test_data = json.load(f)

    site_map_signals = SiteMapSignals.model_validate(test_data)

    result = asyncio.run(find_site_signals(site_map_signals))

    print(result.model_dump_json(indent=2))