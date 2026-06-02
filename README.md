# Youtube Beta

Youtube Beta is a Windows curated YouTube viewer for a child account. It has no search, no local admin UI, and no sign-in. Approved channels, blocked videos, and pinned videos come from a remote JSON config controlled by the parent.

The production app is WPF + WebView2 for Windows. This repository also includes a Mac browser preview so the feed and config behavior can be checked on this machine.

## Quick Start On This Mac

```bash
node preview/server.mjs
```

Open:

```text
http://localhost:4173/preview/
```

Without a YouTube Data API key, the preview shows sample channels. With a key in local settings, it uses the configured remote JSON URL and shows the approved channel thumbnails first.

For real channel data, create:

```bash
cp preview/settings.local.sample.json preview/settings.local.json
```

Then paste the YouTube Data API key into `preview/settings.local.json`. The file is ignored by Git. The preview has no API-key textbox because the child-facing UI should not expose configuration controls.

## Windows App

The WPF project lives in `src/YoutubeBeta`. It targets `.NET 10` and Windows WPF/WebView2.

Build on Windows:

```powershell
dotnet restore .\YoutubeBeta.sln
dotnet build .\YoutubeBeta.sln -c Release
dotnet test .\YoutubeBeta.sln -c Release
dotnet publish .\src\YoutubeBeta\YoutubeBeta.csproj -c Release -r win-x64 --self-contained true
```

Publish to the local app folder and create/update the desktop shortcut:

```powershell
.\src\YoutubeBeta\Tools\Publish-YoutubeBeta.ps1
```

If local scripts are blocked:

```powershell
powershell -ExecutionPolicy Bypass -File .\src\YoutubeBeta\Tools\Publish-YoutubeBeta.ps1
```

See `docs/PUBLISHING.md` for the full publishing flow.

## Production Settings

On the Windows machine that runs Youtube Beta, create:

```text
%LocalAppData%\Youtube Beta\settings.json
```

Use `config/settings.sample.json` as the template and replace only the API-key
placeholder. Full instructions, including PowerShell and Command Prompt commands,
live in `docs/SETTINGS.md`.

## Remote Config

Create a public GitHub repository named `son-youtube-config` and add `config.json` based on `config/config.sample.json`.

Expected URL:

```text
https://raw.githubusercontent.com/mukundkatpatal/son-youtube-config/main/config.json
```

Use YouTube channel IDs beginning with `UC...`, not handles like `@channelname`.

Download the current GitHub config into this repo:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\Download-Config.ps1
```

Edit the config with the local React admin app:

```powershell
cd admin\config-editor
npm install
npm run dev
```

Then open `http://127.0.0.1:5174`.

## App Updates

Youtube Beta has its own version in `src/YoutubeBeta/YoutubeBeta.csproj`. It checks this remote manifest for source-code updates:

```text
https://raw.githubusercontent.com/mukundkatpatal/son-youtube-config/main/update-manifest.json
```

When the manifest version is newer than the installed app version, the WPF app blocks browsing and sends the user to the configured update URL. Config-only changes still flow through `config.json` and do not require an app update.

## Important Reality Check

This is a curated viewer, not full device lockdown. If a child can install another browser or use YouTube elsewhere, that bypasses the app. Qustodio and Windows account/device restrictions are still part of the real control layer.

## Project Context For AI Agents

This repository includes AI-ready project context so coding assistants can make
safer decisions:

- `AGENTS.md` is the primary operating guide for AI coding agents.
- `docs/ARCHITECTURE.md` explains the current app structure.
- `docs/PRODUCT_GUARDRAILS.md` defines safety and platform constraints.
- `docs/AI_CHANGE_PLAYBOOK.md` explains how to approach common changes.
- `docs/PUBLISHING.md` explains the local publish and desktop shortcut flow.
- `docs/SETTINGS.md` explains production and preview settings files.
- `docs/PRODUCT_STRATEGY.md`, `docs/PRODUCT_REQUIREMENTS.md`, and
  `docs/AI_ROADMAP.md` describe future product direction.

## Sources

- YouTube IFrame Player API: https://developers.google.com/youtube/iframe_api_reference
- YouTube player parameters: https://developers.google.com/youtube/player_parameters
- YouTube Data API: https://developers.google.com/youtube/v3
- YouTube API Developer Policies: https://developers.google.com/youtube/terms/developer-policies
- WebView2 WPF docs: https://learn.microsoft.com/en-us/microsoft-edge/webview2/get-started/wpf
- .NET support policy: https://dotnet.microsoft.com/en-us/platform/support/policy
