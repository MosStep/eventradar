# Stops the loop started by scripts/start-loop.ps1 (or by the logon task): first its child processes (the running node
# round and any git call), deepest first, then the loop itself. A rebase left open is finished by the next loop start
# (Resolve-DataRebase in loop.ps1). The mutex is released when the loop process exits.
$ErrorActionPreference = "Continue"

function Get-Children([int]$parentId) {
  Get-CimInstance Win32_Process -Filter "ParentProcessId = $parentId" -ErrorAction SilentlyContinue
}

# Matches "...\scripts\loop.ps1" but not "stop-loop.ps1".
$loops = @(Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match '[\\/]loop\.ps1' -and $_.ProcessId -ne $PID })

if ($loops.Count -eq 0) { "loop is not running"; exit 0 }

foreach ($loop in $loops) {
  # Collect the process tree below the loop, then stop the deepest processes first.
  $tree = @()
  $queue = @($loop.ProcessId)
  while ($queue.Count -gt 0) {
    $pid0 = $queue[0]
    $queue = @($queue | Select-Object -Skip 1)
    foreach ($c in Get-Children $pid0) { $tree += $c; $queue += $c.ProcessId }
  }
  [array]::Reverse($tree)
  foreach ($p in $tree) {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    "stopped child $($p.Name) pid $($p.ProcessId)"
  }
  Stop-Process -Id $loop.ProcessId -Force -ErrorAction SilentlyContinue
  "stopped loop pid $($loop.ProcessId)"
}

Start-Sleep -Seconds 2
$still = $false
try { $m = [System.Threading.Mutex]::OpenExisting("Global\EventRadarLoop"); $m.Dispose(); $still = $true } catch { $still = $false }
if ($still) { "warning: loop mutex still held - check Task Manager" } else { "loop stopped" }
