from urllib.parse import urljoin
import httpx
from protego import Protego
from src.config import AI_CRAWLERS, SEARCH_CRAWLERS, CRITICAL_PATTERNS

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

    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(robots_url)

        if resp.status_code == 200:
            return resp.text, RobotsMeta(exists=True, status=200)

        elif resp.status_code == 404:
            return None, RobotsMeta(exists=False, status=404)

        else:
            return None, RobotsMeta(exists=False, status=resp.status_code)

    except httpx.RequestError:
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
    
    # Remove duplicates while preserving order
    seen = set()
    unique_sitemaps = []
    for sitemap in sitemaps:
        if sitemap not in seen:
            seen.add(sitemap)
            unique_sitemaps.append(sitemap)

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
    test_paths = generate_test_paths()
    crawler_group = CrawlerAccessGroup(agents=[])

    for agent in agents:
        agent_access = AgentAccess(agent=agent, category_access=[])

        for category, paths in test_paths.items():
            accessible = False

            for path in paths:
                if rp.can_fetch(agent, path):
                    accessible = True
                    break
            
            agent_access.category_access.append(CategoryAccess(category=category, is_accessible=accessible))

        crawler_group.agents.append(agent_access)

    return crawler_group


# -------------------------
# Main function
# -------------------------
async def find_robots_txt_signals(full_domain: str) -> RobotsTxtSignals:
    content, robots_meta = await fetch_robots_txt(full_domain)

    status = robots_meta.status

    # -------------------------
    # Case 1: robots.txt missing (404) → allow all
    # -------------------------
    if status == 404:
        all_true = {
            category: True for category in CRITICAL_PATTERNS
        }

        ai_data = {agent: all_true for agent in AI_CRAWLERS}
        search_data = {agent: all_true for agent in SEARCH_CRAWLERS}

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
        return RobotsTxtSignals(
            robots=robots_meta,
            sitemaps=SitemapInfo(exists=False, urls=[]),
            ai_crawlers=None,
            search_crawlers=None
        )

    # -------------------------
    # Case 3: valid robots.txt
    # -------------------------
    rp = Protego.parse(content)

    sitemap_info = extract_sitemaps(content)

    ai_crawlers = evaluate_critical_access(rp, AI_CRAWLERS)
    search_crawlers = evaluate_critical_access(rp, SEARCH_CRAWLERS)

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
        find_robots_txt_signals("https://www.express.com")
    )

    print(json.dumps(result.dict(), indent=2))