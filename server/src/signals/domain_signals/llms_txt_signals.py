from urllib.parse import urljoin
import httpx
from pydantic import BaseModel
from typing import Optional, Dict
from urllib.parse import urlparse

# -------------------------
# Schema
# -------------------------
class EnrichmentSignals(BaseModel):
    has_h1: bool = False
    has_h2: bool = False
    has_list: bool = False
    has_bold: bool = False
    has_colon: bool = False

class LlmsTxtMeta(BaseModel):
    exists: bool
    is_valid: bool
    enriched: EnrichmentSignals
    status: Optional[int]

class LlmsTxtSignals(BaseModel):
    llm_txts: LlmsTxtMeta

# -------------------------
# Enrichment check
# -------------------------
def get_enrichment_signals(content: str) -> EnrichmentSignals:
    return EnrichmentSignals(
        has_h1="#" in content,
        has_h2="##" in content,
        has_list="- " in content,
        has_bold="**" in content,
        has_colon=":" in content,
    )

# -------------------------
# Validation check
# -------------------------
def is_text_file(content_type: str, content: str) -> bool:
    if not content:
        return False

    content_lower = content.lower()
    content_type = (content_type or "").lower()

    # ❌ Strong HTML detection
    if "<html" in content_lower or "<!doctype html" in content_lower:
        return False

    if "text/html" in content_type:
        return False

    # ✅ Accept common text types
    if any(t in content_type for t in ["text/plain", "text/markdown", "text/"]):
        return True

    # ✅ Fallback: readable non-empty text
    if content.strip():
        return True

    return False

# -------------------------
# Helper function to extract root domain
# -------------------------
def get_root_domain(full_domain: str) -> str:
    """Extract root domain from full URL"""
    parsed = urlparse(full_domain)
    return f"{parsed.scheme}://{parsed.netloc}"

# -------------------------
# Fetch llm.txt
# -------------------------
async def fetch_llm_txt(full_domain: str) -> LlmsTxtMeta:
    # First try with the full domain as provided
    result = await _fetch_llm_txt_from_domain(full_domain)
    
    # If not found (404), try with root domain as fallback
    if not result.exists and result.status == 404:
        root_domain = get_root_domain(full_domain)
        if root_domain != full_domain:  # Only try if different
            print(f"Fallback: Trying root domain {root_domain} from {full_domain}")
            result = await _fetch_llm_txt_from_domain(root_domain)
    
    return result

async def _fetch_llm_txt_from_domain(domain: str) -> LlmsTxtMeta:
    """Internal function to fetch llms.txt from a specific domain"""
    llm_txt_url = urljoin(domain, "/llms.txt")

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
            resp = await client.get(llm_txt_url)

        if resp.status_code == 200:
            content_type = resp.headers.get("content-type", "")
            content = resp.text

            is_valid = is_text_file(content_type, content)

            enriched = (
                get_enrichment_signals(content)
                if is_valid
                else EnrichmentSignals()  # 👈 always default false
            )

            return LlmsTxtMeta(
                exists=True,
                is_valid=is_valid,
                enriched=enriched,
                status=200
            )

        elif resp.status_code == 404:
            return LlmsTxtMeta(
                exists=False,
                is_valid=False,
                enriched=EnrichmentSignals(),
                status=404
            )

        else:
            return LlmsTxtMeta(
                exists=False,
                is_valid=False,
                enriched=EnrichmentSignals(),
                status=resp.status_code
            )

    except httpx.RequestError:
        return LlmsTxtMeta(
            exists=False,
            is_valid=False,
            enriched=EnrichmentSignals(),
            status=None
        )

# -------------------------
# Main function
# -------------------------
async def find_llm_txt_signals(full_domain: str) -> LlmsTxtSignals:
    llm_txts = await fetch_llm_txt(full_domain)
    return LlmsTxtSignals(llm_txts=llm_txts)

# -------------------------
# CLI test
# -------------------------
if __name__ == "__main__":
    import asyncio
    import json

    result = asyncio.run(
        find_llm_txt_signals("https://www.myntra.com")
    )

    print(json.dumps(result.dict(), indent=2))