import asyncio
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import src.signals.llm_signals as llm_mod
from src.services.run_persistence import persist_run_artifacts
from src.services.visibility_service import VisibilityService, compute_market_comparison
from src.signals.llm_signals.citation_prompts_evaluator_chain import (
    CompetitorCitation, PromptAnswerCluster, PromptAnswerClusters, PromptAnswerDual, is_mentioned,
)
from src.storage import AuditRunRow, RunStatus, build_storage

# (web_answer, llm_answer) per prompt, grouped in clusters
DATA = {
    "pants": [("Alo Yoga and Nike lead here", "Nike, Gap"), ("Lululemon is top", "Alo Yoga is nice")],
    "tops": [("Nike tees", "Gap basics"), ("Alo Yoga tops", "Lululemon, Nike")],
    "shoes": [("Nike dominates", "Nike")],
}
BRAND, COMPETITORS = "Alo Yoga", ["Nike", "Lululemon", "Gap"]


def build_answers(entity=BRAND, competitors=COMPETITORS) -> PromptAnswerClusters:
    clusters = []
    for name, rows in DATA.items():
        prompts = []
        for i, (web, llm) in enumerate(rows):
            prompts.append(PromptAnswerDual(
                prompt=f"{name} {i}", web_answer=web, llm_answer=llm,
                web_entity_mentioned=is_mentioned(web, entity), llm_entity_mentioned=is_mentioned(llm, entity),
                competitor_citations_web=[CompetitorCitation(competitor_entity=c, is_competitor_mentioned=is_mentioned(web, c)) for c in competitors],
                competitor_citations_llm=[CompetitorCitation(competitor_entity=c, is_competitor_mentioned=is_mentioned(llm, c)) for c in competitors],
            ))
        clusters.append(PromptAnswerCluster(cluster=name, prompts=prompts))
    return PromptAnswerClusters(root=clusters)


class RegressionTests(unittest.IsolatedAsyncioTestCase):
    async def test_rescoring_reproduces_find_llm_signals_numbers(self):
        answers = build_answers()
        analysis = SimpleNamespace(profile=SimpleNamespace(top_competitors=SimpleNamespace(values=COMPETITORS)))
        prompts = SimpleNamespace(root=[SimpleNamespace(prompts=["x"])])

        async def gen(entity, geo, **kw): return analysis, prompts
        async def ev(*a, **kw): return answers

        with patch.object(llm_mod, "async_generate_citation_prompts", gen), \
             patch.object(llm_mod, "async_evaluate_citation_prompts", ev), \
             patch.object(llm_mod, "LlmSignal", lambda **kw: SimpleNamespace(**kw)), \
             patch.object(llm_mod, "LlmSignals", lambda **kw: SimpleNamespace(**kw)):
            original = (await llm_mod.find_llm_signals(BRAND, "US")).signals

        mine = compute_market_comparison(answers, [BRAND, *COMPETITORS])
        for mode, attr in (("combined", "market_comparison_combined"), ("web", "market_comparison_web"),
                           ("llm", "market_comparison_llm")):
            expected = [m.model_dump() for m in getattr(original, attr)]
            self.assertEqual(mine[mode], expected, mode)


class ServiceTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.st = build_storage(self._tmp.name)
        brand = self.st.brands.get_or_create(BRAND); site = self.st.sites.get_or_create("alo.com")
        run = AuditRunRow(run_id="r1", brand_id=brand.brand_id, site_id=site.site_id, requested_url="https://alo.com",
                          status=RunStatus.COMPLETED, geo="US")
        self.st.runs.insert(run)
        answers = build_answers()
        mc = compute_market_comparison(answers, [BRAND, *COMPETITORS])
        wrap = lambda rows: [SimpleNamespace(model_dump=lambda r=r: r, **r) for r in rows]
        report = SimpleNamespace(
            scorecard=SimpleNamespace(category_scores=None, raw_scorecard=SimpleNamespace(scores=[])),
            signals=SimpleNamespace(site_signals=SimpleNamespace(is_scrapable=True), llm_signals=SimpleNamespace(
                status=True, signals=SimpleNamespace(
                    citation_prompt_answers=answers, competitors=COMPETITORS, market_comparison_combined=wrap(mc["combined"]),
                    market_comparison_web=wrap(mc["web"]), market_comparison_llm=wrap(mc["llm"])))))
        self.st.runs.update("r1", **persist_run_artifacts(self.st, run, report))
        self.svc = VisibilityService(self.st)

    def tearDown(self):
        self._tmp.cleanup()

    def add_compared(self, *names):
        """Mark competitors as added to the comparison (finished audits) - the Competitor tab only covers these."""
        from src.storage import ComparisonStatus, CompetitorComparisonRow
        for i, name in enumerate(names):
            site = self.st.sites.get_or_create(f"{name.lower()}.com")
            self.st.comparisons.insert(CompetitorComparisonRow(
                comparison_id=f"cmp-{name}", run_id="r1", competitor_name=name, requested_url=f"https://{name.lower()}.com",
                domain=f"{name.lower()}.com", site_id=site.site_id, status=ComparisonStatus.DONE, position=i))

    def test_run_time_persists_mentions_and_frozen_metrics(self):
        run = self.st.runs.get("r1")
        facts = self.st.mentions.list_for_prompt_set(run.prompt_set_id, "Nike")
        self.assertEqual(len(facts), 5)  # one per prompt
        self.assertEqual(sum(f.mentioned_web for f in facts), 3)
        frozen = self.st.visibility.list_for_run("r1", scope="run_discovered_set")
        self.assertEqual({m.entity_name for m in frozen}, {BRAND, *COMPETITORS})
        self.assertEqual({m.mode for m in frozen}, {"combined", "web", "llm"})

    def test_new_competitor_scored_on_same_prompts_without_llm_calls(self):
        import src.signals.llm_signals.citation_prompts_evaluator_chain as ev
        with patch.object(ev, "call_openai", side_effect=AssertionError("no LLM call allowed")):
            rows = self.svc.score("r1", ["Adidas", "Nike"])
        by = {r["entity"]: r for r in rows}
        self.assertEqual(list(by), [BRAND, "Adidas", "Nike"])
        self.assertEqual(by["Adidas"]["citations"], 0)
        self.assertEqual(by["Adidas"]["sov"], 0.0)
        self.assertEqual(by["Nike"]["citations"], 4)  # web or llm mention in 4 of 5 prompts
        self.assertAlmostEqual(sum(r["sov"] for r in rows), 100.0, places=0)

    def test_sov_depends_on_set_but_citations_and_coverage_do_not(self):
        small = {r["entity"]: r for r in self.svc.score("r1", ["Nike"], persist=False)}
        large = {r["entity"]: r for r in self.svc.score("r1", ["Nike", "Lululemon", "Gap"], persist=False)}
        self.assertEqual(small["Nike"]["citations"], large["Nike"]["citations"])
        self.assertEqual(small["Nike"]["cluster_coverage"], large["Nike"]["cluster_coverage"])
        self.assertNotEqual(small["Nike"]["sov"], large["Nike"]["sov"])

    def test_persists_dated_comparison_metrics_and_cross_brand_reference(self):
        self.svc.score("r1", ["Adidas"])
        self.assertTrue(self.st.visibility.list_for_run("r1", scope="comparison_set"))
        ref = self.svc.reference_for("Nike")
        self.assertEqual(ref["measured_for_brand"], BRAND)
        self.assertIsNone(self.svc.reference_for("Nike", exclude_run_id="r1"))  # only measured in r1
        self.assertIsNone(self.svc.reference_for("Unknown Co"))

    def test_unavailable_when_run_has_no_stored_answers(self):
        brand = self.st.brands.get_or_create("NoAI"); site = self.st.sites.get_or_create("noai.com")
        self.st.runs.insert(AuditRunRow(run_id="r2", brand_id=brand.brand_id, site_id=site.site_id,
                                        requested_url="https://noai.com", status=RunStatus.COMPLETED))
        self.assertIsNone(self.svc.score("r2", ["Nike"]))
        self.assertIsNone(self.svc.score("missing", ["Nike"]))

    def test_deleting_run_removes_mentions_and_metrics(self):
        from src.services.run_persistence import delete_run_artifacts
        run = self.st.runs.get("r1")
        delete_run_artifacts(self.st, run)
        self.assertEqual(self.st.mentions.list_for_prompt_set(run.prompt_set_id), [])
        self.assertEqual(self.st.visibility.list_for_run("r1"), [])


if __name__ == "__main__":
    unittest.main()


class PromptMatrixTests(ServiceTests):
    """Prompts Lab data: built from stored answers, includes competitors added later, makes no AI calls."""

    def test_matrix_has_answers_flags_and_all_tracked_entities(self):
        import src.signals.llm_signals.citation_prompts_evaluator_chain as ev
        with patch.object(ev, "call_openai", side_effect=AssertionError("no LLM call allowed")):
            m = self.svc.prompt_matrix("r1")
        self.assertEqual([e["name"] for e in m["entities"]], [BRAND, *COMPETITORS])
        self.assertEqual({e["kind"] for e in m["entities"][1:]}, {"discovered"})
        self.assertEqual((m["prompt_count"], [c["cluster"] for c in m["clusters"]]), (5, ["pants", "tops", "shoes"]))
        first = m["clusters"][0]["prompts"][0]
        self.assertEqual(first["web_answer"], "Alo Yoga and Nike lead here")
        self.assertEqual(first["mentions"][BRAND], {"web": True, "llm": False})
        self.assertEqual(first["mentions"]["Nike"], {"web": True, "llm": True})
        self.assertEqual(first["mentions"]["Lululemon"], {"web": False, "llm": False})
        self.assertEqual([p["index"] for c in m["clusters"] for p in c["prompts"]], [0, 1, 2, 3, 4])

    def test_added_competitors_appear_and_unavailable_runs_return_none(self):
        from src.storage import CompetitorComparisonRow, ComparisonStatus
        site = self.st.sites.get_or_create("adidas.com")
        self.st.comparisons.insert(CompetitorComparisonRow(
            comparison_id="c1", run_id="r1", competitor_name="Adidas", requested_url="https://adidas.com", domain="adidas.com",
            site_id=site.site_id, status=ComparisonStatus.DONE))
        self.st.comparisons.insert(CompetitorComparisonRow(
            comparison_id="c2", run_id="r1", competitor_name="Pending Co", requested_url="https://p.com", domain="p.com",
            site_id=site.site_id, status=ComparisonStatus.RUNNING))
        names = {e["name"]: e["kind"] for e in self.svc.prompt_matrix("r1")["entities"]}
        self.assertEqual(names["Adidas"], "added")
        self.assertNotIn("Pending Co", names)  # only finished audits take part
        brand = self.st.brands.get_or_create("NoAI"); s2 = self.st.sites.get_or_create("noai.com")
        self.st.runs.insert(AuditRunRow(run_id="r9", brand_id=brand.brand_id, site_id=s2.site_id, requested_url="https://noai.com", status=RunStatus.COMPLETED))
        self.assertIsNone(self.svc.prompt_matrix("r9"))
        self.assertIsNone(self.svc.prompt_matrix("missing"))


class AiScoreTests(ServiceTests):
    def test_ai_checks_cover_only_the_brands_in_the_comparison(self):
        self.add_compared("Nike", "Gap")  # Lululemon was found by the AI but is NOT in the comparison
        ai = self.svc.ai_scores("r1")
        self.assertEqual(set(ai), {BRAND, "Nike", "Gap"})
        alo = ai[BRAND]
        by = {s["signal_name"]: s for s in alo["signals"]}
        # topics: pants/tops/shoes. Alo is named in pants+tops (2/3); it is named most only in pants (1/3);
        # it is named in 3 of 5 prompts.
        self.assertEqual((by["cluster_presence"]["passed"], by["cluster_presence"]["total"]), (2, 3))
        self.assertEqual((by["cluster_dominance"]["passed"], by["cluster_dominance"]["total"]), (1, 3))
        self.assertEqual((by["prompt_citation"]["passed"], by["prompt_citation"]["total"]), (3, 5))
        self.assertEqual((alo["earned"], alo["full"], alo["score_pct"]), (21.6, 40.0, 54.0))  # 8 + 4 + 9.6 of 12+12+16
        self.assertGreater(ai["Nike"]["score_pct"], alo["score_pct"])  # Nike is named most often

    def test_dominance_is_judged_only_against_compared_brands(self):
        # Same rule as the audit: "no compared brand is named more often in the topic". Against Gap alone Alo holds all
        # three topics (2 vs 1, 1 vs 1, and 0 vs 0 where nobody is named); with Nike added it only holds "pants".
        self.add_compared("Gap")
        by = {s["signal_name"]: s for s in self.svc.ai_scores("r1")[BRAND]["signals"]}
        self.assertEqual(by["cluster_dominance"]["passed"], 3)
        self.add_compared("Nike")
        by = {s["signal_name"]: s for s in self.svc.ai_scores("r1")[BRAND]["signals"]}
        self.assertEqual(by["cluster_dominance"]["passed"], 1)

    def test_none_without_stored_answers(self):
        brand = self.st.brands.get_or_create("NoAI2"); s2 = self.st.sites.get_or_create("noai2.com")
        self.st.runs.insert(AuditRunRow(run_id="r8", brand_id=brand.brand_id, site_id=s2.site_id, requested_url="https://noai2.com", status=RunStatus.COMPLETED))
        self.assertIsNone(self.svc.ai_scores("r8"))


class MentionSummaryTests(ServiceTests):
    def test_counts_per_brand_and_per_topic_for_compared_brands_only(self):
        self.add_compared("Nike")
        m = self.svc.mention_summary("r1")
        self.assertEqual((m["total_prompts"], m["topics"]), (5, 3))
        self.assertEqual([e["name"] for e in m["entities"]], [BRAND, "Nike"])  # not Lululemon / Gap
        by = {e["name"]: e for e in m["entities"]}
        # Nike: named in 3 web answers and 3 model answers; in at least one of the two answers for 4 of the 5 prompts
        self.assertEqual((by["Nike"]["citations"], by["Nike"]["web"], by["Nike"]["llm"]), (4, 3, 3))
        self.assertEqual(by[BRAND]["citations"], 3)
        topics = {c["cluster"]: c for c in m["clusters"]}
        self.assertEqual((topics["pants"]["prompts"], topics["pants"]["counts"][BRAND], topics["pants"]["counts"]["Nike"]), (2, 2, 1))
        self.assertEqual(topics["shoes"]["counts"], {BRAND: 0, "Nike": 1})
        self.assertEqual(sum(c["counts"]["Nike"] for c in m["clusters"]), by["Nike"]["citations"])

    def test_none_without_answers(self):
        self.assertIsNone(self.svc.mention_summary("missing"))
