from pathlib import Path
import subprocess
import unittest
BASE = Path(__file__).resolve().parents[1]
class TestVM(unittest.TestCase):
    def test_shell_syntax(self):
        for name in ("doctor.sh", "prepare.sh", "start.sh"):
            p = subprocess.run(["bash", "-n", str(BASE/name)], capture_output=True, text=True)
            self.assertEqual(p.returncode, 0, name+": "+p.stderr)
    def test_safety(self):
        prep = (BASE/"prepare.sh").read_text()
        start = (BASE/"start.sh").read_text()
        self.assertIn("VERSION=3.24.1", prep)
        self.assertIn("sha256sum --check --strict", prep)
        self.assertIn("Refusing to overwrite existing disk", prep)
        self.assertIn("mke2fs -t ext4", prep)
        self.assertIn("-accel tcg,thread=multi", start)
        self.assertIn("hostfwd=tcp:127.0.0.1:", start)
        self.assertNotIn("pm uninstall", prep)
        self.assertNotIn("-accel kvm", start)
if __name__ == "__main__":
    unittest.main()
