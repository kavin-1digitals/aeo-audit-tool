"""Local-disk blob store: large JSON payloads referenced from table rows by key.

Keys look like ``runs/<run_id>/report.json``; they are validated so they can never escape the root.
"""
import json
import os
import shutil
import tempfile
from typing import Any, Optional


class LocalBlobStore:
    def __init__(self, root: str):
        self._root = os.path.abspath(root)
        os.makedirs(self._root, exist_ok=True)

    def _path(self, key: str) -> str:
        path = os.path.abspath(os.path.join(self._root, key))
        if not path.startswith(self._root + os.sep):
            raise ValueError(f"Invalid blob key: {key!r}")
        return path

    def put(self, key: str, payload: Any) -> str:
        path = self._path(key)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False)
            os.replace(tmp, path)
        except Exception:
            if os.path.exists(tmp):
                os.remove(tmp)
            raise
        return key

    def get(self, key: str) -> Optional[Any]:
        path = self._path(key)
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def delete(self, key: str) -> None:
        path = self._path(key)
        if os.path.exists(path):
            os.remove(path)

    def delete_prefix(self, prefix: str) -> None:
        path = self._path(prefix)
        if os.path.isdir(path):
            shutil.rmtree(path)
        elif os.path.exists(path):
            os.remove(path)
