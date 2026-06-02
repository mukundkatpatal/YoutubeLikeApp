$ErrorActionPreference = 'Stop'

$toolsDir = $PSScriptRoot
$projectDir = Split-Path -Parent $toolsDir
$repoRoot = Split-Path -Parent (Split-Path -Parent $projectDir)
$notifierProject = Join-Path $repoRoot 'src\YoutubeBeta.Notifier\YoutubeBeta.Notifier.csproj'

Write-Host '[Youtube Beta Notifier] Checking for recent videos now.'
& dotnet run --project $notifierProject -- --check-videos
if ($LASTEXITCODE -ne 0) {
    throw "Notifier video check failed with exit code $LASTEXITCODE."
}
