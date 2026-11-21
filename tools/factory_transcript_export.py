#!/usr/bin/env python3
"""Owner-local Claude transcript adapter, no paid/model/network calls."""
import argparse
import json
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from factory_transcript_io import PROJECT,RUN,SESSION,SAFE_TOOL,SCHEMA,redact,records,result_for,transcript_for,valid_cost,atomic_export

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
