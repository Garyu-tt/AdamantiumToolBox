"""Opt-in local synthetic HTTP latency probe. Never a GUI/FPS measurement."""
import json
import statistics
import sys
import time
from mas_http_test import ACTION, call, server, stop
runs=int(sys.argv[2]) if len(sys.argv)>2 else 150
if not 10<=runs<=2000: raise ValueError("unsafe_request_count")
p,port=server("graphics.provider")
payload={"action":ACTION,"params":{"kind":"image","format":"image/svg+xml",
    "prompt":"Mechanicus native latency","options":{"width":512,"height":320}}}
delays=[]
try:
    for i in range(runs+10):
        start=time.perf_counter()
        code,result=call(port,"/invoke","POST",payload)
        delta=1000*(time.perf_counter()-start)
        if code!=200 or result.get("result",{}).get("status")!="completed":
            raise RuntimeError("benchmark request failed")
        if i>=10:delays.append(delta)
finally: stop(p)
sorted_=sorted(delays)
print(json.dumps({"requests":runs,"p50_ms":round(statistics.median(delays),3),
    "p95_ms":round(sorted_[int(.95*(runs-1))],3),
    "max_ms":round(max(delays),3),
    "scope":"local loopback CPU SVG HTTP only, not GUI, FPS or remote network"}))
