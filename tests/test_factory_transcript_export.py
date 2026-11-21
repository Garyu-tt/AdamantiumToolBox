#!/usr/bin/env python3
"""No-network regressions for real Claude Code -> owner-only diagnostics export."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest

MODULE = Path(__file__).resolve().parents[1] / "tools" / "factory_transcript_export.py"
spec = importlib.util.spec_from_file_location("factory_transcript_export", MODULE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

SESSION = "2c6d551b-e2b0-4061-a759-d1520dfc2238"
RUN = "4-1795254434-9e7ba6"


class FactoryTranscriptTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name) / "factory"
        self.project = "sample"
        self.folder = self.root / "projects" / self.project
        (self.folder / "runs").mkdir(parents=True)
        transcript_dir = self.root / ".claude" / "projects" / "-safe-project"
        transcript_dir.mkdir(parents=True)
        self.transcript = transcript_dir / (SESSION + ".jsonl")
        self.run = {"at": "2026-11-21T14:00:00Z", "run_id": RUN,
                    "slot": 4, "provider": "mwapi", "reason": "completed",
                    "usage": {"usd": 1.25, "input_tokens": 20, "output_tokens": 4}}
        (self.folder / "costs.jsonl").write_text(json.dumps(self.run) + "\n")
        (self.folder / "runs" / (RUN + ".json")).write_text(
            json.dumps({"type": "result", "session_id": SESSION, "total_cost_usd": 1.25}))
        self.events = [
            {"type": "assistant", "timestamp": "2026-11-21T13:57:00Z",
             "message": {"model": "claude-test", "content": [
                 {"type": "thinking", "thinking": "hidden private reasoning"},
                 {"type": "text", "text": "Made a plan. ghp_abcdefghijklmnopqrstuvwxyz12345"},
                 {"type": "tool_use", "name": "Bash", "input": {"command": "echo my-secret-tool-argument"}}]}},
            {"type": "user", "timestamp": "2026-11-21T13:58:00Z",
             "message": {"content": [{"type": "tool_result", "is_error": True,
                                      "content": "private tool output"}]}},
            {"type": "api-request-blob", "timestamp": "2026-11-21T13:59:00Z",
             "message": {"content": [{"type": "text", "text": "untrusted private prompt"}]}},
        ]
        self.transcript.write_text("".join(json.dumps(x) + "\n" for x in self.events))

    def test_real_transcript_is_correlated_redacted_and_not_overclaimed(self):
        result = mod.export_events(self.root, self.project)
        self.assertEqual([e["type"] for e in result],
                         ["assistant_message", "tool_call", "tool_result", "usage"])
        data = json.dumps(result)
        for secret in ["hidden private reasoning", "abcdefghijklmnopqrstuvwxyz12345",
                       "my-secret-tool-argument", "private tool output", "untrusted private prompt"]:
            self.assertNotIn(secret, data)
        self.assertEqual(result[0]["session_id"], SESSION)
        self.assertEqual(result[0]["agent_id"], "slot-4")
        self.assertEqual(result[-1]["usage"]["cost_usd"], 1.25)
        self.assertNotIn("github_action", data)

    def test_missing_transcript_has_truthful_usage_only(self):
        self.transcript.unlink()
        result = mod.export_events(self.root, self.project)
        self.assertEqual([e["type"] for e in result], ["usage"])

    def test_unknown_spend_never_turns_to_zero(self):
        self.run["usage"] = None
        (self.folder / "costs.jsonl").write_text(json.dumps(self.run) + "\n")
        result = mod.export_events(self.root, self.project)
        self.assertIsNone(result[-1]["usage"]["cost_usd"])

    def test_partial_jsonl_and_symlink_do_not_escape_root(self):
        with self.transcript.open("a") as f:
            f.write('{"type":"assistant","timestamp":"incomplete')
        self.assertEqual(len(mod.export_events(self.root, self.project)), 4)
        source = self.transcript.read_text()
        self.transcript.unlink()
        external = Path(self.tmp.name) / "external.jsonl"
        external.write_text(source)
        self.transcript.symlink_to(external)
        self.assertEqual([e["type"] for e in mod.export_events(self.root, self.project)], ["usage"])

    def test_atomic_private_output(self):
        output_dir = Path(self.tmp.name) / "private"
        output_dir.mkdir(mode=0o700)
        destination = output_dir / "events.jsonl"
        mod.atomic_export(destination, mod.export_events(self.root, self.project))
        self.assertEqual(os.stat(destination).st_mode & 0o777, 0o600)
        self.assertEqual(len(destination.read_text().splitlines()), 4)
        self.assertEqual(mod.export_events(self.root, self.project, max_runs=1)[-1]["type"], "usage")
        with self.assertRaises(ValueError):
            mod.export_events(self.root, "../../secrets")
        destination.unlink()
        destination.symlink_to(output_dir / "bad")
        with self.assertRaises(ValueError):
            mod.atomic_export(destination, [])


if __name__ == "__main__":
    unittest.main()
