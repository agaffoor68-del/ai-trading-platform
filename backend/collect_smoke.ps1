$out = 'c:/Users/SEMISTAR/CodeGPT/ai-trading-platform/backend/smoke_results.txt'
$file = 'c:/Users/SEMISTAR/CodeGPT/ai-trading-platform/backend/run_smoke.ps1'
Start-Process -FilePath 'powershell' -ArgumentList '-ExecutionPolicy','Bypass','-File',$file -WindowStyle Hidden
for ($i=0; $i -lt 60; $i++) {
  Start-Sleep -Milliseconds 500
  if (Test-Path $out) { break }
}
if (Test-Path $out) { Get-Content $out | Write-Host } else { Write-Host 'NO OUTPUT file after 30s' }
