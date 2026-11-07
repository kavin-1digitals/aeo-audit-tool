"""The user-facing signal names live in client/src/data/signal_labels.json. Identifiers (the keys) are used by the
weights config, the scorecard, stored audits and the API, so they never change - this test keeps the display names
complete, unique and consistent with the backend."""
import json
import os
import re
import unittest

from src.config import SCORING_WEIGHTS
from src.services.visibility_service import AI_SIGNALS

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "..")
with open(os.path.join(ROOT, "client", "src", "data", "signal_labels.json"), encoding="utf-8") as _f:
    REGISTRY = json.load(_f)["signals"]


class SignalLabelTests(unittest.TestCase):
    def test_every_scored_signal_has_a_label_and_nothing_else_does(self):
        configured = {name for cat in SCORING_WEIGHTS.values() for name in cat if name != "total_weight"}
        self.assertEqual(set(REGISTRY), configured)

    def test_categories_match_the_weights_config(self):
        for category, weights in SCORING_WEIGHTS.items():
            for name in weights:
                if name != "total_weight":
                    self.assertEqual(REGISTRY[name]["category"], category, name)

    def test_labels_are_unique_complete_and_readable(self):
        labels = [v["label"] for v in REGISTRY.values()]
        self.assertEqual(len(labels), len(set(labels)), "two signals share a name")   # some screens group by label
        for name, v in REGISTRY.items():
            self.assertTrue(v["label"] and v["check"] and v["scope"], name)
            self.assertNotIn("_", v["label"], name)                                   # no identifiers leaking through
            self.assertGreaterEqual(len(v["label"].split()), 2, f"{name}: label too short to be meaningful")
            self.assertTrue(v["check"].endswith("."), name)

    def test_backend_descriptions_equal_the_registry(self):
        for name, text in AI_SIGNALS.items():
            self.assertEqual(text, REGISTRY[name]["check"], name)

    def test_client_code_does_not_hand_roll_signal_names_any_more(self):
        offenders = []
        src = os.path.join(ROOT, "client", "src")
        for folder, _, files in os.walk(src):
            for f in files:
                if f.endswith(".js") and not f.endswith(".test.js") and f != "signalLabels.js":
                    with open(os.path.join(folder, f), encoding="utf-8") as fh:
                        text = fh.read()
                    if re.search(r"signal_name\s*\.\s*replace\(\s*/_/g", text):
                        offenders.append(f)
        self.assertEqual(offenders, [])


if __name__ == "__main__":
    unittest.main()
