param(
    [switch] $StopRunning,
    [switch] $Launch
)

$ErrorActionPreference = 'Stop'

$projectDir = Split-Path -Parent $PSScriptRoot
$appDataDir = Join-Path $env:LOCALAPPDATA 'Youtube Beta'
$publishDir = Join-Path $appDataDir 'App'
$appExePath = Join-Path $publishDir 'Youtube Beta.exe'
$desktopDir = [Environment]::GetFolderPath('DesktopDirectory')
$shortcutPath = Join-Path $desktopDir 'Youtube Beta.lnk'

function Write-Step {
    param([string] $Message)

    Write-Host "[Youtube Beta] $Message"
}

if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    throw 'LOCALAPPDATA is not set. Cannot determine the per-user publish directory.'
}

$runningApp = Get-Process -Name 'Youtube Beta' -ErrorAction SilentlyContinue
if ($runningApp) {
    if (-not $StopRunning) {
        throw 'Youtube Beta is running. Close it first or rerun this script with -StopRunning.'
    }

    Write-Step 'Stopping running Youtube Beta process before publishing.'
    $runningApp | Stop-Process -Force
    Start-Sleep -Seconds 1
}

New-Item -ItemType Directory -Force -Path $publishDir | Out-Null

Write-Step "Publishing Release build to $publishDir."
& dotnet publish $projectDir -p:PublishProfile=FolderProfile
if ($LASTEXITCODE -ne 0) {
    throw "dotnet publish failed with exit code $LASTEXITCODE."
}

if (-not (Test-Path -LiteralPath $appExePath)) {
    throw "Published app was not found at $appExePath."
}

Write-Step "Creating desktop shortcut at $shortcutPath."
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $appExePath
$shortcut.WorkingDirectory = $publishDir
$shortcut.IconLocation = $appExePath
$shortcut.Description = 'Launch the published Youtube Beta app.'
$shortcut.Save()

Write-Step "Published executable: $appExePath"
Write-Step "Desktop shortcut: $shortcutPath"

if ($Launch) {
    Write-Step 'Starting Youtube Beta.'
    Start-Process -FilePath $appExePath -WorkingDirectory $publishDir
}
