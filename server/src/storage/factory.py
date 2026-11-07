"""Wiring: builds the repository bundle. Swap the adapter here to move to a real database."""
import os
from dataclasses import dataclass
from typing import Optional

from .interfaces import (
    BlobStore, BrandRepository, ComparisonRepository, CompetitorRepository, EventRepository, MentionRepository, PromptRepository,
    RunRepository, SiteRepository, SnapshotRepository, StageRepository, VisibilityRepository,
)
from .json_file.blob_store import LocalBlobStore
from .json_file.repositories import (
    JsonBrandRepository, JsonCompetitorRepository, JsonEventRepository, JsonPromptRepository,
    JsonComparisonRepository, JsonMentionRepository, JsonRunRepository, JsonSiteRepository, JsonSnapshotRepository, JsonStageRepository,
    JsonVisibilityRepository,
)
from . import models
from .migrations import migrate, write_version


@dataclass
class Storage:
    brands: BrandRepository
    sites: SiteRepository
    runs: RunRepository
    stages: StageRepository
    events: EventRepository
    snapshots: SnapshotRepository
    prompts: PromptRepository
    competitors: CompetitorRepository
    mentions: MentionRepository
    comparisons: ComparisonRepository
    visibility: VisibilityRepository
    blobs: BlobStore


def default_data_dir() -> str:
    return os.getenv("DATA_DIR") or os.path.join(os.path.dirname(__file__), "..", "..", "data")


def build_storage(data_dir: Optional[str] = None) -> Storage:
    root = os.path.abspath(data_dir or default_data_dir())
    tables = os.path.join(root, "tables")
    os.makedirs(tables, exist_ok=True)

    meta_path = os.path.join(root, "_meta.json")
    if not os.path.exists(meta_path):
        write_version(root, models.SCHEMA_VERSION)
    migrate(root)  # upgrades older data; refuses data written by a newer version

    return Storage(
        brands=JsonBrandRepository(tables),
        sites=JsonSiteRepository(tables),
        runs=JsonRunRepository(tables),
        stages=JsonStageRepository(tables),
        events=JsonEventRepository(tables),
        snapshots=JsonSnapshotRepository(tables),
        prompts=JsonPromptRepository(tables),
        competitors=JsonCompetitorRepository(tables),
        mentions=JsonMentionRepository(tables),
        comparisons=JsonComparisonRepository(tables),
        visibility=JsonVisibilityRepository(tables),
        blobs=LocalBlobStore(os.path.join(root, "blobs")),
    )


_storage: Optional[Storage] = None


def get_storage() -> Storage:
    """Process-wide singleton used by the API layer."""
    global _storage
    if _storage is None:
        _storage = build_storage()
    return _storage
