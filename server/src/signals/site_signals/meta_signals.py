from bs4 import BeautifulSoup
from pydantic import BaseModel
from typing import Optional


class MetaSignal(BaseModel):
    url: str
    og_title: Optional[str] = None
    og_description: Optional[str] = None
    og_image: Optional[str] = None
    og_type: Optional[str] = None
    og_url: Optional[str] = None
    twitter_card: Optional[str] = None
    twitter_title: Optional[str] = None
    twitter_image: Optional[str] = None
    og_exists: bool = False
    og_complete: bool = False
    twitter_card_exists: bool = False
    is_noindex: bool = False
    is_nofollow: bool = False


def find_meta_signal(url: str, content: str) -> MetaSignal:
    soup = BeautifulSoup(content, "html.parser")

    def get_meta(property_name: str, attr: str = "property") -> Optional[str]:
        tag = soup.find("meta", attrs={attr: property_name})
        if tag:
            return tag.get("content") or None
        return None

    og_title = get_meta("og:title")
    og_description = get_meta("og:description")
    og_image = get_meta("og:image")
    og_type = get_meta("og:type")
    og_url = get_meta("og:url")

    twitter_card = get_meta("twitter:card") or get_meta("twitter:card", attr="name")
    twitter_title = get_meta("twitter:title") or get_meta("twitter:title", attr="name")
    twitter_image = get_meta("twitter:image") or get_meta("twitter:image", attr="name")

    og_exists = any([og_title, og_description, og_image])
    og_complete = all([og_title, og_description, og_image, og_type, og_url])
    twitter_card_exists = twitter_card is not None

    # Check robots meta tag for noindex/nofollow
    robots_meta = get_meta("robots", attr="name") or ""
    is_noindex = "noindex" in robots_meta.lower()
    is_nofollow = "nofollow" in robots_meta.lower()

    return MetaSignal(
        url=url,
        og_title=og_title,
        og_description=og_description,
        og_image=og_image,
        og_type=og_type,
        og_url=og_url,
        twitter_card=twitter_card,
        twitter_title=twitter_title,
        twitter_image=twitter_image,
        og_exists=og_exists,
        og_complete=og_complete,
        twitter_card_exists=twitter_card_exists,
        is_noindex=is_noindex,
        is_nofollow=is_nofollow
    )
