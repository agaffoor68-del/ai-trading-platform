import os, sys, time, subprocess

if os.fork() > 0:
    sys.exit(0)
os.setsid()
if os.fork() > 0:
    sys.exit(0)

os.chdir('c:/Users/SEMISTAR/CodeGPT/ai-trading-platform/backend')
with open('uvicorn.log', 'wb') as out:
    subprocess.Popen(
        [sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'],
        stdout=out, stderr=out,
    )
while True:
    time.sleep(3600)
