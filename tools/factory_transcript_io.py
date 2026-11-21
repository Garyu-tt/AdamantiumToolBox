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

