# AI Agent Instructions

This repository is for Youtube Beta, a curated YouTube viewer for a child account.
The app is intentionally not a general YouTube client.

Use this file as the first stop before making code changes. Treat it as more
authoritative than broad roadmap docs when deciding what is safe to implement.

## Product Guardrails

- Do not add search, open browsing, sign-in, comments, uploads, subscriptions, or
  child-facing configuration controls.
- Do not add a local child-accessible admin UI.
- Do not let playback navigate outside approved videos.
- Do not bypass YouTube platform rules by scraping, downloading, removing ads,
  hiding required YouTube branding, or covering official player controls.
- Do not treat the app as full device lockdown. The real safety model also
  depends on Windows child accounts, Qustodio, browser restrictions, and device
  policy.
- Future AI features must be parent-assisted by default. AI may suggest curation
  changes, but parent approval should be required before a child sees content.

## Current Architecture

- `src/MukundTube` is the production Windows WPF app.
- `src/MukundTube/Assets/player.html` hosts the official YouTube iframe player
  inside WebView2.
- `src/MukundTube/Services/YouTubePlayerController.cs` controls WebView2
  navigation and playback allow-list behavior.
- `src/MukundTube/Services/ConfigService.cs` loads remote JSON config and falls
  back to the last valid cached config.
- `src/MukundTube/Services/FeedComposer.cs` applies channel, blocked-video, and
  pinned-video policy.
- `preview` is a browser preview for config/feed behavior. It is not proof of
  Windows WebView2 or parental-control behavior.
- `admin/config-editor` is a parent/admin React app for editing the remote
  GitHub `config.json`.
- `tests/MukundTube.Tests` covers policy and config validation.
- `src/MukundTube/Tools/Publish-YoutubeBeta.ps1` publishes the app to
  `%LocalAppData%\Youtube Beta\App\` and creates the desktop shortcut.
- `tools/Download-Config.ps1` downloads the current GitHub config into
  `config/config.github.json`.

## Build And Test

Run from the repository root:

```powershell
dotnet restore .\MukundTube.sln
dotnet build .\MukundTube.sln -c Release
dotnet test .\MukundTube.sln -c Release
```

Preview app:

```powershell
node .\preview\server.mjs
```

Then open:

```text
http://localhost:4173/preview/
```

React config editor:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\Download-Config.ps1
cd admin\config-editor
npm install
npm run dev
```

Publish local Release app and create/update the desktop shortcut:

```powershell
.\src\MukundTube\Tools\Publish-YoutubeBeta.ps1
```

## Change Guidance

- Preserve the child-first, parent-controlled product model.
- Prefer small changes with tests for feed policy, config validation, update
  behavior, and navigation safety.
- If changing config shape, update `config/config.sample.json`, models,
  validation, docs, preview code, admin config editor code, and tests together.
- If changing settings shape or precedence, update `config/settings.sample.json`,
  `docs/SETTINGS.md`, `src/MukundTube/Models/UserSettings.cs`,
  `src/MukundTube/Services/SettingsService.cs`, and any user-facing status text
  together.
- If changing playback behavior, review `YouTubePlayerController.cs`,
  `Assets/player.html`, YouTube iframe policy, and the official WebView2
  constraints before editing.
- If adding future platform support, write or update architecture docs before
  scaffolding large new projects.

## Documentation Map

- `docs/ARCHITECTURE.md` explains the current technical structure.
- `docs/PRODUCT_GUARDRAILS.md` defines safety and platform constraints.
- `docs/AI_CHANGE_PLAYBOOK.md` describes common change workflows.
- `docs/TESTING.md` lists verification steps.
- `docs/PUBLISHING.md` explains the local publish and desktop shortcut flow.
- `docs/SETTINGS.md` explains production and preview settings files.
- `docs/PRODUCT_STRATEGY.md` captures future vision.
- `docs/PRODUCT_REQUIREMENTS.md` captures product requirements and permissions.
- `docs/AI_ROADMAP.md` frames future AI-assisted curation.
- `docs/DECISIONS.md` records important product and technical decisions.
