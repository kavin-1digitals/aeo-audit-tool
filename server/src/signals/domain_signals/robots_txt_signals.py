from urllib.parse import urljoin
import httpx
import logging
from protego import Protego
from src.config import AI_CRAWLERS, SEARCH_CRAWLERS, CRITICAL_PATTERNS

logger = logging.getLogger(__name__)

from pydantic import BaseModel
from typing import List, Optional


# -------------------------
# Schema
# -------------------------
class RobotsMeta(BaseModel):
    exists: bool
    status: Optional[int]

class SitemapInfo(BaseModel):
    exists: bool
    urls: List[str] = []

class CategoryAccess(BaseModel):
    category: str
    is_accessible: bool

class AgentAccess(BaseModel):
    agent: str
    category_access: List[CategoryAccess]

class CrawlerAccessGroup(BaseModel):
    agents: List[AgentAccess]

class RobotsTxtSignals(BaseModel):
    robots: RobotsMeta
    sitemaps: SitemapInfo
    ai_crawlers: Optional[CrawlerAccessGroup]
    search_crawlers: Optional[CrawlerAccessGroup]


# -------------------------
# Fetch robots.txt
# -------------------------
async def fetch_robots_txt(full_domain: str) -> tuple[str, RobotsMeta]:
    robots_url = urljoin(full_domain, "/robots.txt")
    logger.info(f"Fetching robots.txt from: {robots_url}")

    # Use fake browser headers to avoid blocking
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
        "Accept": "text/plain,text/html,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache"
    }

    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True, headers=headers) as client:
            resp = await client.get(robots_url)

            if resp.status_code == 200:
                logger.info(f"robots.txt fetched successfully: status={resp.status_code}, content_length={len(resp.text)}")
                return resp.text, RobotsMeta(exists=True, status=200)

            elif resp.status_code == 404:
                logger.warning(f"robots.txt not found: status={resp.status_code}")
                return None, RobotsMeta(exists=False, status=404)

            else:
                logger.warning(f"robots.txt fetch failed: status={resp.status_code}")
                return None, RobotsMeta(exists=False, status=resp.status_code)

    except httpx.RequestError as e:
        logger.error(f"robots.txt request error for {robots_url}: {e}")
        return None, RobotsMeta(exists=False, status=None)


# -------------------------
# Extract sitemap
# -------------------------
def extract_sitemaps(content: str) -> SitemapInfo:
    logger.debug(f"Extracting sitemaps from robots.txt content")
    sitemaps = [
        line.split(":", 1)[1].strip()
        for line in content.splitlines()
        if line.lower().startswith("sitemap:")
    ]
    
    logger.debug(f"Found {len(sitemaps)} sitemap entries before deduplication")
    
    # Remove duplicates while preserving order
    seen = set()
    unique_sitemaps = []
    for sitemap in sitemaps:
        if sitemap not in seen:
            seen.add(sitemap)
            unique_sitemaps.append(sitemap)

    logger.info(f"Extracted {len(unique_sitemaps)} unique sitemaps from robots.txt")
    for i, sitemap in enumerate(unique_sitemaps):
        logger.debug(f"  Sitemap {i+1}: {sitemap}")

    return SitemapInfo(
        exists=len(unique_sitemaps) > 0,
        urls=unique_sitemaps
    )


# -------------------------
# Generate test paths
# -------------------------
def generate_test_paths() -> dict[str, list[str]]:
    test_paths: dict[str, list[str]] = {}

    for category, patterns in CRITICAL_PATTERNS.items():
        paths: list[str] = []

        for p in patterns:
            clean = p.strip("/")
            paths.append(f"/{clean}/")
            paths.append(f"/{clean}/test")

        test_paths[category] = paths

    return test_paths


# -------------------------
# Evaluate access
# -------------------------
def evaluate_critical_access(rp: Protego, agents: list[str]) -> CrawlerAccessGroup:
    logger.debug(f"Evaluating critical access for {len(agents)} agents")
    test_paths = generate_test_paths()
    crawler_group = CrawlerAccessGroup(agents=[])

    for agent in agents:
        logger.debug(f"Testing access for agent: {agent}")
        agent_access = AgentAccess(agent=agent, category_access=[])

        for category, paths in test_paths.items():
            accessible = False

            for path in paths:
                if rp.can_fetch(agent, path):
                    accessible = True
                    logger.debug(f"  {agent} CAN access {category} path: {path}")
                    break
                else:
                    logger.debug(f"  {agent} CANNOT access {category} path: {path}")
            
            agent_access.category_access.append(CategoryAccess(category=category, is_accessible=accessible))

        # Summary for this agent
        accessible_categories = [cat.category for cat in agent_access.category_access if cat.is_accessible]
        logger.debug(f"  {agent} can access {len(accessible_categories)}/{len(test_paths)} categories: {accessible_categories}")

        crawler_group.agents.append(agent_access)

    # Summary for all agents
    total_accessible = sum(len([cat for cat in agent.category_access if cat.is_accessible]) for agent in crawler_group.agents)
    total_possible = len(crawler_group.agents) * len(test_paths)
    logger.info(f"Critical access summary: {total_accessible}/{total_possible} paths accessible")
    
    return crawler_group


# -------------------------
# Main function
# -------------------------
async def find_robots_txt_signals(full_domain: str) -> RobotsTxtSignals:
    logger.info(f"Starting robots.txt analysis for: {full_domain}")
    content, robots_meta = await fetch_robots_txt(full_domain)

    status = robots_meta.status

    # -------------------------
    # Case 1: robots.txt missing (404) → allow all
    # -------------------------
    if status == 404:
        logger.info("robots.txt not found (404) - assuming all access allowed")
        all_true = {
            category: True for category in CRITICAL_PATTERNS
        }

        ai_data = {agent: all_true for agent in AI_CRAWLERS}
        search_data = {agent: all_true for agent in SEARCH_CRAWLERS}

        logger.info(f"Generated default access rules for {len(AI_CRAWLERS)} AI crawlers and {len(SEARCH_CRAWLERS)} search crawlers")

        return RobotsTxtSignals(
            robots=robots_meta,
            sitemaps=SitemapInfo(exists=False, urls=[]),
            ai_crawlers=build_crawler_group(ai_data),
            search_crawlers=build_crawler_group(search_data)
        )

    # -------------------------
    # Case 2: error / blocked
    # -------------------------
    if status != 200 or not content:
        logger.error(f"robots.txt fetch failed with status {status}, no content available")
        return RobotsTxtSignals(
            robots=robots_meta,
            sitemaps=SitemapInfo(exists=False, urls=[]),
            ai_crawlers=None,
            search_crawlers=None
        )

    # -------------------------
    # Case 3: valid robots.txt
    # -------------------------
    logger.info(f"Processing valid robots.txt content ({len(content)} characters)")
    rp = Protego.parse(content)

    sitemap_info = extract_sitemaps(content)

    ai_crawlers = evaluate_critical_access(rp, AI_CRAWLERS)
    search_crawlers = evaluate_critical_access(rp, SEARCH_CRAWLERS)

    # Final summary
    ai_accessible = sum(len([cat for cat in agent.category_access if cat.is_accessible]) for agent in ai_crawlers.agents)
    search_accessible = sum(len([cat for cat in agent.category_access if cat.is_accessible]) for agent in search_crawlers.agents)
    total_ai_possible = len(ai_crawlers.agents) * len(CRITICAL_PATTERNS)
    total_search_possible = len(search_crawlers.agents) * len(CRITICAL_PATTERNS)

    logger.info(f"robots.txt analysis complete:")
    logger.info(f"  AI crawlers: {ai_accessible}/{total_ai_possible} paths accessible")
    logger.info(f"  Search crawlers: {search_accessible}/{total_search_possible} paths accessible")
    logger.info(f"  Sitemaps found: {len(sitemap_info.urls)}")

    return RobotsTxtSignals(
        robots=robots_meta,
        sitemaps=sitemap_info,
        ai_crawlers=ai_crawlers,
        search_crawlers=search_crawlers
    )


# -------------------------
# CLI test
# -------------------------
if __name__ == "__main__":
    import asyncio
    import json

    result = asyncio.run(
        find_robots_txt_signals("https://www.ajio.com")
    )

    print(json.dumps(result.model_dump(), indent=2))