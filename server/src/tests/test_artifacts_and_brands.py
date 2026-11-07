import asyncio
import tempfile
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

import src.api.runs as runs_api
import src.services.audit_run_service as svc_mod
from src.services.audit_run_service import AuditRunService
from src.services.run_persistence import (
    delete_run_artifacts, persist_run_artifacts, technical_percentage,
)
from src.signals.llm_signals.citation_prompts_evaluator_chain import (
    CompetitorCitation, PromptAnswerCluster, PromptAnswerClusters, PromptAnswerDual,
)
from src.services.visibility_service import compute_market_comparison
from src.storage import AuditRunRow, RunStatus, build_storage
from src.tests.test_runs_api import BODY, fake_report


def answers():
    p = PromptAnswerDual(prompt="best yoga pants", web_answer="Alo Yoga, Nike", llm_answer="Nike",
                         web_entity_mentioned=True, llm_entity_mentioned=False,
                         competitor_citations_web=[CompetitorCitation(competitor_entity="Nike", is_competitor_mentioned=True)],
                         competitor_citations_llm=[CompetitorCitation(competitor_entity="Nike", is_competitor_mentioned=True)])
    return PromptAnswerClusters(root=[PromptAnswerCluster(cluster="c1", prompts=[p, p]),
                                      PromptAnswerCluster(cluster="c2", prompts=[p])])


def stub_report(with_llm=True):
    score = lambda name, v: SimpleNamespace(signal_name=name, model_dump=lambda mode=None, n=name, val=v: {"signal_name": n, "value": val})
    scorecard = SimpleNamespace(
        category_scores={
            "domain_signals": {"total_weightage_percentage": 15, "max_possible_total_weightage_percentage": 30},
            "site_signals": {"total_weightage_percentage": 15, "max_possible_total_weightage_percentage": 30},
            "llm_signals": {"total_weightage_percentage": 40, "max_possible_total_weightage_percentage": 40},
        },
        raw_scorecard=SimpleNamespace(scores=[score("robots_txt_exists", 1), score("cluster_presence", 1)]),
    )
    mc = compute_market_comparison(answers(), ["Alo Yoga", "Nike", "Lululemon"])
    as_models = lambda rows: [SimpleNamespace(model_dump=lambda r=r: r, **r) for r in rows]
    llm = SimpleNamespace(status=True, signals=SimpleNamespace(
        citation_prompt_answers=answers(), competitors=["Nike", " Lululemon "],
        market_comparison_combined=as_models(mc["combined"]), market_comparison_web=as_models(mc["web"]),
        market_comparison_llm=as_models(mc["llm"]))) if with_llm else None
    return SimpleNamespace(scorecard=scorecard, signals=SimpleNamespace(
        site_signals=SimpleNamespace(is_scrapable=True), llm_signals=llm))


class ArtifactTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.st = build_storage(self._tmp.name)
        b = self.st.brands.get_or_create("Alo Yoga"); s = self.st.sites.get_or_create("alo.com")
        self.run = AuditRunRow(run_id="r1", brand_id=b.brand_id, site_id=s.site_id, requested_url="https://alo.com",
                               geo="US", site_types=["ecommerce", "brand"], status=RunStatus.COMPLETED)
        self.st.runs.insert(self.run)

    def tearDown(self):
        self._tmp.cleanup()

    def test_technical_percentage_excludes_llm(self):
        self.assertEqual(technical_percentage(stub_report().scorecard.category_scores), 50.0)
        self.assertIsNone(technical_percentage(None))

    def test_persist_stores_snapshot_prompts_answers_and_competitors(self):
        upd = persist_run_artifacts(self.st, self.run, stub_report())
        self.assertEqual(upd["technical_percentage"], 50.0)
        snap = self.st.snapshots.get(upd["site_snapshot_id"])
        self.assertEqual(snap.site_types_key, "brand,ecommerce")
        self.assertEqual([s["signal_name"] for s in self.st.blobs.get(snap.payload_blob_key)["scores"]],
                         ["robots_txt_exists"])  # LLM signals excluded from technical snapshot
        prompts = self.st.prompts.list_prompts(upd["prompt_set_id"])
        self.assertEqual([(p.cluster, p.position) for p in prompts], [("c1", 0), ("c1", 1), ("c2", 2)])
        ps = self.st.prompts.get_set(upd["prompt_set_id"])
        restored = PromptAnswerClusters.model_validate(self.st.blobs.get(ps.payload_blob_key))
        self.assertEqual(restored.root[0].prompts[0].web_answer, "Alo Yoga, Nike")  # re-scorable raw answers
        self.assertEqual([c.name for c in self.st.competitors.list_for_brand(self.run.brand_id)], ["Lululemon", "Nike"])
        persist_run_artifacts(self.st, self.run, stub_report())  # competitors stay unique
        self.assertEqual(len(self.st.competitors.list_for_brand(self.run.brand_id)), 2)

    def test_no_llm_track_stores_snapshot_only(self):
        upd = persist_run_artifacts(self.st, self.run, stub_report(with_llm=False))
        self.assertIn("site_snapshot_id", upd)
        self.assertNotIn("prompt_set_id", upd)

    def test_delete_cascades_and_keeps_shared_snapshot(self):
        upd = persist_run_artifacts(self.st, self.run, stub_report())
        self.st.runs.update("r1", **upd, report_blob_key=self.st.blobs.put("runs/r1/report.json", {"x": 1}))
        other = self.run.model_copy(update={"run_id": "r2", "site_snapshot_id": upd["site_snapshot_id"]})
        self.st.runs.insert(other)
        delete_run_artifacts(self.st, self.st.runs.get("r1"))
        self.assertIsNone(self.st.blobs.get("runs/r1/report.json"))
        self.assertIsNone(self.st.prompts.get_set(upd["prompt_set_id"]))
        self.assertIsNotNone(self.st.snapshots.get(upd["site_snapshot_id"]))  # still used by r2
        self.st.runs.delete("r1")
        delete_run_artifacts(self.st, self.st.runs.get("r2"))
        self.assertIsNone(self.st.snapshots.get(upd["site_snapshot_id"]))


class BrandApiTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.storage = build_storage(self._tmp.name)
        self.service = AuditRunService(self.storage)
        runs_api._service = self.service

        async def fake_pipeline(svc_self, run, brand_name, reporter):
            reporter.stage_start("domain_signals")
            await asyncio.sleep(0.05)
            reporter.stage_done("domain_signals")
            return fake_report(run, brand_name)

        self._p = patch.object(AuditRunService, "_pipeline", fake_pipeline)
        self._p.start()

    def tearDown(self):
        self._p.stop()
        runs_api._service = None
        self._tmp.cleanup()

    def _run(self, c, **extra):
        rid = c.post("/aeo-audit-tool/api/audit", json={**BODY, **extra}).json()["run_id"]
        for _ in range(100):
            if c.get(f"/aeo-audit-tool/api/runs/{rid}/status").json()["status"] not in ("pending", "running"):
                return rid
            time.sleep(0.05)
        self.fail("run did not finish")

    def test_lookup_runs_and_delete(self):
        from src.main import app
        with TestClient(app) as c:
            self.assertEqual(c.get("/aeo-audit-tool/api/brands", params={"name": "Alo Yoga"}).json(), [])
            r1 = self._run(c)
            r2 = self._run(c, geo="India")  # different geo = another run for the SAME brand
            found = c.get("/aeo-audit-tool/api/brands", params={"name": " Alo Yoga "}).json()
            self.assertEqual(len(found), 1)
            self.assertEqual(found[0]["run_count"], 2)
            self.assertEqual(found[0]["latest_run"]["run_id"], r2)
            self.assertEqual(found[0]["latest_run"]["percentage"], 42.0)
            self.assertEqual(c.get("/aeo-audit-tool/api/brands", params={"name": "alo yoga"}).json(), [])  # exact name
            self.assertEqual(len(c.get("/aeo-audit-tool/api/brands", params={"q": "alo"}).json()), 1)

            runs = c.get(f"/aeo-audit-tool/api/brands/{found[0]['brand_id']}/runs").json()
            self.assertEqual([r["run_id"] for r in runs], [r2, r1])
            self.assertEqual({r["geo"] for r in runs}, {"United States", "India"})

            self.assertTrue(c.delete(f"/aeo-audit-tool/api/runs/{r1}").json()["deleted"])
            self.assertEqual(c.get(f"/aeo-audit-tool/api/runs/{r1}").status_code, 404)
            self.assertEqual(c.delete("/aeo-audit-tool/api/runs/missing").status_code, 404)

    def test_cannot_delete_active_run(self):
        from src.main import app
        orig = svc_mod.RUN_MAX_SECONDS
        with TestClient(app) as c, patch.object(AuditRunService, "_pipeline", self._slow):
            rid = c.post("/aeo-audit-tool/api/audit", json=BODY).json()["run_id"]
            time.sleep(0.1)
            self.assertEqual(c.delete(f"/aeo-audit-tool/api/runs/{rid}").status_code, 409)
            c.post(f"/aeo-audit-tool/api/runs/{rid}/cancel")

    @staticmethod
    async def _slow(svc_self, run, brand_name, reporter):
        await asyncio.sleep(5)

    def test_retention_keeps_newest(self):
        from src.main import app
        with TestClient(app) as c, patch.object(svc_mod, "RUN_RETENTION", 2):
            ids = [self._run(c) for _ in range(4)]
            brand = self.storage.brands.get_by_name("Alo Yoga")
            kept = [r.run_id for r in self.storage.runs.list_for_brand(brand.brand_id)]
            self.assertEqual(kept, ids[:1:-1])  # newest two


if __name__ == "__main__":
    unittest.main()
