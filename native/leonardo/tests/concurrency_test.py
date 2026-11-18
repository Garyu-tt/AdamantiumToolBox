"""Bounded worker pool, concurrency and head-of-line blocking regression."""
import concurrent.futures
import socket
import time
from mas_http_test import ACTION, call, server, stop

PAYLOAD={"action":ACTION,"params":{"kind":"render","format":"image/svg+xml",
    "prompt":"parallel-CPU-test","options":{"width":64,"height":64}}}

def stalled(port):
    s=socket.create_connection(("127.0.0.1",port),timeout=2)
    s.sendall(b"GET /health HTTP/1.1\r\nHost: localhost\r\n")
    return s

def parallel():
    p,port=server("graphics.provider",workers=4,limit=32)
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            jobs=[pool.submit(call,port,"/invoke","POST",PAYLOAD) for _ in range(24)]
            results=[task.result(timeout=4) for task in jobs]
        assert len(results)==24
        assert all(code==200 for code,_ in results),results
        assert all(body==results[0][1] for _,body in results)
    finally: stop(p)

def overload():
    p,port=server("graphics.provider",workers=2,limit=2)
    holds=[]
    try:
        holds.append(stalled(port))
        time.sleep(.15)
        start=time.monotonic()
        assert call(port,"/health")[0]==200
        assert time.monotonic()-start<1
        holds.append(stalled(port))
        time.sleep(.15)
        start=time.monotonic()
        code,data=call(port,"/health")
        assert code==503 and data["error"]=="server_busy",(code,data)
        assert time.monotonic()-start<1
        for s in holds:s.close()
        holds.clear()
        for _ in range(60):
            code,_=call(port,"/health")
            if code==200:break
            time.sleep(.05)
        assert code==200
    finally:
        for s in holds:s.close()
        stop(p)
if __name__=="__main__":
    parallel();overload()
    print("LEONARDO_NATIVE_CONCURRENCY_OK parallel, blocked, 503, recovery")
