#!/usr/bin/env python3
"""Offline, owner-local export of Claude Code session diagnostics.

Converts existing factory costs + exact UUID-matched Claude Code transcripts
to the *read-only* factory-diagnostic-event/1 viewer format. No network,
provider calls, task selection, or GitHub mutation. Never output private
thinking, tool arguments, or raw tool results.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import stat
import tempfile

PROJECT = re.compile(r"^[a-z0-9-]{1,40}$")
RUN = re.compile(r"^[0-9]{1,3}-[0-9]{8,12}-[0-9a-f]{6,12}$")
SESSION = re.compile(r"^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$")
SAFE_TOOL = re.compile(r"^[\w.-]{1,60}$")
SCHEMA = "factory-diagnostic-event/1"
SECRET = (
    re.compile(r"\b(?:sk-[A-Za-z0-9_-]{12,}|github_pat_[A-Za-z0-9_]{18,}|gh[pousr]_[A-Za-z0-9_]{18,})\b"),
    re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/-]{12,}"),
    re.compile(r"(?i)\b((?:api[_-]?key|access[_-]?token|password|secret|authorization)\s*[:=]\s*)[\"']?[^\s\"',;]+"),
)


def redact(value: object, limit: int = 1800) -> str:
    result = str(value if value is not None else "")
    for pattern in SECRET:
        result = pattern.sub("[REDACTED]", result)
    if len(result) > limit:
        result = result[:limit] + " [TRUNCATED]"
    return result


def records(path: Path, max_bytes: int = 4_000_000) -> list[dict]:
    """Read only complete JSONL records from a regular non-symlink file."""
    if path.is_symlink() or not path.is_file():
        return []
    size = path.stat().st_size
    with path.open("rb") as f:
        start = max(0, size - max_bytes)
        f.seek(start)
        if start:
            f.readline()
        data = f.read(max_bytes).decode("utf-8", errors="replace")
    if data and not data.endswith("\n"):
        data = data.rsplit("\n", 1)[0]
    out: list[dict] = []
    for line in data.splitlines():
        try:
            item = json.loads(line)
            if isinstance(item, dict):
                out.append(item)
        except ValueError:
            pass
    return out


def result_for(path: Path) -> dict:
    if path.is_symlink() or not path.is_file() or path.stat().st_size > 40_000_000:
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8", errors="replace"))
        if isinstance(value, dict) and value.get("type") == "result":
            return value
    except ValueError:
        pass
    for event in reversed(records(path)):
        if event.get("type") == "result":
            return event
    return {}


def transcript_for(root: Path, session: str) -> Path | None:
    """Find exact UUID file without following symlink directories or files."""
    if not SESSION.fullmatch(session):
        return None
    base = root / ".claude" / "projects"
    if base.is_symlink() or not base.is_dir():
        return None
    for directory in base.iterdir():
        if directory.is_symlink() or not directory.is_dir():
            continue
        path = directory / (session + ".jsonl")
        if not path.is_symlink() and path.is_file():
            return path
    return None


def valid_cost(usage: object) -> float | None:
    if not isinstance(usage, dict):
        return None
    value = usage.get("usd")
    return float(value) if type(value) in (float, int) and 0 <= value < 1e8 else None


def export_events(root: Path, project: str, max_runs: int = 100) -> list[dict]:
    if not PROJECT.fullmatch(project):
        raise ValueError("invalid_project")
    if not isinstance(max_runs, int) or not 1 <= max_runs <= 500:
        raise ValueError("invalid_limit")
    costs = root / "projects" / project / "costs.jsonl"
    runs = root / "projects" / project / "runs"
    events: list[dict] = []
    for run in records(costs, max_bytes=10_000_000)[-max_runs:]:
        run_id = run.get("run_id")
        slot = run.get("slot")
        if not isinstance(run_id, str) or not RUN.fullmatch(run_id) or type(slot) is not int or not 1 <= slot <= 128:
            continue
        result = result_for(runs / (run_id + ".json"))
        session = result.get("session_id") if isinstance(result.get("session_id"), str) else None
        session = session if session and SESSION.fullmatch(session) else run_id
        base = {
            "schema": SCHEMA,
            "agent_id": "slot-" + str(slot),
            "session_id": session,
            "provider": redact(run.get("provider") or "unknown", 80),
        }
        transcript = transcript_for(root, session)
        if transcript:
            for record in records(transcript):
                stamp = record.get("timestamp")
                if not isinstance(stamp, str) or len(stamp) < 20:
                    continue
                message = record.get("message")
                if not isinstance(message, dict):
                    continue
                if record.get("type") == "assistant" and not record.get("isSidechain"):
                    blocks = message.get("content")
                    if not isinstance(blocks, list):
                        continue
                    model = redact(message.get("model") or "unknown", 80)
                    for block in blocks:
                        if not isinstance(block, dict):
                            continue
                        if block.get("type") == "text" and isinstance(block.get("text"), str):
                            if block["text"].strip():
                                events.append({**base, "at": stamp, "type": "assistant_message",
                                    "role": "assistant", "model": model, "text": redact(block["text"])})
                        elif block.get("type") == "tool_use":
                            name = block.get("name")
                            if isinstance(name, str) and SAFE_TOOL.fullmatch(name):
                                events.append({**base, "at": stamp, "type": "tool_call", "role": "assistant",
                                    "model": model, "text": "Called " + name + "; execution not verified"})
                elif record.get("type") == "user":
                    blocks = message.get("content")
                    if isinstance(blocks, list):
                        for block in blocks:
                            if isinstance(block, dict) and block.get("type") == "tool_result":
                                events.append({**base, "at": stamp, "type": "tool_result", "role": "tool",
                                    "text": "Tool response recorded; raw output withheld",
                                    "status": "error" if block.get("is_error") else "observed"})
        at = run.get("at")
        if isinstance(at, str) and len(at) >= 20:
            events.append({**base, "at": at, "type": "usage", "status": str(run.get("reason") or "unknown")[:60],
                "usage": {"input_tokens": (run.get("usage") or {}).get("input_tokens") if isinstance(run.get("usage"), dict) else None,
                    "output_tokens": (run.get("usage") or {}).get("output_tokens") if isinstance(run.get("usage"), dict) else None,
                    "cost_usd": valid_cost(run.get("usage"))}})
    events.sort(key=lambda row: row["at"])
    return events


def atomic_export(path: Path, events: list[dict]) -> None:
    """Write a private 0600 snapshot, never append duplicate logs or touch source."""
    if path.is_symlink():
        raise ValueError("output_symlink")
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    if stat.S_IMODE(path.parent.stat().st_mode) & 0o077:
        raise PermissionError("output_parent_not_private")
    fd, temp = tempfile.mkstemp(prefix=".factory-diag-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            for item in events:
                handle.write(json.dumps(item, ensure_ascii=False, separators=(",", ":")) + "\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temp, 0o600)
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True, help="Owner-private Claude Factory home")
    parser.add_argument("--project", required=True)
    parser.add_argument("--out", type=Path, required=True, help="Private NDJSON destination")
    parser.add_argument("--max-runs", type=int, default=100)
    args = parser.parse_args()
    events = export_events(args.root, args.project, args.max_runs)
    atomic_export(args.out, events)
    print(json.dumps({"events": len(events), "project": args.project, "output": str(args.out)}))


if __name__ == "__main__":
    main()
