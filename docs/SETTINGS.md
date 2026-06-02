# Settings

Youtube Beta needs a YouTube Data API key before it can load real channel data.
The app intentionally does not expose an API-key textbox in the child-facing UI.

## Production Windows Settings

Create this file on the Windows machine that runs Youtube Beta:

```text
%LocalAppData%\Youtube Beta\settings.json
```

PowerShell:

```powershell
$folder = Join-Path $env:LOCALAPPDATA "Youtube Beta"
New-Item -ItemType Directory -Force -Path $folder
notepad (Join-Path $folder "settings.json")
```

Command Prompt:

```cmd
mkdir "%LOCALAPPDATA%\Youtube Beta"
notepad "%LOCALAPPDATA%\Youtube Beta\settings.json"
```

Paste this JSON:

```json
{
  "youTubeApiKey": "PASTE_YOUR_YOUTUBE_API_KEY_HERE",
  "configUrl": "https://raw.githubusercontent.com/mukundkatpatal/son-youtube-config/main/config.json",
  "updateManifestUrl": "https://raw.githubusercontent.com/mukundkatpatal/son-youtube-config/main/update-manifest.json",
  "appReferrer": "https://youtubebeta.local/"
}
```

Replace only `PASTE_YOUR_YOUTUBE_API_KEY_HERE` with the real YouTube Data API
key. Save the file and restart Youtube Beta.

The tracked sample lives at `config/settings.sample.json`. Do not commit a real
API key.

## PowerShell Troubleshooting

If Notepad reports that the file name, directory name, or volume label syntax is
incorrect, the command was probably run in Command Prompt instead of PowerShell,
or the local app data environment variable was not available.

In PowerShell, this should print a path like
`C:\Users\YourName\AppData\Local`:

```powershell
echo $env:LOCALAPPDATA
```

If it prints nothing, use this version:

```powershell
$folder = Join-Path ([Environment]::GetFolderPath("LocalApplicationData")) "Youtube Beta"
New-Item -ItemType Directory -Force -Path $folder
notepad (Join-Path $folder "settings.json")
```

## Settings Precedence

`SettingsService` merges settings in this order:

1. defaults from `UserSettings`
2. `settings.local.json` beside `Youtube Beta.exe`
3. `%LocalAppData%\Youtube Beta\settings.json`
4. environment variables

Environment variables win over file settings.

Supported environment variables:

- `YOUTUBE_BETA_YOUTUBE_API_KEY`
- `YOUTUBE_BETA_CONFIG_URL`
- `YOUTUBE_BETA_UPDATE_MANIFEST_URL`
- `YOUTUBE_BETA_APP_REFERRER`

## Development Preview Settings

The browser preview uses:

```text
preview/settings.local.json
```

Create it from:

```text
preview/settings.local.sample.json
```

This file is ignored by Git.

## Common Mistakes

- The production settings file is named `settings.json`, not `settings.jason`.
- JSON requires double quotes around property names and string values.
- Do not add trailing commas.
- Do not commit real API keys.
- Restart Youtube Beta after changing production settings.
