
from urllib.parse import urljoin
import httpx
from pydantic import BaseModel
from typing import Optional

# -------------------------
# Schema
# -------------------------
class LlmsTxtMeta(BaseModel):
    exists: bool
    status: Optional[int]

class LlmsTxtSignals(BaseModel):
    llm_txts: LlmsTxtMeta

# -------------------------
# Fetch llm.txt
# -------------------------
async def fetch_llm_txt(full_domain: str) -> LlmsTxtMeta:
    llm_txt_url = urljoin(full_domain, "/llm.txt")

    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(llm_txt_url)

        if resp.status_code == 200:
            return LlmsTxtMeta(exists=True, status=200)

        elif resp.status_code == 404:
            return LlmsTxtMeta(exists=False, status=404)

        else:
            return LlmsTxtMeta(exists=False, status=resp.status_code)

    except httpx.RequestError:
        return LlmsTxtMeta(exists=False, status=None)

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
        find_llm_txt_signals("https://www.vercel.com")
    )

    print(json.dumps(result.dict(), indent=2))