from typing import Optional, List
from pydantic import BaseModel
from .url_collector import crawl_site
from .canonical_signals import find_canonical_signal, CanonicalSignal
from .jsonld_signals import find_jsonld_signal, JsonLdType
from .meta_signals import find_meta_signal, MetaSignal
from src.config import JSONLD_VALIDATION_RULES, JSONLD_CATEGORIES
import asyncio
import os
import json
from datetime import datetime
import logging

# Setup JSON-LD validation logger
jsonld_logger = logging.getLogger('jsonld_validation')
jsonld_logger.setLevel(logging.DEBUG)

# Control logging - set to False to pause JSON-LD logging
ENABLE_JSONLD_LOGGING = False

# Create file handler for JSON-LD validation logs
if ENABLE_JSONLD_LOGGING:
    jsonld_handler = logging.FileHandler('jsonld_validation_debug.log')
    jsonld_handler.setLevel(logging.DEBUG)

    # Create formatter
    jsonld_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    jsonld_handler.setFormatter(jsonld_formatter)

    # Add handler to logger
    jsonld_logger.addHandler(jsonld_handler)
else:
    # Set to higher level to effectively disable logging
    jsonld_logger.setLevel(logging.CRITICAL + 1)


class SiteSignal(BaseModel):
    url: str
    depth: int
    index: int
    parent_url: Optional[List[str]]
    status_code: int
    source: str
    final_url: Optional[str]
    canonical_signal: CanonicalSignal
    meta_signal: Optional[MetaSignal] = None


class SiteSignals(BaseModel):
    is_scrapable: bool
    site_signals: List[SiteSignal] = []
    jsonld_signals: List[JsonLdType] = []
    issue_found: Optional[str] = None
    cause_of_issue: Optional[str] = None


async def find_site_signals(full_domain: str, crawl_result: Optional[str], site_types: Optional[List[str]] = None) -> SiteSignals:

    # ---------------------------
    # Step 1: Ensure crawl exists
    # ---------------------------
    if not crawl_result:
        crawl_result = await crawl_site(full_domain)

    # ---------------------------
    # Step 2: Validate crawl result
    # ---------------------------
    if not crawl_result or not crawl_result.pages:
        return SiteSignals(
            is_scrapable=False,
            site_signals=[],
            jsonld_signals=[],
            issue_found="Site is not scrapable",
            cause_of_issue="Failed to scrape the site due to server blocking/access issues, JavaScript rendering problems, rate limiting"
        )

    # ---------------------------
    # Step 3: Filter valid pages
    # ---------------------------
    valid_pages = [
        page for page in crawl_result.pages
        if page.content and page.status_code == 200
    ]

    if not valid_pages:
        return SiteSignals(
            is_scrapable=False,
            site_signals=[],
            jsonld_signals=[],
            issue_found="Site is not scrapable",
            cause_of_issue="Failed to scrape the site due to server JavaScript rendering problems or invalid HTML structure"
        )

    # ---------------------------
    # Step 4: Determine validation types based on site_types
    # ---------------------------
    validation_types = []
    if site_types:
        # For multiple site types, collect all validation types
        jsonld_logger.info(f"Processing site_types: {site_types}")
        for st in site_types:
            types_for_site = JSONLD_CATEGORIES.get(st, [])
            jsonld_logger.info(f"Types for {st}: {types_for_site}")
            validation_types.extend(types_for_site)
    else:
        # fallback to all known types
        validation_types = ["brand"]
        jsonld_logger.info("Using fallback validation types: ['brand']")

    jsonld_logger.info(f"Final validation_types: {validation_types}")
    jsonld_logger.info(f"Available JSONLD_CATEGORIES keys: {list(JSONLD_CATEGORIES.keys())}")
    jsonld_logger.info(f"Available JSONLD_VALIDATION_RULES keys: {list(JSONLD_VALIDATION_RULES.keys())}")

    remaining_types = set(validation_types)

    # ---------------------------
    # Step 5: Process signals
    # ---------------------------
    site_signals = []
    all_jsonld_signals = []

    for page in valid_pages:

        # 🚀 Optimization: stop if all schemas found
        if not remaining_types:
            break

        try:
            canonical_signal = await find_canonical_signal(
                page.url,
                page.response_url,
                page.content
            )

            jsonld_signal = find_jsonld_signal(
                page.url,
                page.content,
                list(remaining_types)
            )

            # Log detailed JSON-LD validation results
            jsonld_logger.info(f"Processing page: {page.url}")
            jsonld_logger.info(f"Remaining types to check: {list(remaining_types)}")
            
            for signal in jsonld_signal.jsonld_signals:
                jsonld_logger.info(f"Schema Type: {signal.type_}")
                jsonld_logger.info(f"Schema Exists: {signal.exists}")
                jsonld_logger.info(f"Schema Valid: {signal.is_valid}")
                
                # Log validation rules for this type
                rules = JSONLD_VALIDATION_RULES.get(signal.type_)
                if rules:
                    jsonld_logger.info(f"Validation rules for {signal.type_}: {rules}")
                else:
                    jsonld_logger.warning(f"No validation rules found for {signal.type_}")

            # Track found schemas
            for s in jsonld_signal.jsonld_signals:
                if s.exists:
                    jsonld_logger.info(f"Found schema: {s.type_} - removing from remaining types")
                    remaining_types.discard(s.type_)
                else:
                    jsonld_logger.info(f"Missing schema: {s.type_} - keeping in remaining types")

            meta_signal = find_meta_signal(page.url, page.content)

            site_signals.append(
                SiteSignal(
                    url=page.url,
                    depth=page.depth,
                    index=page.index,
                    parent_url=page.parent_url,
                    status_code=page.status_code,
                    source=page.source,
                    final_url=page.response_url,
                    canonical_signal=canonical_signal,
                    meta_signal=meta_signal
                )
            )

            all_jsonld_signals.extend(jsonld_signal.jsonld_signals)

        except Exception as e:
            print(f"Error processing page {page.url}: {e}")
            continue

    # ---------------------------
    # Step 6: Final scrapable decision
    # ---------------------------
    is_scrapable = len(site_signals) > 0

    return SiteSignals(
        is_scrapable=is_scrapable,
        site_signals=site_signals,
        jsonld_signals=all_jsonld_signals,
        issue_found="Site is not scrapable" if not is_scrapable else None,
        cause_of_issue="Failed to scrape the site due to server blocking/access issues, JavaScript rendering problems, rate limiting, or invalid HTML structure" if not is_scrapable else None
    )


# ---------------------------
# Local test runner
# ---------------------------
if __name__ == '__main__':
    full_domain = 'https://www.express.com'
    site_type = "ecommerce"  # 🔥 IMPORTANT: now required
    crawl_file = "crawl_result.json"

    if os.path.exists(crawl_file):
        print(f"Loading existing crawl result from {crawl_file}")
        with open(crawl_file, 'r') as f:
            crawl_data = json.load(f)

        from .url_collector import CrawlResult, PageData
        pages = [PageData(**page) for page in crawl_data['pages']]
        crawl_result = CrawlResult(pages=pages)

    else:
        print("Running fresh crawl...")
        crawl_result = asyncio.run(crawl_site(full_domain))

        with open(crawl_file, 'w') as f:
            json.dump(crawl_result.model_dump(), f, indent=2)

        print(f"Crawl result saved to {crawl_file}")

    domain_task = asyncio.create_task(find_domain_signals(full_domain, site_types))
    site_task = asyncio.create_task(find_site_signals(full_domain, None, site_types))

    result = asyncio.run(asyncio.gather(domain_task, site_task))

    # Write result to file
    output_file = "site_signals_result.json"
    with open(output_file, 'w') as f:
        f.write(result[1].model_dump_json(indent=2))

    print(f"Site signals result saved to {output_file}")