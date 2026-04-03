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
    status: bool
    issue_found: Optional[str] = None
    cause_of_issue: Optional[str] = None


# -------------------------
# Fetch robots.txt
# -------------------------
async def fetch_robots_txt(full_domain: str) -> tuple[str, RobotsMeta]:
    robots_url = urljoin(full_domain, "/robots.txt")
    logger.info(f"Fetching robots.txt from: {robots_url}")

    headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/plain,text/html,*/*;q=0.8"
    }

    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True, headers=headers) as client:
            resp = await client.get(robots_url)

            if resp.status_code == 200:
                return resp.text, RobotsMeta(exists=True, status=200)
            elif resp.status_code == 404:
                return None, RobotsMeta(exists=False, status=404)
            else:
                return None, RobotsMeta(exists=False, status=resp.status_code)

    except httpx.RequestError as e:
        logger.error(f"robots.txt request error: {e}")
        return None, RobotsMeta(exists=False, status=None)


# -------------------------
# Extract sitemap
# -------------------------
def extract_sitemaps(content: str) -> SitemapInfo:
    sitemaps = [
        line.split(":", 1)[1].strip()
        for line in content.splitlines()
        if line.lower().startswith("sitemap:")
    ]

    return SitemapInfo(
        exists=len(sitemaps) > 0,
        urls=list(dict.fromkeys(sitemaps))
    )


# -------------------------
# Generate test paths (UPDATED)
# -------------------------
def generate_test_paths(site_type: str) -> dict[str, list[str]]:
    test_paths: dict[str, list[str]] = {}

    patterns_by_type = CRITICAL_PATTERNS.get(site_type, {})

    for category, patterns in patterns_by_type.items():
        paths: list[str] = []

        for p in patterns:
            clean = p.strip("/")
            paths.append(f"/{clean}/")
            paths.append(f"/{clean}/test")

        test_paths[category] = paths

    return test_paths


# -------------------------
# Evaluate access (UPDATED)
# -------------------------
def evaluate_critical_access(rp: Protego, agents: list[str], site_type: str) -> CrawlerAccessGroup:
    test_paths = generate_test_paths(site_type)
    crawler_group = CrawlerAccessGroup(agents=[])

    for agent in agents:
        agent_access = AgentAccess(agent=agent, category_access=[])

        for category, paths in test_paths.items():
            accessible = any(rp.can_fetch(agent, path) for path in paths)
            agent_access.category_access.append(
                CategoryAccess(category=category, is_accessible=accessible)
            )

        crawler_group.agents.append(agent_access)

    return crawler_group


# -------------------------
# Helper (missing before)
# -------------------------
def build_crawler_group(data: dict[str, dict[str, bool]]) -> CrawlerAccessGroup:
    agents = []

    for agent, categories in data.items():
        agent_access = AgentAccess(
            agent=agent,
            category_access=[
                CategoryAccess(category=k, is_accessible=v)
                for k, v in categories.items()
            ]
        )
        agents.append(agent_access)

    return CrawlerAccessGroup(agents=agents)


# -------------------------
# Main function (UPDATED)
# -------------------------
async def find_robots_txt_signals(full_domain: str, site_type: str) -> RobotsTxtSignals:
    logger.info(f"Starting robots.txt analysis for: {full_domain}")

    content, robots_meta = await fetch_robots_txt(full_domain)
    status = robots_meta.status

    if not status:
        return RobotsTxtSignals(
            robots=robots_meta,
            sitemaps=SitemapInfo(exists=False),
            ai_crawlers=None,
            search_crawlers=None,
            status=False,
            issue_found="robots.txt file is inaccessible",
            cause_of_issue="Fetch failed"
        )

    patterns = CRITICAL_PATTERNS.get(site_type, {})

    # -------------------------
    # Case 1: 404 → allow all
    # -------------------------
    if status == 404:
        all_true = {category: True for category in patterns}

        return RobotsTxtSignals(
            robots=robots_meta,
            sitemaps=SitemapInfo(exists=False),
            ai_crawlers=build_crawler_group({a: all_true for a in AI_CRAWLERS}),
            search_crawlers=build_crawler_group({a: all_true for a in SEARCH_CRAWLERS}),
            status=True
        )

    # -------------------------
    # Case 2: invalid
    # -------------------------
    if status != 200 or not content:
        return RobotsTxtSignals(
            robots=robots_meta,
            sitemaps=SitemapInfo(exists=False),
            ai_crawlers=None,
            search_crawlers=None,
            status=False,
            issue_found="robots.txt inaccessible",
            cause_of_issue="Failed due to bot protection or server error on that domain"
        )

    # -------------------------
    # Case 3: valid robots.txt
    # -------------------------
    rp = Protego.parse(content)

    sitemap_info = extract_sitemaps(content)

    ai_crawlers = evaluate_critical_access(rp, AI_CRAWLERS, site_type)
    search_crawlers = evaluate_critical_access(rp, SEARCH_CRAWLERS, site_type)

    total_categories = len(patterns)

    ai_accessible = sum(
        len([c for c in a.category_access if c.is_accessible])
        for a in ai_crawlers.agents
    )

    search_accessible = sum(
        len([c for c in a.category_access if c.is_accessible])
        for a in search_crawlers.agents
    )

    logger.info(f"AI: {ai_accessible}/{len(ai_crawlers.agents) * total_categories}")
    logger.info(f"Search: {search_accessible}/{len(search_crawlers.agents) * total_categories}")

    return RobotsTxtSignals(
        robots=robots_meta,
        sitemaps=sitemap_info,
        ai_crawlers=ai_crawlers,
        search_crawlers=search_crawlers,
        status=True
    )


# -------------------------
# CLI test (FIXED)
# -------------------------
if __name__ == "__main__":
    import asyncio
    import json

    result = asyncio.run(
        find_robots_txt_signals("https://www.ameriprise.com", "hospital")
    )

    print(json.dumps(result.model_dump(), indent=2))