"""Deterministic import graph and on-demand context pack for AI agents."""
import json
import posixpath
from pathlib import PurePosixPath
import sys
from codemap import ROOT, files, meta, read
from codemap_parse import inspect
from codemap_relations import collect

def resolve_import(source, spec, known):
    spec=spec.split("?")[0].strip()
    src=PurePosixPath(source)
    if spec.startswith("/ui/"):
        spec="/standards"+spec
    if spec.startswith("/"):
        name=spec.lstrip("/")
    elif spec.startswith(".") and source.endswith(".py") and not spec.startswith(("./","../")):
        dots=len(spec)-len(spec.lstrip("."))
        base=src.parent
        for _ in range(max(0,dots-1)): base=base.parent
        name=str(base/spec[dots:].replace(".","/"))
    elif spec.startswith(("./","../")):
        name=posixpath.normpath(str(src.parent/spec))
    elif source.endswith(".py") and ":" not in spec:
        name=spec.replace(".","/")
    else:
        return None
    if name.startswith("../") or name=="..": return None
    variants=[name,name+".js",name+".mjs",name+".ts",name+".py",
              name+"/index.js",name+"/__init__.py"]
    for candidate in variants:
        if candidate in known: return candidate
    return None

def build():
    entries=sorted((meta(p) for p in files()),key=lambda n:n["file"])
    known={e["file"] for e in entries}
    edges=[]
    for entry in entries:
        path=entry["file"]
        if not path.endswith((".js",".mjs",".ts",".jsx",".tsx",".py")):continue
        parsed=inspect(path,read(path))
        for spec in parsed["imports"]:
            target=resolve_import(path,spec,known)
            if target and target!=path:
                edges.append({"from":path,"to":target,"type":"imports",
                              "parser":parsed["language"]})
    edges=sorted({(e["from"],e["to"]):e for e in edges}.values(),
                 key=lambda e:(e["from"],e["to"]))
    return entries,edges

def context(file,sha,entries,edges,relations):
    current={e["file"]:e for e in entries}
    if file not in current:raise ValueError("unknown_file")
    if sha and current[file]["sha256"]!=sha:raise ValueError("stale_hash")
    deps=sorted({e["to"] for e in edges if e["from"]==file})
    users=sorted({e["from"] for e in edges if e["to"]==file})
    near=(deps+users)[:24]
    contracts=[]
    for name in near:
        info=meta(ROOT/name,True)
        info.pop("source")
        info.pop("calls",None)
        contracts.append(info)
    full=meta(ROOT/file,True)
    related=[e for e in relations if e['file']==file or e['from']==file or e['to']==file]
    return {"schema":"mas-context-pack-1","file":file,"revision":full["sha256"],
            "source":full["source"],"symbols":full["symbols"],
            "imports":full["imports"],"dependencies":deps,"dependents":users,
            "contracts":contracts,"total_modules":len(entries),
            "truncated_neighbors":len(deps)+len(users)>24,
            "relations":related[:48],"truncated_relations":len(related)>48}

def main():
    entries,edges=build()
    relations=collect(ROOT,{e['file'] for e in entries})
    mode=sys.argv[1] if len(sys.argv)>1 else "graph"
    if mode=="graph":
        return {"schema":"mas-codegraph-1","nodes":entries,"edges":edges,
                "relations_schema":"mas-code-relations-1","relations":relations,
                "parser_note":"Python AST; JavaScript lexical imports, partial"}
    if mode=="context":
        return context(sys.argv[2],sys.argv[3] if len(sys.argv)>3 else "",entries,edges,relations)
    raise ValueError("unknown_mode")
try:
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(main(),ensure_ascii=False))
except (ValueError,OSError,UnicodeError,IndexError) as error:
    print(json.dumps({"error":str(error)[:140]}));sys.exit(2)
