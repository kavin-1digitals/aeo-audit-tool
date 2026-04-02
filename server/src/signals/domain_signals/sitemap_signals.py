import logging
from typing import Optional
import httpx
from pydantic import BaseModel
from urllib.parse import urljoin
from src.config import SITEMAP_PATTERNS
from lxml import etree
from datetime import datetime
import gzip

logger = logging.getLogger(__name__)


# -------------------------
# Schema
# -------------------------
class SiteMapMeta(BaseModel):
    exists: bool
    status: Optional[int]
    url: Optional[str]
    type_: Optional[str] = None

class SiteMapSignals(BaseModel):
    sitemap: SiteMapMeta
    last_updated: Optional[datetime] = None
    # status: bool
    # issue_found: Optional[str] = None
    # cause_of_issue: Optional[str] = None


# -------------------------
# Core fetch logic (simple)
# -------------------------
async def fetch_sitemap(
    full_domain: Optional[str],
    sitemap_url: Optional[str] = None
) -> tuple[str, SiteMapMeta]:

    urls_to_try = []

    if sitemap_url:
        urls_to_try.append(sitemap_url)
        logger.info(f"Using provided sitemap URL: {sitemap_url}")
    else:
        urls_to_try.extend([
            urljoin(full_domain, pattern) for pattern in SITEMAP_PATTERNS
        ])
        logger.info(f"Trying common sitemap patterns: {urls_to_try}")

    async with httpx.AsyncClient(
        follow_redirects=True,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }
    ) as client:

        for url in urls_to_try:
            try:
                logger.info(f"Fetching sitemap from: {url}")
                resp = await client.get(url)

                if resp.status_code == 200:
                    content = resp.text
                    logger.info(f"Successfully fetched sitemap from: {url} (size: {len(content)} chars)")
                    
                    # ✅ detect if gzipped
                    if url.endswith('.gz'):
                        logger.info("Detected gzipped sitemap, decompressing...")
                        content = gzip.decompress(resp.content).decode()
                        logger.info(f"Decompressed sitemap size: {len(content)} chars")

                    # ✅ Validate XML before returning
                    try:
                        root = etree.fromstring(content.encode())
                        tag = root.tag.split("}")[-1]
                        logger.info(f"Detected sitemap type: {tag}")
                        
                        return content, SiteMapMeta(
                            exists=True,
                            status=200,
                            url=url,
                            type_=tag
                        )
                    except Exception as e:
                        logger.warning(f"Invalid XML at {url}: {e}")
                        continue  # Try next pattern

                else:
                    logger.warning(f"Failed to fetch sitemap from {url}, status: {resp.status_code}")
                    continue

            except httpx.RequestError as e:
                logger.error(f"Request error fetching {url}: {e}")
                continue

    # fallback
    logger.warning("All sitemap URLs failed, returning not found")
    return None, SiteMapMeta(
        exists=False,
        status=404,
        url=None
    )

async def process_sitemap_content(
    content: str,
    sitemap: SiteMapMeta,
    full_domain: Optional[str]
) -> SiteMapSignals:

    logger.info(f"Processing sitemap content for domain: {full_domain}")
    
    # Initialize variables
    last_updated = None
    
    # Add homepage by default
    homepage_url = full_domain.rstrip('/')
    logger.info(f"Homepage URL: {homepage_url}")

    try:
        logger.info("Processing sitemap content...")
        root = etree.fromstring(content.encode())
        tag = root.tag.split("}")[-1]
        logger.info(f"Processing sitemap type: {tag}")

        # -------------------------
        # Helper: process URLs
        # -------------------------
        def process_urls(urls: list[str]):
            logger.info(f"Processing {len(urls)} URLs...")
            # Just process URLs without categorization
            return len(urls)
        
        def parse_lastmod(date_str: str):
            try:
                date_str = date_str.replace("Z", "+00:00")
                return datetime.fromisoformat(date_str)
            except Exception:
                return None

        # -------------------------
        # Case 1: Single sitemap
        # -------------------------
        if tag == "urlset":
            sitemap.type_ = "urlset"

            urls = root.xpath("//*[local-name()='loc']/text()")
            processed_count = process_urls(urls[:100])  # Process first 100 URLs only
            logger.info(f"Processed {processed_count} URLs from sitemap")

            lastmods = root.xpath("//*[local-name()='lastmod']/text()")
            if lastmods:
                parsed = [
                    parse_lastmod(d) for d in lastmods[:20]  # sample first 20 only
                ]
                parsed = [d for d in parsed if d]
                last_updated = max(parsed) if parsed else None
            
    
        # -------------------------
        # Case 2: Sitemap index
        # -------------------------
        elif tag == "sitemapindex":
            sitemap.type_ = "sitemapindex"

            sitemap_urls = root.xpath("//*[local-name()='loc']/text()")

            for sm_url in sitemap_urls[:5]:
                child_content, child_sitemap = await fetch_sitemap(full_domain, sm_url)

                if not child_content:
                    continue

                try:
                    child_root = etree.fromstring(child_content.encode())

                    child_tag = child_root.tag.split("}")[-1]

                    if child_tag != "urlset":
                        continue

                    urls = child_root.xpath("//*[local-name()='loc']/text()")
                    if last_updated is None:
                        lastmods = child_root.xpath("//*[local-name()='lastmod']/text()")
                        if lastmods:
                            parsed = [
                                parse_lastmod(d) for d in lastmods[:20]
                            ]
                            parsed = [d for d in parsed if d]
                            last_updated = max(parsed) if parsed else None
                                                

                    # process URLs
                    processed_count = process_urls(urls[:100])  # Process first 100 URLs only
                    logger.info(f"Processed {processed_count} URLs from child sitemap")

                except Exception:
                    continue

        else:
            sitemap.type_ = "unknown"

    except Exception as e:
        logger.error(f"XML parsing error: {e}")
        sitemap.type_ = "invalid"

    return SiteMapSignals(
        sitemap=sitemap,
        last_updated=last_updated
    )

# -------------------------
# Main
# -------------------------
async def find_sitemap_signals(
    full_domain: str,
    sitemap_url: Optional[str] = None
) -> SiteMapSignals:
    
    logger.info(f"Starting sitemap analysis for domain: {full_domain}")
    if sitemap_url:
        logger.info(f"Using specific sitemap URL: {sitemap_url}")

    content, sitemap = await fetch_sitemap(full_domain, sitemap_url)

    if not content:
        logger.warning("No sitemap content found, returning empty signals")
        return SiteMapSignals(sitemap=sitemap, last_updated=None)
    
    logger.info("Sitemap content fetched successfully, starting processing...")
    return await process_sitemap_content(content, sitemap, full_domain)


# -------------------------
# CLI test
# -------------------------
if __name__ == "__main__":
    import asyncio

    async def run():
        result = await find_sitemap_signals(
            "https://www.express.com",
        )

        if result.sitemap:
            print(result.model_dump_json(indent=2))
            print(result.last_updated)
        else:
            print("No content fetched")

    asyncio.run(run())