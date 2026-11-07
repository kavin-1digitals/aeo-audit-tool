import os
import tempfile
import unittest

from src.storage import build_storage
from src.tests.storage_contract import StorageContract


class JsonFileStorageTests(StorageContract, unittest.TestCase):
    """The JSON-file adapter must satisfy the shared contract (see storage_contract.py)."""

    def make_storage(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = self._tmp.name
        return build_storage(self.dir)

    def tearDown(self):
        self._tmp.cleanup()

    # ---- behaviour specific to the file-backed adapter
    def test_data_survives_reload_and_backup_recovers_corruption(self):
        self.st.brands.get_or_create("Alo")
        self.st.brands.get_or_create("Nike")  # second write creates .bak of the first
        path = os.path.join(self.dir, "tables", "brands.json")
        self.assertTrue(os.path.exists(path + ".bak"))
        self.assertEqual({b.name for b in build_storage(self.dir).brands.search("")}, {"Alo", "Nike"})
        with open(path, "w") as f:
            f.write("{not json")
        self.assertEqual({b.name for b in build_storage(self.dir).brands.search("")}, {"Alo"})  # last good backup

    def test_blob_path_traversal_blocked(self):
        with self.assertRaises(ValueError):
            self.st.blobs.put("../evil.json", {})


if __name__ == "__main__":
    unittest.main()
