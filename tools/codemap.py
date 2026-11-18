"""L0 project map, L1 symbols/contracts, L2 entire source with fresh SHA256."""
import hashlib
import json
from pathlib import Path
import sys
from codemap_parse import inspect

ROOT = Path(__file__).resolve().parent.parent
SUFFIX = {".py",".js",".mjs",".ts",".jsx",".tsx",".ps1",".json",".md"}
EXCLUDE = {".git","node_modules","__pycache__",".venv","data"}
MAX_FILES = 1000
def files():
    count=0
    for p in ROOT.rglob("*"):
        if any(x in EXCLUDE for x in p.relative_to(ROOT).parts):
            continue
        if not p.is_file() or p.is_symlink() or p.suffix.lower() not in SUFFIX:
            continue
        if p.stat().st_size>1048576:
            continue
        yield p
        count+=1
        if count>=MAX_FILES: return
def read(path):
    p=(ROOT/path).resolve(strict=True)
    if not p.is_relative_to(ROOT) or not p.is_file() or p.suffix.lower() not in SUFFIX:
        raise ValueError("path_outside_source")
    if p.stat().st_size>1048576: raise ValueError("file_too_large")
    return p.read_text(encoding="utf-8")
def meta(p,full=False):
    name=p.relative_to(ROOT).as_posix()
    source=read(name)
    result={"file":name,"sha256":hashlib.sha256(source.encode()).hexdigest(),
            "lines":len(source.splitlines()),"bytes":len(source.encode())}
    if full:
        result.update(inspect(name,source))
        result["source"]=source
    return result
def main():
    level=int(sys.argv[1]) if len(sys.argv)>1 else 0
    if level==0:
        entries=[meta(p) for p in files()]
        return {"schema":"mas-codemap-1","level":0,"files":sorted(entries,key=lambda e:e["file"])}
    name=sys.argv[2] if len(sys.argv)>2 else ""
    p=(ROOT/name).resolve(strict=True)
    result=meta(p,True)
    if level==1: result.pop("source")
    elif level!=2: raise ValueError("invalid_level")
    if len(sys.argv)>3 and sys.argv[3] and result["sha256"]!=sys.argv[3]:
        raise ValueError("stale_hash")
    return {"schema":"mas-codemap-1","level":level,**result}
if __name__ == "__main__":
    try:
        print(json.dumps(main(),ensure_ascii=False))
    except (ValueError,OSError,UnicodeError) as e:
        print(json.dumps({"error":str(e)[:120]}));sys.exit(2)
