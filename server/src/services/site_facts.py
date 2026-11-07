"""Compact, human-readable facts about a website extracted from its signals (stored on the snapshot).

Gives the Competitor tab the same domain-level picture the brand dashboard has (robots.txt, llms.txt,
sitemap, AI crawler access, crawlability, structured data) and, above all, tells "missing" from
"blocked by bot protection" - the latter means the signal could not be assessed.
"""
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

BLOCKING_STATUSES = {401, 403, 429}


def _http_state(exists: bool, status: Optional[int]) -> str:
    if exists:
        return "ok"
    if status in BLOCKING_STATUSES or (status is not None and status >= 500) or status is None or status == 0:
        return "blocked" if status is not None and status != 0 and status != 404 else "unknown"
    return "missing"


def _crawler_summary(group: Any) -> Optional[dict]:
    agents = getattr(group, "agents", None)
    if not agents:
        return None
    blocked = [a.agent for a in agents if not all(c.is_accessible for c in a.category_access)]
    return {"total": len(agents), "allowed": len(agents) - len(blocked), "blocked_agents": blocked}


def extract_site_facts(signals: Any) -> dict:
    """Best effort: facts are descriptive extras, so a surprise in the signal shape must never fail an audit."""
    facts: dict = {}
    try:
        _fill_facts(signals, facts)
    except Exception:
        logger.exception("Could not extract all site facts")
    return facts


def _fill_facts(signals: Any, facts: dict) -> None:
    domain = getattr(signals, "domain_signals", None)

    robots = getattr(domain, "robots_txt_signal", None)
    if robots is not None and not isinstance(robots, Exception):
        meta = robots.robots
        facts["robots"] = {"state": _http_state(meta.exists, meta.status), "http": meta.status}
        facts["ai_crawlers"] = _crawler_summary(robots.ai_crawlers)
        facts["search_crawlers"] = _crawler_summary(robots.search_crawlers)

    llms = getattr(domain, "llms_txt_signal", None)
    if llms is not None and not isinstance(llms, Exception):
        meta = llms.llm_txts
        state = "ok" if meta.exists and meta.is_valid else "present_invalid" if meta.exists else _http_state(False, meta.status)
        facts["llms_txt"] = {"state": state, "http": meta.status}

    sitemap = getattr(domain, "site_map_signal", None)
    if sitemap is not None and not isinstance(sitemap, Exception):
        sm = sitemap.sitemap
        facts["sitemap"] = {
            "state": _http_state(sm.exists, sm.status), "http": sm.status, "type": sm.type_,
            "last_updated": sitemap.last_updated.isoformat() if sitemap.last_updated else None,
        }

    site = getattr(signals, "site_signals", None)
    if site is not None:
        facts["site"] = {
            "scrapable": bool(getattr(site, "is_scrapable", False)),
            "pages_analysed": len(getattr(site, "site_signals", None) or []),
            "issue": getattr(site, "issue_found", None),
        }
        jsonld = [t.type_ for t in (getattr(site, "jsonld_signals", None) or []) if getattr(t, "exists", False)]
        facts["jsonld_types"] = sorted(set(jsonld))

    causes = " ".join(filter(None, [
        getattr(robots, "cause_of_issue", None), getattr(llms, "cause_of_issue", None),
        getattr(site, "cause_of_issue", None),
    ])).lower()
    facts["blocked_by_protection"] = "bot protection" in causes or "blocking" in causes
