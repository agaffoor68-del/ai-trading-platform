$bp = 'c:/Users/SEMISTAR/CodeGPT/ai-trading-platform/backend'
Push-Location $bp
try {
  Invoke-Expression "cmd /c start /B python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 > uvicorn.log 2>&1"
} finally {
  Pop-Location
}
Write-Host 'launcher done' | Out-Null