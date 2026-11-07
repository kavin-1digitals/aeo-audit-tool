import unittest
from types import SimpleNamespace as NS

from src.services.site_facts import extract_site_facts
from src.services.technical_summary import confidence_for, summarize


def cat(earned, analysed, signals, pos=0, neg=0):
    return {"total_weightage_percentage": earned, "max_possible_total_weightage_percentage": analysed,
            "positive_checks": pos, "negative_checks": neg,
            "signals": [{"signal_name": n, "weightage_percentage": w} for n, w in signals]}


class SummaryTests(unittest.TestCase):
    def test_blocked_site_is_zero_of_a_small_analysed_slice_with_limited_confidence(self):
        s = summarize({
            "domain_signals": cat(0, 3, [("sitemap_exists", 3), ("robots_txt_exists", 3), ("llms_txt_exists", 4)] + [("x", 20)], neg=1),
            "site_signals": cat(0, 6, [("site_scrapable", 6)] + [("y", 24)], neg=1)})
        self.assertEqual((s["earned"], s["analysed"], s["full"]), (0, 9, 60))
        self.assertEqual((s["score_pct"], s["coverage_pct"], s["confidence"]), (0.0, 15.0, "limited"))
        self.assertEqual((s["passed"], s["failed"], s["checks"]), (0, 2, 2))

    def test_healthy_site(self):
        s = summarize({"domain_signals": cat(25, 30, [("a", 30)], pos=8, neg=1),
                       "site_signals": cat(20, 30, [("b", 30)], pos=20, neg=5),
                       "llm_signals": cat(10, 40, [("c", 40)])})
        self.assertEqual((s["score_pct"], s["coverage_pct"], s["confidence"]), (75.0, 100.0, "full"))
        self.assertEqual([c["key"] for c in s["categories"]], ["domain_signals", "site_signals"])  # AI part excluded
        self.assertEqual(s["categories"][0]["score_pct"], 83.3)

    def test_none_and_confidence_levels(self):
        self.assertIsNone(summarize(None)); self.assertIsNone(summarize({}))
        self.assertEqual([confidence_for(v) for v in (None, 10, 40, 79.9, 80)], ["limited", "limited", "partial", "partial", "full"])
        s = summarize({"domain_signals": cat(0, 0, [("a", 30)]), "site_signals": cat(0, 0, [("b", 30)])})
        self.assertIsNone(s["score_pct"])  # nothing analysed -> no score


class FactsTests(unittest.TestCase):
    def test_blocked_site_facts(self):
        signals = NS(
            domain_signals=NS(
                robots_txt_signal=NS(robots=NS(exists=False, status=403), ai_crawlers=None, search_crawlers=None,
                                     cause_of_issue="Failed due to bot protection or server error on that domain"),
                llms_txt_signal=NS(llm_txts=NS(exists=False, is_valid=False, status=403), cause_of_issue="bot protection"),
                site_map_signal=NS(sitemap=NS(exists=False, status=404, type_=None), last_updated=None)),
            site_signals=NS(is_scrapable=False, site_signals=[], jsonld_signals=[], issue_found="Site is not scrapable",
                            cause_of_issue="server blocking"))
        f = extract_site_facts(signals)
        self.assertEqual(f["robots"], {"state": "blocked", "http": 403})
        self.assertEqual(f["llms_txt"]["state"], "blocked")
        self.assertEqual(f["sitemap"]["state"], "missing")  # a plain 404 is a real "missing"
        self.assertEqual(f["site"], {"scrapable": False, "pages_analysed": 0, "issue": "Site is not scrapable"})
        self.assertTrue(f["blocked_by_protection"])

    def test_healthy_site_facts(self):
        agents = [NS(agent="GPTBot", category_access=[NS(is_accessible=True)]),
                  NS(agent="CCBot", category_access=[NS(is_accessible=True), NS(is_accessible=False)])]
        signals = NS(
            domain_signals=NS(
                robots_txt_signal=NS(robots=NS(exists=True, status=200), ai_crawlers=NS(agents=agents), search_crawlers=None, cause_of_issue=None),
                llms_txt_signal=NS(llm_txts=NS(exists=True, is_valid=True, status=200), cause_of_issue=None),
                site_map_signal=NS(sitemap=NS(exists=True, status=200, type_="sitemapindex"), last_updated=None)),
            site_signals=NS(is_scrapable=True, site_signals=[1, 2, 3], jsonld_signals=[NS(type_="Organization", exists=True), NS(type_="Product", exists=False)],
                            issue_found=None, cause_of_issue=None))
        f = extract_site_facts(signals)
        self.assertEqual(f["ai_crawlers"], {"total": 2, "allowed": 1, "blocked_agents": ["CCBot"]})
        self.assertEqual((f["llms_txt"]["state"], f["robots"]["state"], f["sitemap"]["type"]), ("ok", "ok", "sitemapindex"))
        self.assertEqual((f["site"]["pages_analysed"], f["jsonld_types"], f["blocked_by_protection"]), (3, ["Organization"], False))

    def test_never_raises_on_unexpected_shapes(self):
        self.assertEqual(extract_site_facts(NS()).get("blocked_by_protection"), False)
        self.assertIsInstance(extract_site_facts(None), dict)


if __name__ == "__main__":
    unittest.main()
