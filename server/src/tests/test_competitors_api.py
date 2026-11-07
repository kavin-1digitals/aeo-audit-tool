import asyncio
import tempfile
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

import src.api.competitors as comp_api
import src.api.runs as runs_api
import src.services.competitor_comparison_service as cmp_mod
from src.services.audit_run_service import AuditRunService
from src.services.competitor_comparison_service import CompetitorComparisonService
from src.services.run_persistence import persist_run_artifacts, scoring_config_hash
from src.services.visibility_service import compute_market_comparison
from src.storage import AuditRunRow, RunStatus, SiteSnapshotRow, build_storage
from src.storage.ids import new_id
from src.tests.test_visibility import BRAND, COMPETITORS, build_answers

API = "/aeo-audit-tool/api"


def make_finished_run(storage, brand_name, domain, run_id, with_ai=True):
    brand = storage.brands.get_or_create(brand_name); site = storage.sites.get_or_create(domain)
    run = AuditRunRow(run_id=run_id, brand_id=brand.brand_id, site_id=site.site_id, requested_url=f"https://{domain}",
                      geo="US", site_types=["ecommerce"], status=RunStatus.COMPLETED, percentage=61.0)
    storage.runs.insert(run)
    answers = build_answers(brand_name)
    mc = compute_market_comparison(answers, [brand_name, *COMPETITORS])
    wrap = lambda rows: [SimpleNamespace(model_dump=lambda r=r: r, **r) for r in rows]
    llm = SimpleNamespace(status=True, signals=SimpleNamespace(
        citation_prompt_answers=answers, competitors=COMPETITORS, market_comparison_combined=wrap(mc["combined"]),
        market_comparison_web=wrap(mc["web"]), market_comparison_llm=wrap(mc["llm"]))) if with_ai else None
    report = SimpleNamespace(
        scorecard=SimpleNamespace(category_scores={
            "domain_signals": {"total_weightage_percentage": 20, "max_possible_total_weightage_percentage": 30},
            "site_signals": {"total_weightage_percentage": 20, "max_possible_total_weightage_percentage": 30}},
            raw_scorecard=SimpleNamespace(scores=[SimpleNamespace(
                signal_name="robots_txt_exists", model_dump=lambda mode=None: {"signal_name": "robots_txt_exists", "value": 1.0, "signal_path": ["Domain Signals"]})])),
        signals=SimpleNamespace(site_signals=SimpleNamespace(is_scrapable=True), llm_signals=llm))
    storage.runs.update(run_id, report_blob_key=storage.blobs.put(f"runs/{run_id}/report.json", {"x": 1}),
                        **persist_run_artifacts(storage, run, report))
    return run_id


class CompetitorApiTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.storage = build_storage(self._tmp.name)
        self.runs = AuditRunService(self.storage)
        runs_api._service = self.runs
        comp_api._service = CompetitorComparisonService(self.storage, self.runs.executor)
        self.calls, self.behaviour = [], {"delay": 0.15, "crash": False, "scrapable": True, "pct": 55.0}

        async def fake_audit(svc_self, row, run, reporter):
            self.calls.append(row.domain)
            reporter.stage_start("domain_signals"); await asyncio.sleep(self.behaviour["delay"])
            if self.behaviour["crash"]:
                raise RuntimeError("boom")
            reporter.stage_done("domain_signals")
            sid = new_id()
            svc_self.storage.snapshots.insert(SiteSnapshotRow(
                snapshot_id=sid, site_id=row.site_id, site_types_key="ecommerce", technical_percentage=self.behaviour["pct"],
                site_scrapable=self.behaviour["scrapable"], scoring_config_hash=scoring_config_hash(),
                payload_blob_key=svc_self.storage.blobs.put(f"snapshots/{sid}.json", {"scores": [
                    {"signal_name": "robots_txt_exists", "value": 1.0, "signal_path": ["Domain Signals"]}]})))
            return sid

        self._p = patch.object(CompetitorComparisonService, "_technical_audit", fake_audit)
        self._p.start()
        self.run_id = make_finished_run(self.storage, BRAND, "alo.com", "r1")

    def tearDown(self):
        self._p.stop()
        runs_api._service = None
        comp_api._service = None
        self._tmp.cleanup()

    def _post(self, c, name="Adidas", domain="adidas.com", run_id=None, **kw):
        return c.post(f"{API}/runs/{run_id or self.run_id}/competitors", json={"name": name, "domain": domain, **kw})

    def _wait_done(self, c, run_id=None, timeout=5):
        end = time.time() + timeout
        while time.time() < end:
            ov = c.get(f"{API}/runs/{run_id or self.run_id}/competitors").json()
            if all(e["status"] not in ("pending", "running") for e in ov["entries"]):
                return ov
            time.sleep(0.05)
        self.fail("competitor audit did not finish")

    def test_add_returns_immediately_then_appears_with_technical_and_visibility(self):
        from src.main import app
        with TestClient(app) as c:
            t0 = time.time()
            r = self._post(c, name=" Adidas ", domain="https://www.Adidas.com/men")
            self.assertLess(time.time() - t0, 0.2)
            self.assertEqual(r.status_code, 202)
            mid = c.get(f"{API}/runs/{self.run_id}/competitors").json()["entries"][0]
            self.assertIn(mid["status"], ("pending", "running"))

            ov = self._wait_done(c)
            e = ov["entries"][0]
            self.assertEqual((e["name"], e["domain"], e["status"]), ("Adidas", "adidas.com", "done"))
            self.assertEqual(e["technical"]["technical_percentage"], 55.0)
            self.assertEqual(e["technical"]["scores"][0]["signal_name"], "robots_txt_exists")
            self.assertEqual(e["visibility_status"], "scored")
            self.assertEqual(e["visibility"]["citations"], 0)  # typed name scored on the SAME prompts, no LLM
            self.assertEqual(ov["brand"]["technical"]["technical_percentage"], 66.7)
            self.assertEqual(ov["brand"]["visibility"]["entity"], BRAND)
            names = {o["name"]: o for o in ov["options"]}
            self.assertTrue(names["Adidas"]["added"] if "Adidas" in names else True)
            self.assertFalse(names["Nike"]["added"])  # discovered competitor offered in the dropdown
            self.assertEqual(ov["limit"], 5)

    def test_discovered_competitor_gets_real_visibility_numbers(self):
        from src.main import app
        with TestClient(app) as c:
            self._post(c, name="Nike", domain="nike.com")
            e = self._wait_done(c)["entries"][0]
            self.assertEqual(e["visibility"]["citations"], 4)

    def test_snapshot_reused_across_runs_and_brands(self):
        from src.main import app
        other = make_finished_run(self.storage, "Other Brand", "other.com", "r2")
        with TestClient(app) as c:
            self._post(c); self._wait_done(c)
            r = self._post(c, run_id=other)
            self.assertEqual(r.status_code, 200)
            self.assertTrue(r.json()["reused_snapshot"])
            self.assertEqual(self.calls, ["adidas.com"])  # crawled once
            self.assertEqual(self._wait_done(c, other)["entries"][0]["technical"]["technical_percentage"], 55.0)
            self._post(c, run_id=other, refresh=True)  # forced re-audit
            self._wait_done(c, other)
            self.assertEqual(self.calls, ["adidas.com", "adidas.com"])

    def test_validation_cap_and_idempotency(self):
        from src.main import app
        with TestClient(app) as c:
            self.assertEqual(self._post(c, domain="not a url").status_code, 422)
            self.assertEqual(self._post(c, name="  ").status_code, 422)
            self.assertEqual(self._post(c, run_id="nope").status_code, 404)
            for i in range(5):
                self.assertEqual(self._post(c, name=f"C{i}", domain=f"c{i}.com").status_code, 202)
            self.assertEqual(self._post(c, name="C6", domain="c6.com").status_code, 409)
            again = self._post(c, name="C0", domain="https://www.c0.com")  # same domain: no new entry, no error
            self.assertIn(again.status_code, (200, 202))
            ov = self._wait_done(c)
            self.assertEqual(len(ov["entries"]), 5)
            self.assertEqual(self.calls.count("c0.com"), 1)

    def test_unfinished_run_rejected(self):
        from src.main import app
        brand = self.storage.brands.get_or_create("Pending Co"); site = self.storage.sites.get_or_create("pend.com")
        self.storage.runs.insert(AuditRunRow(run_id="p1", brand_id=brand.brand_id, site_id=site.site_id,
                                             requested_url="https://pend.com", status=RunStatus.RUNNING))
        with TestClient(app) as c:
            self.assertEqual(self._post(c, run_id="p1").status_code, 409)

    def test_remove_frees_slot_and_readd_reuses_snapshot(self):
        from src.main import app
        with TestClient(app) as c:
            self._post(c); ov = self._wait_done(c)
            cid = ov["entries"][0]["comparison_id"]
            self.assertTrue(c.delete(f"{API}/runs/{self.run_id}/competitors/{cid}").json()["removed"])
            self.assertEqual(c.get(f"{API}/runs/{self.run_id}/competitors").json()["entries"], [])
            self.assertEqual(c.delete(f"{API}/runs/{self.run_id}/competitors/{cid}").status_code, 404)
            again = self._post(c)  # re-adding the same domain reactivates it, reusing the still-fresh snapshot
            self.assertEqual((again.status_code, again.json()["reused_snapshot"]), (200, True))
            self.assertEqual(len(self._wait_done(c)["entries"]), 1)
            self.assertEqual(self.calls, ["adidas.com"])

    def test_failure_is_reported_and_retry_possible(self):
        from src.main import app
        self.behaviour["crash"] = True
        with TestClient(app) as c:
            self._post(c)
            e = self._wait_done(c)["entries"][0]
            self.assertEqual(e["status"], "failed")
            self.assertIn("boom", e["error"])
            self.behaviour["crash"] = False
            self._post(c)
            self.assertEqual(self._wait_done(c)["entries"][0]["status"], "done")

    def test_limited_data_snapshot_is_reused_only_briefly(self):
        from src.main import app
        limited = {"domain_signals": {"total_weightage_percentage": 0, "max_possible_total_weightage_percentage": 3,
                                      "signals": [{"signal_name": "s", "weightage_percentage": 30}]},
                   "site_signals": {"total_weightage_percentage": 0, "max_possible_total_weightage_percentage": 0,
                                    "signals": [{"signal_name": "t", "weightage_percentage": 30}]}}
        site = self.storage.sites.get_or_create("blocked.com")
        snap = self.storage.snapshots.insert(SiteSnapshotRow(
            snapshot_id="old", site_id=site.site_id, site_types_key="ecommerce", category_scores=limited,
            scoring_config_hash=scoring_config_hash()))
        with TestClient(app) as c:
            self.assertEqual(self._post(c, name="Blocked", domain="blocked.com").json()["reused_snapshot"], True)  # fresh
            cid = c.get(f"{API}/runs/{self.run_id}/competitors").json()["entries"][0]["comparison_id"]
            c.delete(f"{API}/runs/{self.run_id}/competitors/{cid}")
            from datetime import datetime, timedelta, timezone
            self.storage.snapshots.delete("old")
            self.storage.snapshots.insert(SiteSnapshotRow(
                snapshot_id="old2", site_id=site.site_id, site_types_key="ecommerce", category_scores=limited,
                taken_at=(datetime.now(timezone.utc) - timedelta(hours=3)).isoformat(), scoring_config_hash=scoring_config_hash()))
            r = self._post(c, name="Blocked", domain="blocked.com")  # 3 h old + limited data => crawled again
            self.assertEqual((r.status_code, r.json()["reused_snapshot"]), (202, False))
            self.assertEqual(self.calls, ["blocked.com"])

    def test_snapshot_view_carries_summary_and_facts(self):
        from src.main import app
        with TestClient(app) as c:
            self._post(c); e = self._wait_done(c)["entries"][0]
            self.assertIn("summary", e["technical"]); self.assertIn("facts", e["technical"])

    def test_blocked_site_is_flagged(self):
        from src.main import app
        self.behaviour["scrapable"] = False
        with TestClient(app) as c:
            self._post(c)
            self.assertFalse(self._wait_done(c)["entries"][0]["technical"]["site_scrapable"])

    def test_visibility_unavailable_without_stored_answers(self):
        from src.main import app
        rid = make_finished_run(self.storage, "NoAI Co", "noai.com", "r3", with_ai=False)
        with TestClient(app) as c:
            self._post(c, run_id=rid); e = self._wait_done(c, rid)["entries"][0]
            ov = c.get(f"{API}/runs/{rid}/competitors").json()
            self.assertFalse(ov["visibility_available"])
            self.assertEqual(e["visibility_status"], "unavailable")

    def test_interrupted_job_recovered_at_startup_and_run_delete_cascades(self):
        from src.main import app
        from src.storage import ComparisonStatus, CompetitorComparisonRow
        site = self.storage.sites.get_or_create("stale.com")
        self.storage.comparisons.insert(CompetitorComparisonRow(
            comparison_id="stale", run_id=self.run_id, competitor_name="Stale", requested_url="https://stale.com",
            domain="stale.com", site_id=site.site_id, status=ComparisonStatus.RUNNING))
        with TestClient(app) as c:
            self.assertEqual(c.get(f"{API}/runs/{self.run_id}/competitors").json()["entries"][0]["status"], "failed")
            self._post(c); self._wait_done(c)
            snap_ids = [e["technical"]["snapshot_id"] for e in c.get(f"{API}/runs/{self.run_id}/competitors").json()["entries"]
                        if e["technical"]]
            self.assertEqual(c.delete(f"{API}/runs/{self.run_id}").status_code, 200)
            self.assertEqual(self.storage.comparisons.list_for_run(self.run_id, include_removed=True), [])
            for sid in snap_ids:
                self.assertIsNone(self.storage.snapshots.get(sid))


if __name__ == "__main__":
    unittest.main()
