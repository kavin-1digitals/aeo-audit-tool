"""Schema-version migrations for the file-backed store.

``_meta.json`` records the schema version the data was written with. On start-up ``migrate`` upgrades
the data step by step (``MIGRATIONS[n]`` upgrades version ``n`` -> ``n + 1``) and refuses to open data
written by a NEWER version of the code. There are no migrations yet (version 1); add one here whenever
a table/column changes and bump ``SCHEMA_VERSION`` in ``models.py``.
"""
import json
import os
from typing import Callable, Dict

from . import models

# {from_version: function(root_dir) that upgrades the data on disk to from_version + 1}
MIGRATIONS: Dict[int, Callable[[str], None]] = {}


def read_version(root: str) -> int:
    path = os.path.join(root, "_meta.json")
    if not os.path.exists(path):
        return models.SCHEMA_VERSION
    with open(path, "r", encoding="utf-8") as f:
        return int(json.load(f).get("schema_version", 1))


def write_version(root: str, version: int) -> None:
    with open(os.path.join(root, "_meta.json"), "w", encoding="utf-8") as f:
        json.dump({"schema_version": version}, f)


def migrate(root: str) -> int:
    """Upgrade the data in ``root`` to the current schema; returns the number of migrations applied."""
    current, target = read_version(root), models.SCHEMA_VERSION
    if current > target:
        raise RuntimeError(
            f"Data in {root} uses schema v{current}, but this code only supports up to v{target}. "
            "Upgrade the application or restore a compatible backup."
        )
    applied = 0
    while current < target:
        step = MIGRATIONS.get(current)
        if step is None:
            raise RuntimeError(f"No migration registered for schema v{current} -> v{current + 1}")
        step(root)
        current += 1
        write_version(root, current)
        applied += 1
    return applied
