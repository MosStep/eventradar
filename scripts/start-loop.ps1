# Starts scripts/loop.ps1 detached: a hidden window that keeps running after this terminal or Claude closes.
# No second copy: loop.ps1 holds the "Global\EventRadarLoop" mutex for its whole life, so if the mutex exists the loop
# is already running and nothing is started.
$ErrorActionPreference = "Continue"
$mutexName = "Global\EventRadarLoop"
$running = $false
try {
  $m = [System.Threading.Mutex]::OpenExisting($mutexName)
  $m.Dispose()
  $running = $true
} catch [System.Threading.WaitHandleCannotBeOpenedException] {
  $running = $false
}
if ($running) {
  "loop is already running - not starting a second copy (stop it with scripts\stop-loop.ps1)"
  exit 0
}
$loop = Join-Path $PSScriptRoot "loop.ps1"
Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$loop`""
Start-Sleep -Seconds 3
$ok = $false
try { $m = [System.Threading.Mutex]::OpenExisting($mutexName); $m.Dispose(); $ok = $true } catch { $ok = $false }
if ($ok) { "loop started (hidden)" } else { "loop did not start - see the log" }
"log: $(Join-Path $env:LOCALAPPDATA 'EventRadar\loop.log')"
