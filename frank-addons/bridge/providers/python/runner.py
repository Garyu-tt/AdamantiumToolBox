"""Python worker: executes only inside the adapter's Linux namespace."""
import contextlib
import importlib.util
import json
import os
import resource
import sys

def main():
    request = json.load(sys.stdin)
    entry = request["entry"]
    action = request["action"]
    if not isinstance(entry, str) or not isinstance(action, str):
        raise ValueError("invalid request")
    if entry.startswith("/") or ".." in entry.split("/") or "\\" in entry:
        raise ValueError("unsafe entry")
    resource.setrlimit(resource.RLIMIT_CPU, (2, 2))
    resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024,) * 2)
    resource.setrlimit(resource.RLIMIT_FSIZE, (1024 * 1024,) * 2)
    resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))
    sys.path.insert(0, "/addon")
    filename = os.path.join("/addon", entry)
    spec = importlib.util.spec_from_file_location("frank_package", filename)
    if not spec or not spec.loader:
        raise RuntimeError("invalid python entry")
    module = importlib.util.module_from_spec(spec)
    with open(os.devnull, "w", encoding="utf-8") as sink:
        with contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
            spec.loader.exec_module(module)
            handler = getattr(module, "handle")
            result = handler(action, request["params"])
    sys.stdout.write(json.dumps({"result": result}, allow_nan=False))

if __name__ == "__main__":
    try:
        main()
    except Exception:
        sys.stderr.write("frank_python_execution_failed\n")
        sys.exit(1)
