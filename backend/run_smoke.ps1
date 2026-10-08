$bp = 'c:/Users/SEMISTAR/CodeGPT/ai-trading-platform/backend'
Push-Location $bp
$server = Start-Process -FilePath python -ArgumentList '-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000' -RedirectStandardOutput 'uvicorn.log' -RedirectStandardError 'uvicorn.err' -WorkingDirectory $bp -PassThru
Write-Host ('api server pid: {0}' -f $server.Id)

$deadline = (Get-Date).AddSeconds(25)
$up = $false
while ((Get-Date) -lt $deadline) {
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    if ($c.Connect('127.0.0.1', 8000)) { $up = $true; break }
  } catch {}
  [System.Threading.Thread]::Sleep(200)
}
if (-not $up) { Write-Host 'SERVER FAILED TO START'; exit 1 }
Write-Host 'server is up'

$cli = New-Object System.Net.Http.HttpClient
$cli.Timeout = [TimeSpan]::FromSeconds(10)
$tests = @(
  '/api/health',
  '/api/market/quotes?symbols=RELIANCE,TCS,HDFCBANK',
  '/api/market/history/RELIANCE?tf=1d&period=1y',
  '/api/ai/insights',
  '/api/positions',
  '/api/positions/summary',
  '/api/trades/history?symbol=RELIANCE&as_markers=true',
  '/api/strategy/list',
  '/api/news',
  '/auth/config-status',
  '/api/data/candles'
)
foreach ($t in $tests) {
  try {
    $r = $cli.GetAsync($t).Result
    $body = $r.Content.ReadAsStringAsync().Result
    $len = $body.Length
    $short = 220
    if ($len -gt 220) { $short = 220 }
    $line = "$t -> {$r.StatusCode} " + $body.Substring(0, $short)
    Write-Host $line
    Add-Content -Path 'smoke_results.txt' -Value $line
  } catch {
    $line = "$t -> ERROR " + $_.Exception.Message
    Write-Host $line
    Add-Content -Path 'smoke_results.txt' -Value $line
  }
}
Write-Host 'RESULTS WRITTEN'
