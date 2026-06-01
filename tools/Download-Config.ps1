param(
    [string] $ConfigUrl = 'https://raw.githubusercontent.com/mukundkatpatal/son-youtube-config/main/config.json',
    [string] $OutputPath = 'config/config.github.json',
    [string] $EditorOutputPath = 'admin/config-editor/src/default-config.json'
)

$ErrorActionPreference = 'Stop'

$client = [System.Net.WebClient]::new()
$client.Encoding = [System.Text.Encoding]::UTF8
$json = $client.DownloadString($ConfigUrl)
$config = $json | ConvertFrom-Json

$resolvedOutput = Join-Path (Get-Location) $OutputPath
$outputDirectory = Split-Path -Parent $resolvedOutput
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$normalizedJson = $config | ConvertTo-Json -Depth 20
[System.IO.File]::WriteAllText($resolvedOutput, $normalizedJson + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))

Write-Host "Downloaded config to $resolvedOutput"

if (-not [string]::IsNullOrWhiteSpace($EditorOutputPath)) {
    $resolvedEditorOutput = Join-Path (Get-Location) $EditorOutputPath
    $editorOutputDirectory = Split-Path -Parent $resolvedEditorOutput
    New-Item -ItemType Directory -Force -Path $editorOutputDirectory | Out-Null
    [System.IO.File]::WriteAllText($resolvedEditorOutput, $normalizedJson + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Mirrored config to $resolvedEditorOutput"
}
