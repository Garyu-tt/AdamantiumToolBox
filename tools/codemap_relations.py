"""Compact, deterministic relations: MAS manifests, module trees, Frank addons."""
import json
import re
from pathlib import PurePosixPath
CAP=re.compile(r"^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+$")
def collect(root,known):
    result=[]
    def many(value):return value[:128] if isinstance(value,list) else []
    def add(file,source,target,kind):
        if isinstance(source,str) and isinstance(target,str):
            result.append({"file":file,"from":source,"to":target,"type":kind})
    def load(path):
        try:
            if (root/path).stat().st_size>1048576:return None
            return json.loads((root/path).read_text(encoding="utf-8"))
        except (ValueError,OSError,UnicodeError):return None
    for path in sorted(known):
        parts=PurePosixPath(path).parts
        if len(parts)<3:continue
        if parts[0] in ("apps","plugins","drafts") and len(parts)==3:
            doc=load(path) if parts[-1] in ("manifest.json","modules.json") else None
            if not isinstance(doc,dict):continue
            if parts[-1]=="manifest.json" and doc.get("mas")=="1.0" and doc.get("id")==parts[1]:
                for name,kind in (("service.mjs","runtime"),("view.js","view"),
                                  ("modules.json","modules")):
                    target="/".join((*parts[:2],name))
                    if target in known:add(path,path,target,kind)
                for edge in many(doc.get("connections")):
                    if not isinstance(edge,dict):continue
                    source,target=edge.get("from"),edge.get("to")
                    if isinstance(source,str) and isinstance(target,str) and \
                       CAP.fullmatch(source) and CAP.fullmatch(target):
                        add(path,"capability://"+source,"capability://"+target,"connection")
            if parts[-1]=="modules.json" and doc.get("schema")=="mas-modules-1" and doc.get("app")==parts[1]:
                count=[0]
                def walk(module,parent=None,depth=0):
                    if not isinstance(module,dict) or depth>64 or count[0]>=4096:return
                    count[0]+=1
                    identity=module.get("id")
                    if not isinstance(identity,str) or not CAP.fullmatch(identity):return
                    subject="module://"+identity
                    if parent:add(path,"module://"+parent,subject,"contains")
                    for cap in many(module.get("provides")):
                        ident=cap.get("id") if isinstance(cap,dict) else None
                        if isinstance(ident,str) and CAP.fullmatch(ident):
                            add(path,subject,"capability://"+ident,"provides")
                    for cap in many(module.get("consumes")):
                        ident=cap.get("id") if isinstance(cap,dict) else None
                        if isinstance(ident,str) and CAP.fullmatch(ident):
                            kind="consumes_optional" if cap.get("optional") is True else "consumes_required"
                            add(path,subject,"capability://"+ident,kind)
                    for child in many(module.get("children")):
                        walk(child,identity,depth+1)
                for module in many(doc.get("modules")):walk(module)
        if parts[0]=="frank-addons" and len(parts)==4 and parts[-1]=="frank-addon.json":
            doc=load(path)
            if not isinstance(doc,dict) or doc.get("schema")!="frank-addon-1" or \
               doc.get("language")!=parts[1] or doc.get("id")!=parts[2]:continue
            source="frank://"+parts[1]+"/"+parts[2]
            entry=doc.get("entry")
            if isinstance(entry,str) and entry and all(s not in (".","..","") for s in entry.split("/")):
                target="/".join((*parts[:3],entry))
                if target in known:add(path,source,target,"entry")
            adapter=doc.get("adapter")
            if isinstance(adapter,str) and CAP.fullmatch(adapter):
                add(path,source,"capability://"+adapter,"bridge_adapter")
    unique={(e["file"],e["from"],e["to"],e["type"]):e for e in result}
    return [unique[k] for k in sorted(unique)]
