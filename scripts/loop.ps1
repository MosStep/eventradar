# Local extraction loop on the unlimited Nemotron key: each round extracts a few batches per country (upcoming events
# first), checks/fills details, then commits and pushes data. Started at logon by the "EventRadar loop" scheduled task.
# Keys come from the user environment (TENIXE_KEYS, TENIXE_NEMOTRON_KEYS) - never from files.
$ErrorActionPreference = "Continue"
Set-Location (Split-Path $PSScriptRoot -Parent)

# Only one loop at a time (the task may fire while a manual run is going).
$mutex = New-Object System.Threading.Mutex($false, "Global\EventRadarLoop")
if (-not $mutex.WaitOne(0)) { "another loop is already running"; exit 0 }

foreach ($k in "TENIXE_KEYS", "TENIXE_NEMOTRON_KEYS") {
  if (-not (Get-Item "Env:$k" -ErrorAction SilentlyContinue)) {
    $v = [Environment]::GetEnvironmentVariable($k, "User")
    if ($v) { Set-Item "Env:$k" $v }
  }
}
if (-not $env:TENIXE_NEMOTRON_KEYS -and -not $env:TENIXE_KEYS) { "no API keys in the environment - see TODO.md"; exit 1 }

$env:EXTRACT_MODELS = "nemotron-3-ultra"
$env:DESCRIBE_MODELS = "nemotron-3-ultra"
$log = Join-Path $env:LOCALAPPDATA "EventRadar\loop.log"
New-Item -ItemType Directory -Force (Split-Path $log) | Out-Null
$round = 0
while ($true) {
  $round++
  $fetch = ($round -eq 1 -or $round % 12 -eq 0)
  $opts = @("--max-batches=4", "--max-describe=80", "--max-verify=20", "--max-dates=30", "--max-price=40", "--split=20", "--budget-min=50")
  $opts = if ($fetch) { @("--window=1d") + $opts } else { @("--no-fetch") + $opts }
  "=== round $round $(Get-Date -Format 'yyyy-MM-dd HH:mm') $opts" | Tee-Object -Append $log
  git pull -q --rebase --autostash origin main 2>&1 | Out-Null
  node pipeline/run.mjs @opts 2>&1 | ForEach-Object { "$_" } | Tee-Object -Append $log
  git add data | Out-Null
  git commit -q -m "data: local Nemotron round $round" | Out-Null
  git pull -q --rebase --autostash -X theirs origin main 2>&1 | Out-Null
  # A conflicting merge can leave half-merged JSON: then keep this round's own files.
  node -e "JSON.parse(require('fs').readFileSync('data/events.json','utf8'));JSON.parse(require('fs').readFileSync('data/raw.json','utf8'))" 2>$null
  if ($LASTEXITCODE -ne 0) { "merged JSON broken, keeping local data" | Tee-Object -Append $log; git checkout ORIG_HEAD -- data 2>&1 | Out-Null; git commit -qam "data: keep local round $round" | Out-Null }
  git push -q origin main 2>&1 | Out-Null
  # Watchdog: GitHub runs schedules best-effort. If no scheduled/manual run has finished in 6 hours, start one, so the
  # site keeps updating (and the e-mail alerts keep working) even when GitHub skips slots.
  # A run that is queued or still going counts as alive, so the watchdog never piles up extra runs.
  $busy = gh run list -R MosStep/eventradar --workflow daily.yml --limit 10 --json event,status -q '[.[] | select(.event != \"push\" and .status != \"completed\")] | length' 2>$null
  $last = gh run list -R MosStep/eventradar --workflow daily.yml --limit 10 --json event,status,createdAt -q '[.[] | select(.event != \"push\")][0].createdAt' 2>$null
  if ([int]$busy -eq 0 -and (-not $last -or ((Get-Date).ToUniversalTime() - [datetime]::Parse($last).ToUniversalTime()).TotalHours -gt 6)) {
    "    no GitHub run in 6h - starting one" | Tee-Object -Append $log
    gh workflow run daily.yml -R MosStep/eventradar --ref main 2>&1 | Out-Null
  }
  $left = node -e "const r=require('./data/raw.json');console.log(Object.values(r).filter(x=>x.status==='new').length)"
  "    pending headlines: $left" | Tee-Object -Append $log
  # The provider was busy (rate limit / quota) in this round: give it 20 extra minutes before the next one.
  $aiDown = node -e "try { console.log(require('./data/status.json').ai.down === true) } catch (e) { console.log(false) }"
  if ("$aiDown".Trim() -eq "True" -or "$aiDown".Trim() -eq "true") { "    AI provider busy - waiting 20 min extra" | Tee-Object -Append $log; Start-Sleep -Seconds 1200 }
  # Backlog done: keep going but slowly - one round an hour picks up news the 4-a-day GitHub runs missed.
  if ([int]$left -lt 50) { Start-Sleep -Seconds 3600 }
}
