"""Loopback regression for native Leonardo MAS provider. Requires no UI."""
import base64
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

BINARY = sys.argv[1]
SECRET = "only-testing-secret-string-long-enough"
ACTION = "leonardo_native_vector.generate"

def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]

def call(port, path, method="GET", body=None, token=SECRET):
    headers = {"X-Internal-Key": token, "Content-Type": "application/json"}
    request = urllib.request.Request(f"http://127.0.0.1:{port}{path}",
        data=None if body is None else json.dumps(body).encode(),
        method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=2) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read())

def server(caps, workers=None, limit=None):
    port = free_port()
    env = {**os.environ, "APP_PORT": str(port), "ADA_INTERNAL_KEY": SECRET,
           "ADA_CAPS": caps}
    if workers is not None: env["MAS_NATIVE_WORKERS"] = str(workers)
    if limit is not None: env["MAS_NATIVE_MAX_INFLIGHT"] = str(limit)
    p = subprocess.Popen([BINARY], env=env, stdout=subprocess.DEVNULL,
                         stderr=subprocess.PIPE)
    for _ in range(80):
        if p.poll() is not None:
            raise RuntimeError(f"server exited: {p.stderr.read()!r}")
        try:
            if call(port, "/health")[0] == 200: return p, port
        except (OSError, urllib.error.URLError):
            time.sleep(.025)
    p.kill()
    raise RuntimeError("native provider failed to bind")

def stop(p):
    p.terminate()
    try: p.communicate(timeout=3)
    except subprocess.TimeoutExpired:
        p.kill(); p.communicate()

def reference(prompt, options):
    if not shutil.which("node"): return None
    script = ('import {vectorSVG} from "./apps/leonardo_vector/scene.mjs";'
              'process.stdout.write(vectorSVG(JSON.parse(process.argv[1]),'
              ' JSON.parse(process.argv[2])))')
    root = Path(__file__).resolve().parents[3]
    return subprocess.check_output(["node", "--input-type=module", "-e", script,
        json.dumps(prompt), json.dumps(options)], cwd=root, timeout=5).decode()

def verify(caps):
    p, port = server(caps)
    try:
        assert call(port, "/health", token="")[1]["app"] == "leonardo_native_vector"
        assert call(port, "/graph", token="bad")[0] == 401
        status, graph = call(port, "/graph")
        assert status == 200 and graph["app"] == "leonardo_native_vector"
        providers = [n for n in graph["nodes"] if n["type"] == "resource"]
        assert len(providers)==1
        assert providers[0]["provider"]["schema"]=="mas-graphics-provider-1"
        request = {"action": ACTION, "params": {"kind": "image",
            "format": "image/svg+xml", "prompt": "test-svg",
            "options": {"width": 48, "height": 32}}}
        status, payload = call(port, "/invoke", "POST", request)
        if not caps:
            assert status == 400 and payload["error"] == "capability_denied"
            return
        assert status == 200, payload
        result = payload["result"]
        assert result["status"] == "completed"
        svg = base64.b64decode(result["artifact"]["data"],validate=True).decode()
        assert svg.startswith('<svg xmlns="http://www.w3.org/2000/svg" width="48"')
        assert svg.count("<circle")+svg.count("<rect")==15
        assert call(port, "/invoke", "POST", request)[1] == payload
        oracle=reference("test-svg", {"width": 48, "height": 32})
        if oracle is not None: assert svg == oracle, "C++ and JS outputs differ"
        mutated=json.loads(json.dumps(request))
        mutated["params"]["options"]["scene"]=[{"type":"text","x":0,"y":12,
            "text":"<script>alert('x')</script>"}]
        _, html = call(port, "/invoke", "POST", mutated)
        safe=base64.b64decode(html["result"]["artifact"]["data"]).decode()
        assert "<script>" not in safe and "&lt;script&gt;" in safe
        for bad in [
            {"action":"other.generate","params":request["params"]},
            {"action":ACTION,"params":{**request["params"],"kind":"video"}},
            {"action":ACTION,"params":{**request["params"],"options":{"width":0}}},
            {"action":ACTION,"params":{**request["params"],"options":{"scene":[
                {"type":"text","x":1,"y":1,"text":"x","fill":"url(evil)"}]}}},
        ]:
            assert call(port, "/invoke", "POST", bad)[0]==400
        assert call(port, "/unknown")[0]==404
    finally: stop(p)

if __name__=="__main__":
    verify("graphics.provider")
    verify("")
    print("LEONARDO_NATIVE_MAS_OK auth, graph, result, JS parity, rejection")
