# Local extraction loop on the unlimited Nemotron key: each round extracts a few batches per country (upcoming events
# first), checks/fills details, then commits and pushes data. Started at logon by the "EventRadar loop" scheduled task.
# Keys come from the user environment (TENIXE_KEYS, TENIXE_NEMOTRON_KEYS, AIU_KEYS) - never from files.
$ErrorActionPreference = "Continue"
Set-Location (Split-Path $PSScriptRoot -Parent)

# Only one loop at a time (the task may fire while a manual run is going).
$mutex = New-Object System.Threading.Mutex($false, "Global\EventRadarLoop")
if (-not $mutex.WaitOne(0)) { "another loop is already running"; exit 0 }

foreach ($k in "TENIXE_KEYS", "TENIXE_NEMOTRON_KEYS", "AIU_KEYS", "AIU_CONCURRENCY") {
  if (-not (Get-Item "Env:$k" -ErrorAction SilentlyContinue)) {
    $v = [Environment]::GetEnvironmentVariable($k, "User")
    if ($v) { Set-Item "Env:$k" $v }
  }
}
if (-not $env:TENIXE_NEMOTRON_KEYS -and -not $env:TENIXE_KEYS -and -not $env:AIU_KEYS) { "no API keys in the environment - see TODO.md"; exit 1 }

# AIUnlimit allows 120 requests a minute for the whole account, shared with GitHub (daily.yml, AIU_RPM 30) and
# charforge (up to ~40). This loop may use 50 of them, so the three together stay under 120.
if (-not $env:AIU_CONCURRENCY) { $env:AIU_CONCURRENCY = "12" }
if (-not $env:AIU_RPM) { $env:AIU_RPM = "50" }

# Without AIUnlimit keys the loop pins the unlimited Nemotron key; with them the default chains (AIUnlimit first) apply.
if (-not $env:AIU_KEYS) {
  $env:EXTRACT_MODELS = "nemotron-3-ultra"
  $env:DESCRIBE_MODELS = "nemotron-3-ultra"
}
$log = Join-Path $env:LOCALAPPDATA "EventRadar\loop.log"
New-Item -ItemType Directory -Force (Split-Path $log) | Out-Null
# Data sync helpers. During a rebase "theirs" is the commit being replayed, i.e. this runner's data.
function Write-Log([string]$m) { $m | Tee-Object -FilePath $log -Append | Out-Host }

function Test-RebaseOpen {
  $gd = git rev-parse --git-dir 2>$null
  return ((Test-Path (Join-Path $gd "rebase-merge")) -or (Test-Path (Join-Path $gd "rebase-apply")))
}

# Finishes a stopped rebase. Conflicts under data/ take this runner's version; any conflict elsewhere aborts the
# rebase. Returns $false after such an abort.
function Resolve-DataRebase {
  $guard = 0
  while (Test-RebaseOpen) {
    $guard++
    if ($guard -gt 50) { git rebase --abort 2>&1 | Out-Null; return $false }
    $conflicts = @(git diff --name-only --diff-filter=U)
    $other = @($conflicts | Where-Object { $_ -notmatch '^data/' })
    if ($other.Count -gt 0) {
      Write-Log "rebase conflict outside data/, aborting: $($other -join ', ')"
      git rebase --abort 2>&1 | Out-Null
      return $false
    }
    # A path with no "theirs" version (deleted here) fails the checkout; the add below stages the deletion.
    foreach ($f in $conflicts) { git checkout --theirs -- $f 2>&1 | Out-Null }
    git add -A data 2>&1 | Out-Null
    git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) { git rebase --skip 2>&1 | Out-Null }
    else { $env:GIT_EDITOR = "true"; git rebase --continue 2>&1 | Out-Null }
  }
  return $true
}

# Publishes the local data commit: up to 5 attempts of fetch, rebase onto origin/main, conflict resolution,
# JSON check, push. A broken merge or a rejected push starts the next attempt after a short random pause.
function Publish-Data([int]$round) {
  for ($attempt = 1; $attempt -le 5; $attempt++) {
    $before = git rev-parse HEAD
    git fetch -q origin main 2>&1 | Out-Null
    git rebase -q origin/main 2>&1 | Out-Null
    if (-not (Resolve-DataRebase)) { return $false }
    node -e "JSON.parse(require('fs').readFileSync('data/events.json','utf8'));JSON.parse(require('fs').readFileSync('data/raw.json','utf8'))" 2>$null
    if ($LASTEXITCODE -ne 0) {
      Write-Log "merged JSON broken (round $round, attempt $attempt), undoing this attempt"
      git reset -q --hard $before 2>&1 | Out-Null
    } else {
      git push -q origin main 2>&1 | Out-Null
      if ($LASTEXITCODE -eq 0) { return $true }
      Write-Log "push rejected (round $round, attempt $attempt), retrying"
    }
    Start-Sleep -Milliseconds (Get-Random -Minimum 2000 -Maximum 15000)
  }
  Write-Log "round ${round}: data not published after 5 attempts"
  return $false
}

$round = 0
while ($true) {
  $round++
  $fetch = ($round -eq 1 -or $round % 12 -eq 0)
  $batches = if ($env:AIU_KEYS) { "--max-batches=40" } else { "--max-batches=4" }
  $opts = @($batches, "--max-describe=80", "--max-verify=20", "--max-dates=30", "--max-price=40", "--split=20", "--budget-min=50")
  $opts = if ($fetch) { @("--window=1d") + $opts } else { @("--no-fetch") + $opts }
  "=== round $round $(Get-Date -Format 'yyyy-MM-dd HH:mm') $opts" | Tee-Object -Append $log
  git pull -q --rebase --autostash origin main 2>&1 | Out-Null
  if (-not (Resolve-DataRebase)) { Write-Log "pre-round sync: conflict outside data/" }
  node pipeline/run.mjs @opts 2>&1 | ForEach-Object { "$_" } | Tee-Object -Append $log
  git add data | Out-Null
  git commit -q -m "data: local Nemotron round $round" | Out-Null
  Publish-Data $round | Out-Null
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
