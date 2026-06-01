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
- `tests/MukundTube.Tests` covers policy and config validation.

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

## Change Guidance

- Preserve the child-first, parent-controlled product model.
- Prefer small changes with tests for feed policy, config validation, update
  behavior, and navigation safety.
- If changing config shape, update `config/config.sample.json`, models,
  validation, docs, preview code, and tests together.
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
- `docs/PRODUCT_STRATEGY.md` captures future vision.
- `docs/PRODUCT_REQUIREMENTS.md` captures product requirements and permissions.
- `docs/AI_ROADMAP.md` frames future AI-assisted curation.
- `docs/DECISIONS.md` records important product and technical decisions.
