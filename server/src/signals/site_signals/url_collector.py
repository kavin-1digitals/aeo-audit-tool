import asyncio
import logging
import httpx
import requests
import random
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from pydantic import BaseModel
from typing import List, Optional, Set

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
JS_ADDITIONAL_PAGES = JS_MAX_TOTAL_PAGES - 1  # 5 (homepage already counted)

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
def normalize_url(url: str):
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


async def fetch_httpx(client, url: str, sem: asyncio.Semaphore):
    async with sem:
        try:
            resp = await client.get(url)

            if resp.status_code == 200:
                return url, resp.text, resp.status_code, "httpx", str(resp.url)

            if resp.status_code == 403:
                await asyncio.sleep(1)
                resp = await client.get(url)
                if resp.status_code == 200:
                    return url, resp.text, resp.status_code, "httpx", str(resp.url)

            return url, None, resp.status_code, "httpx", None

        except Exception:
            return url, None, 0, "httpx", None


def fetch_scraperapi(url: str):
    payload = {
        "api_key": SCRAPERAPI_API_KEY,
        "url": url,
        "render": "true"
    }

    r = requests.get("https://api.scraperapi.com/", params=payload)

    if r.status_code == 200:
        final_url = r.headers.get("X-ScraperAPI-Final-URL", url)
        return r.text, r.status_code, "scraperapi", final_url

    return None, r.status_code, "scraperapi", None


# ---------------------------
# LINK EXTRACTION
# ---------------------------
def extract_links(soup, base_url):
    return {
        urljoin(base_url, a.get("href").strip())
        for a in soup.find_all("a", href=True)
        if a.get("href") and not a.get("href").startswith("#")
    }


def filter_internal_links(links, base_url):
    domain = urlparse(base_url).netloc
    return {l for l in links if urlparse(l).netloc == domain}


# ---------------------------
# JS CHECK (lightweight probe)
# ---------------------------
async def check_js_enabled(url: str) -> bool:
    """
    Quick httpx probe of the homepage — only used to decide crawl strategy.
    Does NOT store any page data.
    """
    try:
        async with httpx.AsyncClient(
            timeout=10.0,
            follow_redirects=True,
            headers=HEADERS
        ) as probe_client:
            resp = await probe_client.get(url)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                return is_javascript_heavy(soup)
    except Exception:
        pass

    # If probe fails, assume JS-heavy (safer fallback)
    return True


# ---------------------------
# CORE CRAWLER
# ---------------------------
async def crawl_site(url: str) -> CrawlResult:
    visited: Set[str] = set()
    pages: List[PageData] = []
    global_index = 1

    # ---- Step 1: JS check FIRST before any real crawling ----
    js_enabled = await check_js_enabled(url)
    logger.info(
        f"JS check complete → js_enabled={js_enabled} "
        f"| strategy: {'ScraperAPI only / {JS_MAX_TOTAL_PAGES} pages' if js_enabled else 'httpx / full depth crawl'}"
    )

    # ==========================
    # JS MODE — ScraperAPI only
    # Fetch homepage + up to 5 additional pages (6 total)
    # ==========================
    if js_enabled:
        logger.info("JS mode: fetching homepage via ScraperAPI...")

        html, status, source, response_url = fetch_scraperapi(url)

        if not html:
            logger.error("ScraperAPI failed to fetch homepage — aborting")
            return CrawlResult(pages=[])

        response_url = normalize_url(response_url or url)
        soup = BeautifulSoup(html, "html.parser")

        visited.add(normalize_url(url))
        pages.append(PageData(
            url=url,
            response_url=response_url,
            content=html,
            depth=0,
            index=global_index,
            parent_url=None,
            status_code=status,
            source=source
        ))
        global_index += 1

        links = list(filter_internal_links(extract_links(soup, url), url))
        random.shuffle(links)

        logger.info(f"JS mode: {len(links)} links found, fetching up to {JS_ADDITIONAL_PAGES} more pages...")

        for link in links:
            if global_index > JS_MAX_TOTAL_PAGES:
                break

            norm = normalize_url(link)
            if norm in visited:
                continue

            html, status, source, response_url = fetch_scraperapi(link)

            if not html:
                continue

            visited.add(norm)
            response_url = normalize_url(response_url or link)

            pages.append(PageData(
                url=link,
                response_url=response_url,
                content=html,
                depth=1,
                index=global_index,
                parent_url=[url],
                status_code=status,
                source=source
            ))
            global_index += 1

        logger.info(f"JS mode complete: {len(pages)}/{JS_MAX_TOTAL_PAGES} pages collected")
        return CrawlResult(pages=pages)

    # ==========================
    # NON-JS MODE — httpx parallel
    # Full depth crawl (depth 0 → 1 → 2)
    # ==========================
    sem = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

    async with httpx.AsyncClient(
        timeout=10.0,
        follow_redirects=True,
        headers=HEADERS
    ) as client:

        logger.info("Non-JS mode: fetching homepage via httpx...")

        _, html, status, source, response_url = await fetch_httpx(client, url, sem)

        if not html:
            logger.warning("httpx homepage fetch failed, falling back to ScraperAPI...")
            html, status, source, response_url = fetch_scraperapi(url)

        if not html:
            logger.error("Both fetchers failed for homepage — aborting")
            return CrawlResult(pages=[])

        response_url = normalize_url(response_url or url)
        soup = BeautifulSoup(html, "html.parser")

        visited.add(normalize_url(url))
        pages.append(PageData(
            url=url,
            response_url=response_url,
            content=html,
            depth=0,
            index=global_index,
            parent_url=None,
            status_code=status,
            source=source
        ))
        global_index += 1

        links = list(filter_internal_links(extract_links(soup, url), url))
        random.shuffle(links)

        logger.info(f"Non-JS mode: parallel httpx crawl up to depth 2 | {len(links)} depth-1 links found")

        # --- Depth 1 ---
        tasks = [
            fetch_httpx(client, link, sem)
            for link in links[:MAX_DEPTH1]
            if normalize_url(link) not in visited
        ]

        results = await asyncio.gather(*tasks)
        depth1_pages = []

        for link, html, status, source, response_url in results:
            if not html:
                continue

            norm = normalize_url(link)
            if norm in visited:
                continue

            visited.add(norm)
            response_url = normalize_url(response_url or link)

            page = PageData(
                url=link,
                response_url=response_url,
                content=html,
                depth=1,
                index=global_index,
                parent_url=[url],
                status_code=status,
                source=source
            )

            pages.append(page)
            depth1_pages.append(page)
            global_index += 1

        # --- Depth 2 ---
        random.shuffle(depth1_pages)
        selected = depth1_pages[:MAX_DEPTH2_PAGES]

        for parent in selected:
            soup = BeautifulSoup(parent.content, "html.parser")
            child_links = list(filter_internal_links(extract_links(soup, parent.url), url))
            random.shuffle(child_links)

            tasks = [
                fetch_httpx(client, link, sem)
                for link in child_links[:MAX_DEPTH3_PER_PAGE]
                if normalize_url(link) not in visited
            ]

            results = await asyncio.gather(*tasks)

            for link, html, status, source, response_url in results:
                if not html:
                    continue

                norm = normalize_url(link)
                if norm in visited:
                    continue

                visited.add(norm)
                response_url = normalize_url(response_url or link)

                pages.append(PageData(
                    url=link,
                    response_url=response_url,
                    content=html,
                    depth=2,
                    index=global_index,
                    parent_url=[parent.url],
                    status_code=status,
                    source=source
                ))
                global_index += 1

        logger.info(f"Non-JS mode complete: {len(pages)} pages collected")

    return CrawlResult(pages=pages)


# ---------------------------
# TEST MAIN
# ---------------------------
import os

async def main():
    url = "https://www.express.com"

    result = await crawl_site(url)

    logger.info(f"Total pages collected: {len(result.pages)}")

    output_dir = "crawl_output2"
    os.makedirs(output_dir, exist_ok=True)

    for page in result.pages:
        filename = f"page_{page.depth}_{page.index}.html"
        filepath = os.path.join(output_dir, filename)

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(page.content)

    map_path = os.path.join(output_dir, "pages_map.txt")

    with open(map_path, "w", encoding="utf-8") as f:
        for page in result.pages:
            filename = f"page_{page.depth}_{page.index}.html"
            f.write(f"{page.url} -> {filename}\n")

    logger.info(f"All files saved in folder: {output_dir}")

if __name__ == "__main__":
    asyncio.run(main())