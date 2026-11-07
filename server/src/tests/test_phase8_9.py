import asyncio
import json
import os
import tempfile
import time
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient

import src.api.competitors as comp_api
import src.api.runs as runs_api
import src.services.audit_run_service as svc_mod
import src.storage.migrations as migrations
from src.services.audit_run_service import AuditRunService
from src.services.competitor_comparison_service import CompetitorComparisonService
from src.services.maintenance import run_maintenance
from src.services.run_persistence import scoring_config_hash
from src.services.visibility_service import VisibilityService
from src.storage import ComparisonStatus, SiteSnapshotRow, build_storage, models
from src.storage.ids import new_id
from src.tests.test_competitors_api import API, make_finished_run
from src.tests.test_visibility import BRAND, COMPETITORS
from src.tests.test_runs_api import BODY, fake_report


class Base(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.storage = build_storage(self._tmp.name)
        self.runs = AuditRunService(self.storage)
        runs_api._service = self.runs
        comp_api._service = CompetitorComparisonService(self.storage, self.runs.executor)
        self.calls = []

        async def fake_audit(svc_self, row, run, reporter):
            self.calls.append(row.domain)
            await asyncio.sleep(0.05)
            sid = new_id()
            svc_self.storage.snapshots.insert(SiteSnapshotRow(
                snapshot_id=sid, site_id=row.site_id, site_types_key="ecommerce", technical_percentage=50.0,
                scoring_config_hash=scoring_config_hash()))
            return sid

        self._p = patch.object(CompetitorComparisonService, "_technical_audit", fake_audit)
        self._p.start()

    def tearDown(self):
        self._p.stop()
        runs_api._service = comp_api._service = None
        self._tmp.cleanup()

    def wait_done(self, c, run_id, timeout=5):
        end = time.time() + timeout
        while time.time() < end:
            ov = c.get(f"{API}/runs/{run_id}/competitors").json()
            if all(e["status"] not in ("pending", "running") for e in ov["entries"]):
                return ov
            time.sleep(0.05)
        self.fail("timeout")


class Phase8Tests(Base):
    def test_ai_sections_cover_only_the_brand_and_the_added_competitors(self):
        from src.main import app
        rid = make_finished_run(self.storage, BRAND, "alo.com", "r1")
        with TestClient(app) as c:
            c.post(f"{API}/runs/{rid}/competitors", json={"name": "Adidas", "domain": "adidas.com"})
            ov = self.wait_done(c, rid)
        kinds = {v["entity"]: v["kind"] for v in ov["visibility_set"]}
        self.assertEqual(kinds, {BRAND: "brand", "Adidas": "added"})          # AI-discovered rivals are not in the comparison
        self.assertAlmostEqual(sum(v["sov"] for v in ov["visibility_set"]), 100.0, delta=0.5)
        self.assertEqual({e["name"] for e in ov["visibility_summary"]["entities"]}, {BRAND, "Adidas"})
        self.assertEqual(set(ov["visibility_summary"]["clusters"][0]["counts"]), {BRAND, "Adidas"})
        self.assertEqual(ov["brand"]["ai"]["signals"][1]["total"], 3)
        self.assertIsNotNone(ov["entries"][0]["ai"])
        offered = {o["name"] for o in ov["options"]}
        self.assertTrue(set(COMPETITORS) <= offered)                           # but the dropdown still offers them

    def test_carry_over_offer_and_copy_to_new_run(self):
        from src.main import app
        old = make_finished_run(self.storage, BRAND, "alo.com", "r_old")
        with TestClient(app) as c:
            for n, d in (("Adidas", "adidas.com"), ("Puma", "puma.com")):
                c.post(f"{API}/runs/{old}/competitors", json={"name": n, "domain": d})
            self.wait_done(c, old)
            self.assertIsNone(c.get(f"{API}/runs/{old}/competitors").json()["carry_over"])  # has entries itself

            self.storage.runs.update(old, requested_at="2026-01-01T00:00:00+00:00")
            new = make_finished_run(self.storage, BRAND, "alo.com", "r_new")  # newer run, same brand
            offer = c.get(f"{API}/runs/{new}/competitors").json()["carry_over"]
            self.assertEqual((offer["from_run_id"], offer["count"]), (old, 2))

            res = c.post(f"{API}/runs/{new}/competitors/carry-over").json()
            self.assertEqual((res["requested"], res["reused"], res["started"]), (2, 2, 0))  # fresh snapshots reused
            ov = c.get(f"{API}/runs/{new}/competitors").json()
            self.assertEqual({e["name"] for e in ov["entries"]}, {"Adidas", "Puma"})
            self.assertTrue(all(e["status"] == "done" and e["visibility"] is not None for e in ov["entries"]))
            self.assertEqual(self.calls.count("adidas.com"), 1)  # not crawled again
            self.assertIsNone(ov["carry_over"])
            self.assertEqual(c.post(f"{API}/runs/{make_finished_run(self.storage, 'Lonely', 'l.com', 'r3')}/competitors/carry-over").status_code, 404)

    def test_carry_over_respects_cap(self):
        from src.main import app
        old = make_finished_run(self.storage, BRAND, "alo.com", "r_old")
        with patch("src.services.competitor_comparison_service.MAX_COMPETITORS", 3), TestClient(app) as c:
            for i in range(3):
                c.post(f"{API}/runs/{old}/competitors", json={"name": f"C{i}", "domain": f"c{i}.com"})
            self.wait_done(c, old)
            self.storage.runs.update(old, requested_at="2026-01-01T00:00:00+00:00")
            new = make_finished_run(self.storage, BRAND, "alo.com", "r_new")
            c.post(f"{API}/runs/{new}/competitors", json={"name": "Z", "domain": "z.com"})
            res = c.post(f"{API}/runs/{new}/competitors/carry-over").json()
            self.assertEqual((res["requested"], len(res["skipped"])), (3, 1))  # cap 3: Z + two carried, one skipped

    def test_visibility_trend_per_brand(self):
        from src.main import app
        make_finished_run(self.storage, BRAND, "alo.com", "r1")
        make_finished_run(self.storage, BRAND, "alo.com", "r2")
        make_finished_run(self.storage, "Other", "o.com", "r3")
        brand = self.storage.brands.get_by_name(BRAND)
        trend = VisibilityService(self.storage).trend_for_brand(brand.brand_id)
        self.assertEqual({p["run_id"] for p in trend}, {"r1", "r2"})
        self.assertEqual(trend, sorted(trend, key=lambda p: p["measured_at"]))
        self.assertEqual(trend[0]["percentage"], 61.0)
        with TestClient(app) as c:
            api_trend = c.get(f"{API}/brands/{brand.brand_id}/visibility-trend").json()
            self.assertEqual(len(api_trend), 2)
            self.assertEqual(c.get(f"{API}/brands/nope/visibility-trend").status_code, 404)


class Phase9Tests(Base):
    def test_maintenance_purges_old_removed_comparisons_and_orphans_only(self):
        rid = make_finished_run(self.storage, BRAND, "alo.com", "r1")
        svc = comp_api.get_comparison_service()

        async def go():
            row, _ = svc.add(rid, "Adidas", "adidas.com")
            await asyncio.sleep(0.3)
            return row
        row = asyncio.run(go())
        # one soft-deleted long ago, plus an old orphan snapshot and a fresh orphan snapshot
        old = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
        svc.remove(rid, row.comparison_id)
        self.storage.comparisons.update(row.comparison_id, removed_at=old)
        site = self.storage.sites.get_or_create("orphan.com")
        mk = lambda taken: self.storage.snapshots.insert(SiteSnapshotRow(
            snapshot_id=new_id(), site_id=site.site_id, site_types_key="x", taken_at=taken))
        old_orphan = mk(old); fresh_orphan = mk(datetime.now(timezone.utc).isoformat())

        res = run_maintenance(self.storage, self.runs)
        self.assertEqual(res["comparisons_purged"], 1)
        self.assertIsNone(self.storage.comparisons.get(row.comparison_id))
        self.assertIsNone(self.storage.snapshots.get(old_orphan.snapshot_id))
        self.assertIsNotNone(self.storage.snapshots.get(fresh_orphan.snapshot_id))  # too young to collect
        self.assertEqual(run_maintenance(self.storage, self.runs)["comparisons_purged"], 0)  # idempotent

    def test_migration_hook(self):
        root = self._tmp.name
        self.assertEqual(migrations.read_version(root), models.SCHEMA_VERSION)
        applied = []
        with patch.object(models, "SCHEMA_VERSION", 2), patch.dict(migrations.MIGRATIONS, {1: lambda r: applied.append(r)}):
            self.assertEqual(migrations.migrate(root), 1)
            self.assertEqual(applied, [root])
            self.assertEqual(migrations.read_version(root), 2)
            self.assertEqual(migrations.migrate(root), 0)  # already current
        with patch.object(models, "SCHEMA_VERSION", 1):
            with self.assertRaises(RuntimeError):  # data newer than the code
                migrations.migrate(root)
        with patch.object(models, "SCHEMA_VERSION", 3), patch.dict(migrations.MIGRATIONS, {}, clear=True):
            migrations.write_version(root, 2)
            with self.assertRaises(RuntimeError):  # missing step
                migrations.migrate(root)

    def test_concurrent_runs_respect_limit_and_leave_store_consistent(self):
        from src.main import app
        state = {"now": 0, "max": 0}

        async def fake_pipeline(svc_self, run, brand_name, reporter):
            state["now"] += 1; state["max"] = max(state["max"], state["now"])
            reporter.stage_start("domain_signals")
            await asyncio.sleep(0.15)
            reporter.stage_done("domain_signals")
            state["now"] -= 1
            return fake_report(run, brand_name)

        self.runs.executor = type(self.runs.executor)(max_concurrent=2)
        brands = [f"Brand {i}" for i in range(8)]
        with patch.object(AuditRunService, "_pipeline", fake_pipeline), TestClient(app) as c:
            ids = [c.post(f"{API}/audit", json={**BODY, "brand": b}).json()["run_id"] for b in brands]
            end = time.time() + 15
            while time.time() < end:
                sts = [c.get(f"{API}/runs/{i}/status").json()["status"] for i in ids]
                if all(s == "completed" for s in sts):
                    break
                time.sleep(0.1)
            self.assertTrue(all(s == "completed" for s in sts), sts)
        self.assertLessEqual(state["max"], 2)
        self.assertEqual(len(set(ids)), 8)
        for rid in ids:  # every run has a report and no leftover active key
            run = self.storage.runs.get(rid)
            self.assertTrue(run.report_blob_key and run.active_key is None)


if __name__ == "__main__":
    unittest.main()


class PromptsEndpointTests(Base):
    def test_endpoint_available_and_unavailable_and_404(self):
        from src.main import app
        rid = make_finished_run(self.storage, BRAND, "alo.com", "r1")
        no_ai = make_finished_run(self.storage, "NoAI Co", "noai.com", "r2", with_ai=False)
        with TestClient(app) as c:
            ok = c.get(f"{API}/runs/{rid}/prompts").json()
            self.assertTrue(ok["available"])
            self.assertEqual(ok["prompt_count"], 5)
            self.assertEqual(ok["entities"][0], {"name": BRAND, "kind": "brand"})
            off = c.get(f"{API}/runs/{no_ai}/prompts").json()
            self.assertEqual((off["available"], off["clusters"]), (False, []))
            self.assertEqual(c.get(f"{API}/runs/nope/prompts").status_code, 404)
