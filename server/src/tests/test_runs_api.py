import asyncio
import tempfile
import time
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

import src.api.runs as runs_api
from src.api.schemas import AuditResponse
from src.scorecard import RawScoreCard, ScoreCard
from src.services.audit_run_service import AuditRunService
from src.storage import RunStatus, build_storage
from src.summary import Summary

BODY = {"domain": "https://alo.com", "brand": "Alo Yoga", "geo": "United States", "site_types": ["ecommerce"]}


def fake_report(run, brand):
    return AuditResponse(
        task_id=run.run_id, status="completed", message="ok", domain=run.requested_url, brand=brand, geo=run.geo,
        scorecard=ScoreCard(raw_scorecard=RawScoreCard(scores=[]), path_scorecard={}, total_checks=0,
                            total_score=0.0, total_percentage=0.0, percentage=42.0),
        summary=Summary(performance_highlights=[], improvement_areas=[]),
    )


class RunsApiTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.storage = build_storage(self._tmp.name)
        self.service = AuditRunService(self.storage)
        runs_api._service = self.service
        self.behaviour = {"delay": 0.3, "warn": False, "crash": False}

        async def fake_pipeline(svc_self, run, brand_name, reporter):
            reporter.stage_start("domain_signals")
            await asyncio.sleep(self.behaviour["delay"])
            if self.behaviour["crash"]:
                raise RuntimeError("boom")
            reporter.stage_done("domain_signals")
            if self.behaviour["warn"]:
                reporter.warn("AI unavailable")
            return fake_report(run, brand_name)

        self._p = patch.object(AuditRunService, "_pipeline", fake_pipeline)
        self._p.start()

    def tearDown(self):
        self._p.stop()
        runs_api._service = None
        self._tmp.cleanup()

    def _wait(self, client, run_id, timeout=5):
        end = time.time() + timeout
        while time.time() < end:
            st = client.get(f"/aeo-audit-tool/api/runs/{run_id}/status").json()
            if st["status"] not in ("pending", "running"):
                return st
            time.sleep(0.05)
        self.fail("run did not finish")

    def test_async_start_poll_report_and_idempotency(self):
        from src.main import app
        with TestClient(app) as c:
            t0 = time.time()
            r = c.post("/aeo-audit-tool/api/audit", json=BODY)
            self.assertLess(time.time() - t0, 0.25)  # returns immediately
            self.assertEqual(r.status_code, 202)
            run_id = r.json()["run_id"]

            dup = c.post("/aeo-audit-tool/api/audit", json=BODY)  # second click while running
            self.assertEqual(dup.status_code, 200)
            self.assertEqual(dup.json()["run_id"], run_id)
            self.assertTrue(dup.json()["reused_active"])

            st = self._wait(c, run_id)
            self.assertEqual(st["status"], "completed")
            self.assertEqual(st["progress_pct"], 100.0)
            self.assertEqual(st["brand"], "Alo Yoga")
            rep = c.get(f"/aeo-audit-tool/api/runs/{run_id}")
            self.assertEqual(rep.status_code, 200)
            self.assertEqual(rep.json()["task_id"], run_id)

            again = c.post("/aeo-audit-tool/api/audit", json={**BODY, "mode": "reuse_latest"})
            self.assertEqual(again.json()["run_id"], run_id)
            self.assertTrue(again.json()["reused"])

            new = c.post("/aeo-audit-tool/api/audit", json=BODY)  # explicit new run
            self.assertEqual(new.status_code, 202)
            self.assertNotEqual(new.json()["run_id"], run_id)
            self._wait(c, new.json()["run_id"])

    def test_pipeline_crash_marks_failed(self):
        from src.main import app
        self.behaviour["crash"] = True
        with TestClient(app) as c:
            run_id = c.post("/aeo-audit-tool/api/audit", json=BODY).json()["run_id"]
            st = self._wait(c, run_id)
            self.assertEqual(st["status"], "failed")
            self.assertEqual(st["error"]["code"], "pipeline_error")
            self.assertEqual(c.get(f"/aeo-audit-tool/api/runs/{run_id}").status_code, 409)
            # failed run frees the active key: retry starts a new run
            self.assertEqual(c.post("/aeo-audit-tool/api/audit", json=BODY).status_code, 202)

    def test_warning_gives_completed_with_warnings(self):
        from src.main import app
        self.behaviour["warn"] = True
        with TestClient(app) as c:
            run_id = c.post("/aeo-audit-tool/api/audit", json=BODY).json()["run_id"]
            st = self._wait(c, run_id)
            self.assertEqual(st["status"], "completed_with_warnings")
            self.assertEqual(st["warnings"], ["AI unavailable"])

    def test_cancel(self):
        from src.main import app
        self.behaviour["delay"] = 2
        with TestClient(app) as c:
            run_id = c.post("/aeo-audit-tool/api/audit", json=BODY).json()["run_id"]
            time.sleep(0.1)
            self.assertTrue(c.post(f"/aeo-audit-tool/api/runs/{run_id}/cancel").json()["cancelled"])
            self.assertEqual(c.get(f"/aeo-audit-tool/api/runs/{run_id}/status").json()["status"], "cancelled")

    def test_startup_recovery_marks_interrupted(self):
        from src.main import app
        brand = self.storage.brands.get_or_create("Zed"); site = self.storage.sites.get_or_create("zed.com")
        from src.storage import AuditRunRow
        self.storage.runs.insert(AuditRunRow(run_id="stale", brand_id=brand.brand_id, site_id=site.site_id,
                                             requested_url="https://zed.com", status=RunStatus.RUNNING, active_key="x"))
        with TestClient(app) as c:  # lifespan runs recovery
            st = c.get("/aeo-audit-tool/api/runs/stale/status").json()
            self.assertEqual(st["status"], "failed")
            self.assertEqual(st["error"]["code"], "interrupted")

    def test_unknown_run_404(self):
        from src.main import app
        with TestClient(app) as c:
            self.assertEqual(c.get("/aeo-audit-tool/api/runs/nope/status").status_code, 404)


if __name__ == "__main__":
    unittest.main()
