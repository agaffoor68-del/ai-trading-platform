import json, subprocess, sys, time, urllib.request

BASE = "http://127.0.0.1:8000"

def call(method, path, body=None):
    data = None
    headers = {"Content-Type": "application/json"}
    if body is not None:
        data = json.dumps(body).encode()
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, json.loads(r.read().decode() or "null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "null")
    except Exception as e:
        return None, {"error": repr(e)}

print("starting uvicorn...")
proc = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
                        cwd="backend", stdout=open("backend/uvicorn.log", "wb"), stderr=open("backend/uvicorn.err", "wb"))
for i in range(20):
    st, _ = call("GET", "/api/health")
    if st == 200:
        print("server up:", json.dumps(_))
        break
    time.sleep(0.5)
else:
    print("SERVER FAILED")
    sys.exit(1)

checks = [
    ("GET", "/api/health", None),
    ("GET", "/api/market/quotes?symbols=RELIANCE,TCS,HDFCBANK", None),
    ("GET", "/api/market/history/RELIANCE?tf=1d&period=1y", None),
    ("GET", "/api/ai/insights", None),
    ("GET", "/api/positions", None),
    ("GET", "/api/positions/summary", None),
    ("GET", "/api/trades/history?symbol=RELIANCE&as_markers=true", None),
    ("GET", "/api/strategy/list", None),
    ("GET", "/api/news", None),
    ("GET", "/auth/config-status", None),
    ("GET", "/api/data/candles", None),
]
for method, path, body in checks:
    st, b = call(method, path)
    print(f"[{method}] {path} -> {st}")
    print(json.dumps(b, indent=1)[:400])
print("SMOKE_DONE")
