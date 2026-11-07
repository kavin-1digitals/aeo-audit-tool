"""Backend-agnostic contract tests for the storage ports.

Any adapter (the JSON-file one today, a SQL one later) must pass these. To test a new adapter:

    class SqlStorageTests(StorageContract, unittest.TestCase):
        def make_storage(self):
            return build_sql_storage(...)
"""
from src.storage import (
    AuditRunRow, BrandCompetitorRow, ComparisonStatus, CompetitorComparisonRow, EntityMentionRow, PromptRow,
    PromptSetRow, RunStageRow, RunStatus, SiteSnapshotRow, StageStatus, UniqueViolation, VisibilityMetricRow,
)
from src.storage.ids import clean_name, normalise_domain


class StorageContract:
    def make_storage(self):  # pragma: no cover - provided by the concrete test case
        raise NotImplementedError

    def setUp(self):
        self.st = self.make_storage()

    def _run(self, brand, site, key=None, **kw):
        return AuditRunRow(run_id=kw.pop("run_id", "r1"), brand_id=brand.brand_id, site_id=site.site_id,
                           requested_url="https://a.com", active_key=key, **kw)

    # ---- brands / sites
    def test_brand_name_is_kept_as_typed_and_only_trimmed(self):
        b = self.st.brands.get_or_create("  Alo  Yoga ")
        self.assertEqual(b.name, "Alo  Yoga")
        self.assertEqual(self.st.brands.get_or_create("Alo  Yoga").brand_id, b.brand_id)
        self.assertNotEqual(self.st.brands.get_or_create("alo  yoga").brand_id, b.brand_id)
        self.assertEqual(self.st.brands.get_by_name(" Alo  Yoga ").brand_id, b.brand_id)
        self.assertIsNone(self.st.brands.get_by_name("alo  yoga ".upper()))

    def test_brand_search_and_list(self):
        self.st.brands.get_or_create("Alo Yoga"); self.st.brands.get_or_create("Nike")
        self.assertEqual([b.name for b in self.st.brands.search("alo")], ["Alo Yoga"])
        self.assertEqual({b.name for b in self.st.brands.list_all()}, {"Alo Yoga", "Nike"})

    def test_empty_brand_rejected(self):
        with self.assertRaises(ValueError):
            self.st.brands.get_or_create("   ")

    def test_domain_normalisation_and_uniqueness(self):
        self.assertEqual(normalise_domain("https://WWW.Shop.com/x"), "shop.com")
        self.assertEqual(self.st.sites.get_or_create("https://www.shop.com").site_id,
                         self.st.sites.get_or_create("shop.com").site_id)

    # ---- runs
    def test_active_key_unique_only_while_set(self):
        b = self.st.brands.get_or_create("Alo"); s = self.st.sites.get_or_create("alo.com")
        self.st.runs.insert(self._run(b, s, key="k", run_id="r1"))
        with self.assertRaises(UniqueViolation):
            self.st.runs.insert(self._run(b, s, key="k", run_id="r2"))
        self.st.runs.update("r1", status=RunStatus.COMPLETED, active_key=None)
        self.st.runs.insert(self._run(b, s, key="k", run_id="r2"))
        self.assertEqual(self.st.runs.find_active("k").run_id, "r2")

    def test_run_listing_and_status_filter(self):
        b = self.st.brands.get_or_create("Alo"); s = self.st.sites.get_or_create("alo.com")
        self.st.runs.insert(self._run(b, s, run_id="r1", requested_at="2026-01-01T00:00:00+00:00"))
        self.st.runs.insert(self._run(b, s, run_id="r2", requested_at="2026-02-01T00:00:00+00:00"))
        self.assertEqual([r.run_id for r in self.st.runs.list_for_brand(b.brand_id)], ["r2", "r1"])
        self.assertEqual(len(self.st.runs.list_for_site(s.site_id)), 2)
        self.st.runs.update("r1", status=RunStatus.RUNNING)
        self.assertEqual([r.run_id for r in self.st.runs.list_by_status([RunStatus.RUNNING])], ["r1"])
        self.st.runs.delete("r1")
        self.assertIsNone(self.st.runs.get("r1"))

    # ---- stages / events
    def test_stage_upsert_and_event_sequence_and_cap(self):
        self.st.stages.upsert(RunStageRow(run_id="r1", stage_key="site_crawl", lane="site"))
        self.st.stages.upsert(RunStageRow(run_id="r1", stage_key="site_crawl", lane="site", status=StageStatus.DONE))
        stages = self.st.stages.list_for_run("r1")
        self.assertEqual((len(stages), stages[0].status), (1, StageStatus.DONE))
        self.st.events.append_many("r1", [{"message": "a"}, {"message": "b"}])
        self.assertEqual([e.seq for e in self.st.events.list_for_run("r1")], [1, 2])
        self.assertEqual([e.message for e in self.st.events.list_for_run("r1", since_seq=1)], ["b"])
        self.st.events.append_many("r1", [{"message": str(i)} for i in range(400)])
        self.assertLessEqual(len(self.st.events.list_for_run("r1")), 300)
        self.assertEqual(self.st.events.list_for_run("r1")[-1].message, "399")
        self.st.events.delete_for_run("r1"); self.st.stages.delete_for_run("r1")
        self.assertEqual((self.st.events.list_for_run("r1"), self.st.stages.list_for_run("r1")), ([], []))

    # ---- snapshots / prompts / competitors
    def test_snapshots(self):
        s = self.st.sites.get_or_create("a.com")
        self.st.snapshots.insert(SiteSnapshotRow(snapshot_id="s1", site_id=s.site_id, site_types_key="x", taken_at="2026-01-01T00:00:00+00:00"))
        self.st.snapshots.insert(SiteSnapshotRow(snapshot_id="s2", site_id=s.site_id, site_types_key="x", taken_at="2026-02-01T00:00:00+00:00"))
        self.assertEqual(self.st.snapshots.latest_for_site(s.site_id, "x").snapshot_id, "s2")
        self.assertIsNone(self.st.snapshots.latest_for_site(s.site_id, "other"))
        self.assertEqual(len(self.st.snapshots.list_all()), 2)
        self.st.snapshots.delete("s1")
        self.assertIsNone(self.st.snapshots.get("s1"))

    def test_prompt_sets(self):
        ps = PromptSetRow(prompt_set_id="p1", brand_id="b", run_id="r")
        rows = [PromptRow(prompt_id=f"q{i}", prompt_set_id="p1", cluster="c", text=f"t{i}", position=i) for i in (2, 0, 1)]
        self.st.prompts.insert_set(ps, rows)
        self.assertEqual([p.position for p in self.st.prompts.list_prompts("p1")], [0, 1, 2])
        self.st.prompts.delete_set("p1")
        self.assertEqual((self.st.prompts.get_set("p1"), self.st.prompts.list_prompts("p1")), (None, []))

    def test_brand_competitors_unique_per_brand(self):
        b = self.st.brands.get_or_create("Alo")
        self.assertEqual(len(self.st.competitors.upsert_discovered(b.brand_id, ["Nike", " Gap ", "Nike", ""], "r1")), 2)
        self.assertEqual(self.st.competitors.upsert_discovered(b.brand_id, ["Nike"], "r2"), [])
        self.assertEqual([c.name for c in self.st.competitors.list_for_brand(b.brand_id)], ["Gap", "Nike"])

    # ---- mentions / visibility
    def test_mentions_and_visibility(self):
        self.st.mentions.upsert_many([
            EntityMentionRow(prompt_set_id="p1", prompt_id="q1", entity_name="Nike", mentioned_web=True, mentioned_llm=False)])
        self.st.mentions.upsert_many([
            EntityMentionRow(prompt_set_id="p1", prompt_id="q1", entity_name="Nike", mentioned_web=False, mentioned_llm=True)])
        rows = self.st.mentions.list_for_prompt_set("p1", "Nike")
        self.assertEqual((len(rows), rows[0].mentioned_llm), (1, True))  # upsert replaced
        self.st.mentions.delete_for_prompt_set("p1")
        self.assertEqual(self.st.mentions.list_for_prompt_set("p1"), [])

        mk = lambda mid, run, at: VisibilityMetricRow(metric_id=mid, run_id=run, prompt_set_id="p", entity_name="Nike",
                                                      scope="run_discovered_set", entity_set_hash="h", mode="combined",
                                                      sov=1, citations=1, cluster_coverage=1, measured_at=at)
        self.st.visibility.insert_many([mk("m1", "r1", "2026-01-01"), mk("m2", "r2", "2026-02-01")])
        self.assertEqual(self.st.visibility.latest_for_entity("Nike").run_id, "r2")
        self.assertEqual(self.st.visibility.latest_for_entity("Nike", exclude_run_id="r2").run_id, "r1")
        self.st.visibility.delete_for_run("r1")
        self.assertEqual(self.st.visibility.list_for_run("r1"), [])

    # ---- comparisons
    def test_comparisons(self):
        s = self.st.sites.get_or_create("n.com")
        mk = lambda cid, dom, **kw: CompetitorComparisonRow(comparison_id=cid, run_id="r1", competitor_name=cid,
                                                           requested_url=f"https://{dom}", domain=dom, site_id=s.site_id, **kw)
        self.st.comparisons.insert(mk("c1", "n.com", position=1))
        self.st.comparisons.insert(mk("c2", "m.com", position=0, snapshot_id="snap"))
        self.assertEqual([c.comparison_id for c in self.st.comparisons.list_for_run("r1")], ["c2", "c1"])
        self.assertEqual(self.st.comparisons.find_by_domain("r1", "n.com").comparison_id, "c1")
        self.assertEqual(self.st.comparisons.list_referencing_snapshot("snap")[0].comparison_id, "c2")
        self.st.comparisons.update("c1", removed_at="2020-01-01T00:00:00+00:00", status=ComparisonStatus.DONE)
        self.assertEqual([c.comparison_id for c in self.st.comparisons.list_for_run("r1")], ["c2"])
        self.assertEqual(len(self.st.comparisons.list_for_run("r1", include_removed=True)), 2)
        self.assertEqual([c.comparison_id for c in self.st.comparisons.list_removed_before("2021-01-01")], ["c1"])
        self.assertEqual(len(self.st.comparisons.list_by_status([ComparisonStatus.DONE])), 1)
        self.st.comparisons.delete("c1")
        self.assertIsNone(self.st.comparisons.get("c1"))

    # ---- blobs
    def test_blob_roundtrip_and_prefix_delete(self):
        self.st.blobs.put("runs/r1/report.json", {"a": 1})
        self.assertEqual(self.st.blobs.get("runs/r1/report.json"), {"a": 1})
        self.st.blobs.delete_prefix("runs/r1")
        self.assertIsNone(self.st.blobs.get("runs/r1/report.json"))

    def test_clean_name(self):
        self.assertEqual(clean_name("  A b  "), "A b")
