"""Runs audit jobs in the background of the API process.

``InProcessExecutor`` is the only implementation today; a queue-based executor (RQ/Celery/Arq) can
implement the same two methods later without touching the services or the API.
"""
import asyncio
import logging
from typing import Awaitable, Callable, Dict, Protocol

logger = logging.getLogger(__name__)


class RunExecutor(Protocol):
    """Port for running audit jobs. ``InProcessExecutor`` is the default; a queue-backed implementation
    (RQ / Celery / Arq + Redis) can replace it for multi-process deployments without touching callers."""

    def submit(self, job_id: str, job: Callable[[], Awaitable[None]]) -> None: ...
    def cancel(self, job_id: str) -> bool: ...
    def is_active(self, job_id: str) -> bool: ...


class InProcessExecutor:
    def __init__(self, max_concurrent: int = 2):
        self._sem = asyncio.Semaphore(max(1, max_concurrent))
        self._tasks: Dict[str, asyncio.Task] = {}

    def submit(self, run_id: str, job: Callable[[], Awaitable[None]]) -> None:
        async def _run():
            async with self._sem:  # run stays "pending" until a slot is free
                await job()

        task = asyncio.create_task(_run(), name=f"audit-run-{run_id}")
        self._tasks[run_id] = task
        task.add_done_callback(lambda t, rid=run_id: self._on_done(rid, t))

    def _on_done(self, run_id: str, task: asyncio.Task) -> None:
        self._tasks.pop(run_id, None)
        if not task.cancelled() and task.exception():
            logger.error("Run %s ended with unhandled error: %s", run_id, task.exception())

    def cancel(self, run_id: str) -> bool:
        task = self._tasks.get(run_id)
        if task and not task.done():
            task.cancel()
            return True
        return False

    def is_active(self, run_id: str) -> bool:
        task = self._tasks.get(run_id)
        return bool(task and not task.done())
