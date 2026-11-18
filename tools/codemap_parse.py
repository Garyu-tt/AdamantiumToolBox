"""Deterministic syntax hints. Python via AST; JS imports/symbols are lexical, not complete AST."""
import ast
import re
def inspect(path, source):
    imports, symbols, calls = [], [], []
    language = "python-ast" if path.endswith(".py") else "javascript-lexical"
    if path.endswith(".py"):
        try:
            tree = ast.parse(source, filename=path)
            for n in ast.walk(tree):
                if isinstance(n, ast.Import):
                    imports.extend(a.name for a in n.names)
                elif isinstance(n, ast.ImportFrom):
                    imports.append("." * n.level + (n.module or ""))
                elif isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    args = [a.arg for a in n.args.posonlyargs + n.args.args + n.args.kwonlyargs]
                    symbols.append({"name":n.name,"line":n.lineno,"signature":f"{n.name}({', '.join(args)})"})
                elif isinstance(n, ast.ClassDef):
                    symbols.append({"name":n.name,"line":n.lineno,"signature":"class " + n.name})
                elif isinstance(n, ast.Call):
                    x = n.func
                    if isinstance(x, ast.Name): calls.append(x.id)
                    elif isinstance(x, ast.Attribute): calls.append(x.attr)
        except (SyntaxError, ValueError) as e:
            return {"language":language,"error":str(e)[:160],"imports":[],"symbols":[],"calls":[]}
    elif path.endswith((".js",".mjs",".ts",".jsx",".tsx")):
        imports = re.findall(r'\b(?:from\s*|import\s*\(|require\s*\()\s*[\'"]([^\'"]+)', source)
        patterns = [
            r'(?m)^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)',
            r'(?m)^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)',
        ]
        for pattern in patterns:
            for match in re.finditer(pattern, source):
                sig = match.group(1) + "(" + (match.group(2) if match.lastindex == 2 else "") + ")"
                symbols.append({"name":match.group(1),"line":source.count("\n",0,match.start())+1,"signature":sig})
    return {"language":language,"imports":sorted(set(imports)),
            "symbols":sorted(symbols,key=lambda s:s["line"]),
            "calls":sorted(set(calls))[:150]}
