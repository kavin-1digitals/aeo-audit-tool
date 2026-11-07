"""Small helpers shared by the storage layer (ids, timestamps, name/domain cleanup)."""
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse


def new_id() -> str:
    """Opaque string primary key (DB-ready: maps to a UUID/VARCHAR column)."""
    return uuid.uuid4().hex


def utcnow() -> str:
    """Current UTC time as ISO-8601 string (maps to TIMESTAMPTZ later)."""
    return datetime.now(timezone.utc).isoformat()


def clean_name(name: str) -> str:
    """Brand / competitor names are used exactly as typed - only surrounding whitespace is removed."""
    return (name or "").strip()


def normalise_domain(url_or_host: str) -> str:
    """Host of a URL, lower-cased, without a leading ``www.`` (``https://WWW.Shop.com/x`` -> ``shop.com``)."""
    raw = (url_or_host or "").strip()
    if "://" not in raw:
        raw = f"https://{raw}"
    host = (urlparse(raw).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host
