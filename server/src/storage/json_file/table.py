"""Generic file-backed "table": a JSON file holding a list of pydantic rows.

Features that mimic what a SQL table gives us: primary key, unique constraints (None is ignored,
like SQL NULLs), atomic persistence (temp file + os.replace, previous version kept as ``.bak``),
and thread-safe access. Valid for a single server process (documented limit); a SQL adapter
removes the limitation without touching callers.
"""
import json
import logging
import os
import tempfile
import threading
from typing import Callable, Dict, Generic, Iterable, List, Optional, Sequence, Tuple, Type, TypeVar

from pydantic import BaseModel

from ..interfaces import NotFound, UniqueViolation

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)


class JsonTable(Generic[T]):
    def __init__(
        self,
        path: str,
        model: Type[T],
        key_fn: Callable[[T], str],
        unique: Sequence[Tuple[str, ...]] = (),
    ):
        self._path = path
        self._model = model
        self._key_fn = key_fn
        self._unique = [tuple(u) for u in unique]
        self._lock = threading.RLock()
        self._rows: Dict[str, T] = {}
        self._load()

    # ---------------- persistence ----------------
    def _load(self) -> None:
        if not os.path.exists(self._path):
            return
        try:
            with open(self._path, "r", encoding="utf-8") as f:
                raw = json.load(f)
        except (json.JSONDecodeError, OSError) as exc:
            bak = self._path + ".bak"
            logger.error("Table file %s unreadable (%s); trying backup", self._path, exc)
            if not os.path.exists(bak):
                raise RuntimeError(f"Corrupt table file {self._path} and no backup available") from exc
            with open(bak, "r", encoding="utf-8") as f:
                raw = json.load(f)
        for item in raw:
            row = self._model.model_validate(item)
            self._rows[self._key_fn(row)] = row

    def _flush(self) -> None:
        os.makedirs(os.path.dirname(self._path), exist_ok=True)
        payload = [r.model_dump(mode="json") for r in self._rows.values()]
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(self._path), suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False)
            if os.path.exists(self._path):
                os.replace(self._path, self._path + ".bak")
            os.replace(tmp, self._path)
        except Exception:
            if os.path.exists(tmp):
                os.remove(tmp)
            raise

    # ---------------- constraints ----------------
    def _check_unique(self, row: T, ignore_key: Optional[str] = None) -> None:
        for cols in self._unique:
            values = tuple(getattr(row, c) for c in cols)
            if any(v is None for v in values):
                continue
            for key, other in self._rows.items():
                if key == ignore_key:
                    continue
                if tuple(getattr(other, c) for c in cols) == values:
                    raise UniqueViolation(f"Unique constraint {cols} violated with value {values}")

    # ---------------- API ----------------
    def get(self, key: str) -> Optional[T]:
        with self._lock:
            row = self._rows.get(key)
            return row.model_copy(deep=True) if row else None

    def all(self) -> List[T]:
        with self._lock:
            return [r.model_copy(deep=True) for r in self._rows.values()]

    def find(self, predicate: Callable[[T], bool]) -> List[T]:
        with self._lock:
            return [r.model_copy(deep=True) for r in self._rows.values() if predicate(r)]

    def insert(self, row: T) -> T:
        with self._lock:
            key = self._key_fn(row)
            if key in self._rows:
                raise UniqueViolation(f"Primary key {key} already exists")
            self._check_unique(row)
            self._rows[key] = row.model_copy(deep=True)
            self._flush()
            return row

    def insert_many(self, rows: Iterable[T]) -> None:
        with self._lock:
            staged = []
            for row in rows:
                key = self._key_fn(row)
                if key in self._rows:
                    raise UniqueViolation(f"Primary key {key} already exists")
                self._check_unique(row)
                self._rows[key] = row.model_copy(deep=True)
                staged.append(key)
            if staged:
                self._flush()

    def upsert(self, row: T) -> T:
        with self._lock:
            key = self._key_fn(row)
            self._check_unique(row, ignore_key=key)
            self._rows[key] = row.model_copy(deep=True)
            self._flush()
            return row

    def upsert_many(self, rows: Iterable[T]) -> None:
        with self._lock:
            changed = False
            for row in rows:
                key = self._key_fn(row)
                self._check_unique(row, ignore_key=key)
                self._rows[key] = row.model_copy(deep=True)
                changed = True
            if changed:
                self._flush()

    def update(self, key: str, **fields) -> T:
        with self._lock:
            current = self._rows.get(key)
            if current is None:
                raise NotFound(f"Row {key} not found in {os.path.basename(self._path)}")
            updated = self._model.model_validate({**current.model_dump(), **fields})
            self._check_unique(updated, ignore_key=key)
            self._rows[key] = updated
            self._flush()
            return updated.model_copy(deep=True)

    def delete(self, key: str) -> None:
        with self._lock:
            if self._rows.pop(key, None) is not None:
                self._flush()

    def delete_where(self, predicate: Callable[[T], bool]) -> int:
        with self._lock:
            doomed = [k for k, r in self._rows.items() if predicate(r)]
            for k in doomed:
                del self._rows[k]
            if doomed:
                self._flush()
            return len(doomed)
