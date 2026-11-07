"""Housekeeping for the store: retention, purging soft-deleted comparisons, orphaned snapshots.

Safe to run repeatedly (idempotent). Runs at start-up and then periodically from the API process.
"""
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Dict

from src.services.run_persistence import delete_comparison_artifacts, release_snapshot, snapshot_in_use
from src.storage import Storage

logger = logging.getLogger(__name__)

REMOVED_COMPARISON_DAYS = float(os.getenv("REMOVED_COMPARISON_DAYS", "30"))
ORPHAN_SNAPSHOT_HOURS = float(os.getenv("ORPHAN_SNAPSHOT_HOURS", "24"))
MAINTENANCE_INTERVAL_HOURS = float(os.getenv("MAINTENANCE_INTERVAL_HOURS", "6"))


def run_maintenance(storage: Storage, run_service) -> Dict[str, int]:
    now = datetime.now(timezone.utc)
    result = {"brands_pruned": 0, "comparisons_purged": 0, "snapshots_removed": 0}

    # 1. retention: keep the newest RUN_RETENTION runs per brand
    for brand in storage.brands.list_all():
        run_service._apply_retention(brand.brand_id)
        result["brands_pruned"] += 1

    # 2. soft-deleted comparisons older than REMOVED_COMPARISON_DAYS are removed for good
    cutoff = (now - timedelta(days=REMOVED_COMPARISON_DAYS)).isoformat()
    for row in storage.comparisons.list_removed_before(cutoff):
        delete_comparison_artifacts(storage, row)
        result["comparisons_purged"] += 1

    # 3. snapshots nothing refers to any more (e.g. a crash between creating a snapshot and linking it)
    orphan_cutoff = now - timedelta(hours=ORPHAN_SNAPSHOT_HOURS)
    for snap in storage.snapshots.list_all():
        if datetime.fromisoformat(snap.taken_at) < orphan_cutoff and not snapshot_in_use(storage, snap.snapshot_id):
            release_snapshot(storage, snap.snapshot_id)
            result["snapshots_removed"] += 1

    logger.info("Maintenance finished: %s", result)
    return result
