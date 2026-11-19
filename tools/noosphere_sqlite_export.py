#!/usr/bin/env python3
"""Read-only raw SQLite snapshot export. Run on a CONSISTENT BACKUP, not live DB."""
import argparse
import base64
import hashlib
import json
import os
import sqlite3
from pathlib import Path
from urllib.parse import quote

def safe_value(value):
    if isinstance(value, bytes):
        return {"sqlite_blob_base64": base64.b64encode(value).decode("ascii")}
    return value

def export(source, destination):
    source = Path(source).resolve(strict=True)
    destination = Path(destination).resolve()
    if destination.exists():
        raise SystemExit("destination_exists: choose an unused directory")
    if source.is_dir():
        raise SystemExit("source_not_a_sqlite_file")
    os.mkdir(destination, 0o700)
    os.mkdir(destination / "tables", 0o700)
    connection = sqlite3.connect(f"file:{quote(str(source), safe='/')}?mode=ro&immutable=1", uri=True)
    connection.execute("PRAGMA query_only = ON")
    connection.row_factory = sqlite3.Row
    check = connection.execute("PRAGMA integrity_check").fetchone()[0]
    if check != "ok":
        raise SystemExit("snapshot_integrity_check_failed: " + str(check))
    rows = connection.execute("SELECT name, sql FROM sqlite_master WHERE type='table' "
                              "AND name NOT LIKE 'sqlite_%' ORDER BY name").fetchall()
    manifest = {"schema": "noosphere-source-sqlite-1", "source_sha256": "",
                "tables": [], "read_only": True, "complete": False}
    digest = hashlib.sha256()
    with source.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    manifest["source_sha256"] = digest.hexdigest()
    for index, table in enumerate(rows):
        name = table["name"]
        filename = f"{index:05d}.jsonl"
        path = destination / "tables" / filename
        sql_name = '"' + name.replace('"', '""') + '"'
        cursor = connection.execute(f"SELECT * FROM {sql_name}")
        fields = [item[0] for item in cursor.description]
        count, checksum = 0, hashlib.sha256()
        with path.open("wb") as output:
            while batch := cursor.fetchmany(500):
                for record in batch:
                    data = {key: safe_value(record[key]) for key in fields}
                    line = (json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
                    output.write(line)
                    checksum.update(line)
                    count += 1
        manifest["tables"].append({"name": name, "sql": table["sql"],
                                   "file": filename, "rows": count,
                                   "sha256": checksum.hexdigest()})
    manifest["complete"] = True
    (destination / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    connection.close()
    return manifest

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("snapshot", help="stable SQLite snapshot source")
    parser.add_argument("destination", help="new private export directory")
    args = parser.parse_args()
    result = export(args.snapshot, args.destination)
    print(json.dumps({"complete": result["complete"],
                      "tables": len(result["tables"]),
                      "rows": sum(t["rows"] for t in result["tables"]),
                      "source_sha256": result["source_sha256"]}))
