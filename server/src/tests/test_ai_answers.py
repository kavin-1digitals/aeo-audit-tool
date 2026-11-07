import json
import unittest
from unittest.mock import patch

import src.signals.llm_signals.citation_prompts_evaluator_chain as ev
from src.signals.llm_signals.citation_prompts_chain import CitationPromptCluster


def items(pairs):
    return json.dumps([{"cluster": "c", "prompt": p, "answer": a} for p, a in pairs])


class PairingTests(unittest.TestCase):
    def test_pairs_by_prompt_text_even_if_reordered(self):
        web = [{"prompt": "B?", "answer": "wb"}, {"prompt": "A?", "answer": "wa"}]
        llm = [{"prompt": "A?", "answer": "la"}, {"prompt": "B?", "answer": "lb"}]
        self.assertEqual(ev.pair_answers(["A?", "B?"], web, llm), [("wa", "la"), ("wb", "lb")])

    def test_missing_item_is_dropped_never_misaligned(self):
        web = [{"prompt": "A?", "answer": "wa"}, {"prompt": "B?", "answer": "wb"}, {"prompt": "C?", "answer": "wc"}]
        llm = [{"prompt": "A?", "answer": "la"}, {"prompt": "C?", "answer": "lc"}]  # B missing
        self.assertEqual(ev.pair_answers(["A?", "B?", "C?"], web, llm), [("wa", "la"), None, ("wc", "lc")])

    def test_reworded_echo_falls_back_to_index_only_when_shapes_match(self):
        web = [{"prompt": "a reworded", "answer": "wa"}]
        llm = [{"prompt": "another rewording", "answer": "la"}]
        self.assertEqual(ev.pair_answers(["A?"], web, llm), [("wa", "la")])
        self.assertEqual(ev.pair_answers(["A?", "B?"], web, llm), [None, None])  # shapes differ -> no guessing

    def test_case_and_whitespace_tolerant(self):
        web = [{"prompt": " best  YOGA pants ", "answer": "w"}]
        llm = [{"prompt": "Best yoga pants?", "answer": "l"}]
        self.assertEqual(ev.pair_answers(["Best yoga pants"], web, llm), [("w", "l")])


class ChunkTests(unittest.IsolatedAsyncioTestCase):
    clusters = [CitationPromptCluster(cluster="c1", prompts=["p1", "p2"]),
                CitationPromptCluster(cluster="c2", prompts=["p3"])]

    def fake_openai(self, fail_cluster=None):
        def call(prompt, use_web=False):
            if fail_cluster and fail_cluster in prompt:
                raise RuntimeError("openai down")
            ps = [p for p in ("p1", "p2", "p3") if f"] {p}" in prompt]
            tag = "web" if use_web else "llm"
            return items([(p, f"{tag} says Alo Yoga and Nike for {p}") for p in ps])
        return call

    async def test_success_keeps_schema_order_and_mentions(self):
        class Rec:
            calls = []
            def stage_progress(self, k, cur, total=None): self.calls.append((k, cur, total))
        rec = Rec()
        with patch.object(ev, "call_openai", self.fake_openai()):
            out = await ev.safe_invoke(self.clusters, "Alo Yoga", ["Nike", "Gap"], retries=1, progress=rec)
        self.assertEqual([c.cluster for c in out.root], ["c1", "c2"])
        self.assertEqual([p.prompt for p in out.root[0].prompts], ["p1", "p2"])
        p = out.root[0].prompts[0]
        self.assertTrue(p.web_entity_mentioned and p.llm_entity_mentioned)
        self.assertEqual({c.competitor_entity: c.is_competitor_mentioned for c in p.competitor_citations_web},
                         {"Nike": True, "Gap": False})
        self.assertEqual(rec.calls[0], ("ai_answers", 0, 3))
        self.assertEqual(rec.calls[-1], ("ai_answers", 3, 3))

    async def test_any_failed_cluster_returns_none_like_before(self):
        with patch.object(ev, "call_openai", self.fake_openai(fail_cluster="p3")):
            out = await ev.safe_invoke(self.clusters, "Alo Yoga", ["Nike"], retries=1)
        self.assertIsNone(out)


if __name__ == "__main__":
    unittest.main()
