from pydantic import BaseModel
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse


class CanonicalSignal(BaseModel):
    canonical_url: str
    exists: bool
    matches_final_url: bool
    is_clean: bool


def normalize_url(url: str) -> str:
    parsed = urlparse(url)

    return (
        parsed.scheme + "://" +
        parsed.netloc +
        parsed.path.rstrip("/")
    )

async def find_canonical_signal(
    url: str,
    response_url: str,
    content: str
) -> CanonicalSignal:

    soup = BeautifulSoup(content, "html.parser")
    canonical_tag = soup.find("link", rel="canonical")

    if not canonical_tag or not canonical_tag.get("href"):
        return CanonicalSignal(
            canonical_url="",
            exists=False,
            matches_final_url=False,
            is_clean=False
        )

    canonical_url = canonical_tag.get("href").strip()

    # ✅ handle relative URL
    canonical_url = urljoin(response_url, canonical_url)

    # ✅ normalize both
    normalized_canonical = normalize_url(canonical_url)
    normalized_final = normalize_url(response_url)

    matches = normalized_canonical == normalized_final

    # ✅ clean URL check (no query params)
    is_clean = "?" not in canonical_url

    return CanonicalSignal(
        canonical_url=canonical_url,
        exists=True,
        matches_final_url=matches,
        is_clean=is_clean
    )