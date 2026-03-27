import asyncio
import logging
import httpx
import random
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from pydantic import BaseModel
from typing import List, Optional, Set, Tuple

from src.config import SCRAPERAPI_API_KEY

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# ---------------------------
# CONFIG
# ---------------------------
MAX_DEPTH1 = 50
MAX_DEPTH2_PAGES = 15
MAX_DEPTH3_PER_PAGE = 10

JS_MAX_TOTAL_PAGES = 6
MAX_CONCURRENT_REQUESTS = 20

BOT_NAME = "OneDigitalsBot"
BOT_VERSION = "1.0"
BOT_INFO_URL = "https://1digitals.com/bot"

# ---------------------------
# MODELS
# ---------------------------
class PageData(BaseModel):
    url: str
    response_url: str
    content: str
    depth: int
    index: int
    parent_url: Optional[List[str]]
    status_code: int
    source: str


class CrawlResult(BaseModel):
    pages: List[PageData]


# ---------------------------
# UTILS
# ---------------------------
def normalize_url(url: str) -> str:
    parsed = urlparse(str(url))
    return f"https://{parsed.netloc.lower()}{parsed.path.rstrip('/')}"


# ---------------------------
# JS DETECTION
# ---------------------------
def is_javascript_heavy(soup: BeautifulSoup) -> bool:
    if not soup:
        return True

    anchors = soup.find_all("a")
    scripts = soup.find_all("script")

    if len(anchors) < 5:
        return True

    if soup.find(id="root") or soup.find(id="__next"):
        return True

    if len(scripts) > len(anchors):
        return True

    return False


# ---------------------------
# FETCHERS
# ---------------------------
HEADERS = {
    "User-Agent": f"{BOT_NAME}/{BOT_VERSION} ({BOT_INFO_URL})",
    "Accept-Language": "en-US,en;q=0.9",
}


async def fetch_httpx(client, url: str, sem: asyncio.Semaphore) -> Tuple:
    async with sem:
        try:
            resp = await client.get(url, timeout=15.0)

            if resp.status_code == 200:
                return url, resp.text, resp.status_code, "httpx", str(resp.url)

            return url, None, resp.status_code, "httpx", None

        except Exception:
            return url, None, 0, "httpx", None


async def fetch_scraperapi(client, url: str, sem: asyncio.Semaphore) -> Tuple:
    async with sem:
        try:
            params = {
                "api_key": SCRAPERAPI_API_KEY,
                "url": url,
                "render": "true"
            }

            resp = await client.get(
                "https://api.scraperapi.com/",
                params=params,
                timeout=60.0
            )

            if resp.status_code == 200:
                final_url = (
                    resp.headers.get("sa-final-url")
                    or resp.headers.get("X-ScraperAPI-Final-URL")
                    or str(resp.url)
                )

                return url, resp.text, resp.status_code, "scraperapi", final_url

            return url, None, resp.status_code, "scraperapi", None

        except Exception:
            return url, None, 0, "scraperapi", None


# ---------------------------
# LINK EXTRACTION
# ---------------------------
def extract_links(soup: BeautifulSoup, base_url: str):
    return {
        urljoin(base_url, a.get("href").strip())
        for a in soup.find_all("a", href=True)
        if a.get("href") and not a.get("href").startswith("#")
    }


def filter_internal_links(links: set, base_url: str):
    domain = urlparse(base_url).netloc
    return {l for l in links if urlparse(l).netloc == domain}


# ---------------------------
# JS CHECK
# ---------------------------
async def check_js_enabled(url: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, headers=HEADERS) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                return is_javascript_heavy(soup)
    except Exception:
        pass

    return True


# ---------------------------
# CORE CRAWLER
# ---------------------------
async def crawl_site(url: str) -> CrawlResult:
    visited: Set[str] = set()
    pages: List[PageData] = []
    global_index = 1

    js_enabled = await check_js_enabled(url)
    logger.info(f"JS mode enabled: {js_enabled}")

    async with httpx.AsyncClient(
        timeout=30.0,
        follow_redirects=True,
        headers=HEADERS
    ) as client:

        # ==========================
        # JS MODE
        # ==========================
        if js_enabled:
            sem = asyncio.Semaphore(5)

            # Homepage
            _, html, status, source, response_url = await fetch_scraperapi(client, url, sem)

            if not html:
                return CrawlResult(pages=[])

            norm_home = normalize_url(response_url or url)
            visited.add(norm_home)

            pages.append(PageData(
                url=url,
                response_url=norm_home,
                content=html,
                depth=0,
                index=global_index,
                parent_url=None,
                status_code=status,
                source=source
            ))
            global_index += 1

            soup = BeautifulSoup(html, "html.parser")
            links = list(filter_internal_links(extract_links(soup, url), url))
            random.shuffle(links)

            selected_links = [
                l for l in links
                if normalize_url(l) not in visited
            ][:JS_MAX_TOTAL_PAGES - 1]

            tasks = [fetch_scraperapi(client, link, sem) for link in selected_links]
            results = await asyncio.gather(*tasks)

            for link, html, status, source, response_url in results:
                if not html:
                    continue

                norm = normalize_url(response_url or link)
                if norm in visited:
                    continue

                visited.add(norm)

                pages.append(PageData(
                    url=link,
                    response_url=norm,
                    content=html,
                    depth=1,
                    index=global_index,
                    parent_url=[url],
                    status_code=status,
                    source=source
                ))
                global_index += 1

            return CrawlResult(pages=pages)

        # ==========================
        # NON-JS MODE
        # ==========================
        sem = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

        _, html, status, source, response_url = await fetch_httpx(client, url, sem)

        if not html:
            return CrawlResult(pages=[])

        norm_home = normalize_url(response_url or url)
        visited.add(norm_home)

        pages.append(PageData(
            url=url,
            response_url=norm_home,
            content=html,
            depth=0,
            index=global_index,
            parent_url=None,
            status_code=status,
            source=source
        ))
        global_index += 1

        soup = BeautifulSoup(html, "html.parser")
        links = list(filter_internal_links(extract_links(soup, url), url))
        random.shuffle(links)

        tasks = [
            fetch_httpx(client, link, sem)
            for link in links[:MAX_DEPTH1]
            if normalize_url(link) not in visited
        ]

        results = await asyncio.gather(*tasks)

        for link, html, status, source, response_url in results:
            if not html:
                continue

            norm = normalize_url(response_url or link)
            if norm in visited:
                continue

            visited.add(norm)

            pages.append(PageData(
                url=link,
                response_url=norm,
                content=html,
                depth=1,
                index=global_index,
                parent_url=[url],
                status_code=status,
                source=source
            ))
            global_index += 1

        return CrawlResult(pages=pages)


# ---------------------------
# TEST MAIN
# ---------------------------
import os

async def main():
    url = "https://www.sensai-cosmetics.com/gb/en/"

    result = await crawl_site(url)

    logger.info(f"Final total pages collected: {len(result.pages)}")

    output_dir = "crawl_output2"
    os.makedirs(output_dir, exist_ok=True)

    for page in result.pages:
        filename = f"page_{page.depth}_{page.index}.html"
        filepath = os.path.join(output_dir, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(page.content)

    # Save mapping
    map_path = os.path.join(output_dir, "pages_map.txt")
    with open(map_path, "w", encoding="utf-8") as f:
        for page in result.pages:
            filename = f"page_{page.depth}_{page.index}.html"
            f.write(f"{page.url} → {filename} (source: {page.source})\n")

    logger.info(f"All HTML files and map saved in: {output_dir}")


if __name__ == "__main__":
    asyncio.run(main())