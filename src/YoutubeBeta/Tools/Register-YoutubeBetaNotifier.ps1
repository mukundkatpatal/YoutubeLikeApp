param(
    [switch] $StopRunning,
    [switch] $NoLaunch,
    [switch] $SkipRuntimeInstall
)

$ErrorActionPreference = 'Stop'

$toolsDir = $PSScriptRoot
$projectDir = Split-Path -Parent $toolsDir
$repoRoot = Split-Path -Parent (Split-Path -Parent $projectDir)
$notifierProject = Join-Path $repoRoot 'src\YoutubeBeta.Notifier\YoutubeBeta.Notifier.csproj'
$appDataDir = Join-Path $env:LOCALAPPDATA 'Youtube Beta'
$notifierDir = Join-Path $appDataDir 'Notifier'
$notifierExePath = Join-Path $notifierDir 'Youtube Beta Notifier.exe'
$taskName = 'Youtube Beta Notifier'
$windowsAppSdkVersion = '2.1.3'

function Write-Step {
    param([string] $Message)

    Write-Host "[Youtube Beta Notifier] $Message"
}

function Install-WindowsAppRuntimeIfMissing {
    if ($SkipRuntimeInstall) {
        Write-Step 'Skipping Windows App Runtime install check.'
        return
    }

    $runtimePackage = Get-AppxPackage -Name 'Microsoft.WindowsAppRuntime.2' -ErrorAction SilentlyContinue |
        Where-Object { $_.Architecture -eq 'X64' } |
        Select-Object -First 1

    if ($runtimePackage) {
        Write-Step "Windows App Runtime 2 is installed: $($runtimePackage.Version)."
        return
    }

    $runtimeMsixDir = Join-Path $env:USERPROFILE ".nuget\packages\microsoft.windowsappsdk.runtime\$windowsAppSdkVersion\tools\MSIX\win10-x64"
    if (-not (Test-Path -LiteralPath $runtimeMsixDir)) {
        Write-Step 'Restoring notifier project so Windows App Runtime packages are available.'
        & dotnet restore $notifierProject
        if ($LASTEXITCODE -ne 0) {
            throw "dotnet restore failed with exit code $LASTEXITCODE."
        }
    }

    $packages = @(
        'Microsoft.WindowsAppRuntime.2.msix',
        'Microsoft.WindowsAppRuntime.Main.2.msix',
        'Microsoft.WindowsAppRuntime.Singleton.2.msix',
        'Microsoft.WindowsAppRuntime.DDLM.2.msix'
    )

    foreach ($package in $packages) {
        $packagePath = Join-Path $runtimeMsixDir $package
        if (-not (Test-Path -LiteralPath $packagePath)) {
            throw "Windows App Runtime package was not found at $packagePath."
        }

        Write-Step "Installing $package."
        Add-AppxPackage -Path $packagePath
    }
}

if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    throw 'LOCALAPPDATA is not set. Cannot determine the per-user notifier directory.'
}

Install-WindowsAppRuntimeIfMissing

$runningNotifier = Get-Process -Name 'Youtube Beta Notifier' -ErrorAction SilentlyContinue
if ($runningNotifier) {
    if (-not $StopRunning) {
        throw 'Youtube Beta Notifier is running. Rerun this script with -StopRunning to replace it.'
    }

    Write-Step 'Stopping running notifier before publishing.'
    $runningNotifier | Stop-Process -Force
    Start-Sleep -Seconds 1
}

New-Item -ItemType Directory -Force -Path $notifierDir | Out-Null

Write-Step "Publishing notifier to $notifierDir."
& dotnet publish $notifierProject -c Release -o $notifierDir
if ($LASTEXITCODE -ne 0) {
    throw "dotnet publish failed with exit code $LASTEXITCODE."
}

if (-not (Test-Path -LiteralPath $notifierExePath)) {
    throw "Published notifier was not found at $notifierExePath."
}

Write-Step "Registering per-user logon task '$taskName'."
$action = New-ScheduledTaskAction -Execute $notifierExePath
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'Starts the Youtube Beta update notifier at user logon.' -Force | Out-Null

if (-not $NoLaunch) {
    Write-Step 'Starting notifier.'
    Start-Process -FilePath $notifierExePath -WorkingDirectory $notifierDir -WindowStyle Hidden
}

Write-Step "Notifier executable: $notifierExePath"
