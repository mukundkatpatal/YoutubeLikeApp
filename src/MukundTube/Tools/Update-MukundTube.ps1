$ErrorActionPreference = 'Stop'

$projectDir = Split-Path -Parent $PSScriptRoot
$appDataDir = Join-Path $env:LOCALAPPDATA 'Youtube Beta'
$publishDir = Join-Path $appDataDir 'App'
$appExePath = Join-Path $publishDir 'Youtube Beta.exe'
$logPath = Join-Path $appDataDir 'update.log'
$lockPath = Join-Path $appDataDir 'update.lock'

New-Item -ItemType Directory -Force -Path $appDataDir | Out-Null

function Write-UpdateLog {
    param([string] $Message)

    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -LiteralPath $logPath -Value "[$timestamp] $Message"
}

if (Test-Path -LiteralPath $lockPath) {
    $lockAge = (Get-Date) - (Get-Item -LiteralPath $lockPath).LastWriteTime
    if ($lockAge.TotalHours -lt 2) {
        Write-UpdateLog 'Another update check appears to be running. Skipping.'
        exit 0
    }
}

New-Item -ItemType File -Force -Path $lockPath | Out-Null

try {
    $repoRoot = (& git -C $projectDir rev-parse --show-toplevel).Trim()
    $branch = (& git -C $repoRoot branch --show-current).Trim()
    $upstream = (& git -C $repoRoot rev-parse --abbrev-ref --symbolic-full-name '@{u}').Trim()

    if ([string]::IsNullOrWhiteSpace($branch) -or [string]::IsNullOrWhiteSpace($upstream)) {
        Write-UpdateLog 'Current branch has no upstream. Skipping.'
        exit 0
    }

    Write-UpdateLog "Checking $branch against $upstream."
    & git -C $repoRoot fetch --prune
    if ($LASTEXITCODE -ne 0) {
        throw "git fetch failed with exit code $LASTEXITCODE."
    }

    $localHead = (& git -C $repoRoot rev-parse HEAD).Trim()
    $remoteHead = (& git -C $repoRoot rev-parse $upstream).Trim()

    if ($localHead -eq $remoteHead) {
        Write-UpdateLog 'Source is already up to date.'
        exit 0
    }

    Write-UpdateLog "New source detected. Local=$localHead Remote=$remoteHead"
    & git -C $repoRoot pull --ff-only
    if ($LASTEXITCODE -ne 0) {
        throw "git pull --ff-only failed with exit code $LASTEXITCODE."
    }

    Write-UpdateLog 'Building updated source.'
    & dotnet build $projectDir
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet build failed with exit code $LASTEXITCODE."
    }

    $runningApp = Get-Process -Name 'Youtube Beta' -ErrorAction SilentlyContinue
    if ($runningApp) {
        Write-UpdateLog 'App is running. Build succeeded, but publish is postponed until the next hourly check.'
        exit 0
    }

    New-Item -ItemType Directory -Force -Path $publishDir | Out-Null
    Write-UpdateLog "Publishing to $publishDir."
    & dotnet publish $projectDir -p:PublishProfile=FolderProfile
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet publish failed with exit code $LASTEXITCODE."
    }

    Write-UpdateLog 'Update published successfully.'

    if (Test-Path -LiteralPath $appExePath) {
        Write-UpdateLog 'Starting Youtube Beta after update.'
        Start-Process -FilePath $appExePath -WorkingDirectory $publishDir
    }
    else {
        Write-UpdateLog "Published app was not found at $appExePath."
    }
}
catch {
    Write-UpdateLog "ERROR: $_"
    exit 1
}
finally {
    Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
}
