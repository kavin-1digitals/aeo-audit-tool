from typing import Optional, List
from pydantic import BaseModel
from .url_collector import crawl_site
from .canonical_signals import find_canonical_signal, CanonicalSignal
from .jsonld_signals import find_jsonld_signal, JsonLdType
from src.config import JSONLD_VALIDATION_RULES
import asyncio
import os
import json
from datetime import datetime

class SiteSignal(BaseModel):
    url: str
    depth: int
    index: int
    parent_url: Optional[List[str]]
    status_code: int
    source: str
    final_url: Optional[str]
    canonical_signal: CanonicalSignal


class SiteSignals(BaseModel):
    site_signals: List[SiteSignal]
    jsonld_signals: List[JsonLdType]


async def find_site_signals(full_domain: str, crawl_result) -> SiteSignals:
    if not crawl_result:
        crawl_result = await crawl_site(full_domain)

    site_signals = []
    all_jsonld_signals = []

    # track remaining types
    remaining_types = set(JSONLD_VALIDATION_RULES.keys())

    for page in crawl_result.pages:
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

        # Not removing it for now, as we want to see all the types
        # # remove validated types
        # for js in jsonld_signal.types:
        #     if js.exists and js.is_valid:
        #         remaining_types.discard(js.type_)

        site_signals.append(
            SiteSignal(
                url=page.url,
                depth=page.depth,
                index=page.index,
                parent_url=page.parent_url,
                status_code=page.status_code,
                source=page.source,
                final_url=page.response_url,
                canonical_signal=canonical_signal
            )
        )
        all_jsonld_signals.extend(jsonld_signal.jsonld_signals)

    return SiteSignals(
        site_signals=site_signals,
        jsonld_signals=all_jsonld_signals
    )

if __name__ == '__main__':
    full_domain = 'https://www.express.com'
    crawl_file = "crawl_result.json"
    
    if os.path.exists(crawl_file):
        print(f"Loading existing crawl result from {crawl_file}")
        with open(crawl_file, 'r') as f:
            crawl_data = json.load(f)
        # Load as CrawlResult, not SiteSignals
        from .url_collector import CrawlResult, PageData
        pages = [PageData(**page) for page in crawl_data['pages']]
        crawl_result = CrawlResult(pages=pages)
    else:
        print("Running fresh crawl...")
        crawl_result = asyncio.run(crawl_site(full_domain))
        
        # Save crawl result for future use
        with open(crawl_file, 'w') as f:
            json.dump(crawl_result.model_dump(), f, indent=2)
        print(f"Crawl result saved to {crawl_file}")
    
    result = asyncio.run(find_site_signals(full_domain, crawl_result))
    
    # Write result to file
    output_file = "site_signals_result.json"
    with open(output_file, 'w') as f:
        f.write(result.model_dump_json(indent=2))
    print(f"Site signals result saved to {output_file}")