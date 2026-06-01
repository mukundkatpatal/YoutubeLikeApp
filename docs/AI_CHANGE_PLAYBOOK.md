# AI Change Playbook

Use this playbook when an AI coding assistant needs to decide where to edit and
what to verify.

## Before Any Change

1. Read `AGENTS.md`.
2. Identify whether the change affects product guardrails.
3. Check whether the change is current-app work or future-platform planning.
4. Prefer a focused edit over broad scaffolding.
5. Add or update tests for policy logic whenever possible.

## Add Or Change Config Fields

Update these together:

- `config/config.sample.json`
- `src/MukundTube/Models/AppConfig.cs`
- `src/MukundTube/Services/ConfigValidator.cs`
- `preview/app.js` if the preview reads the field
- `docs/SETUP.md`
- tests in `tests/MukundTube.Tests`

Verify:

```powershell
dotnet test .\MukundTube.sln -c Release
```

## Change Feed Policy

Start with:

- `src/MukundTube/Services/FeedComposer.cs`
- `tests/MukundTube.Tests/FeedComposerTests.cs`

Keep policy deterministic. Pinned, blocked, enabled-channel, duplicate, and
shorts behavior should be covered by tests before changing UI code.

## Change YouTube API Behavior

Start with:

- `src/MukundTube/Services/YouTubeDataApiClient.cs`
- `src/MukundTube/Services/FeedService.cs`

Consider:

- quota cost
- pagination
- batching
- unavailable, private, deleted, or non-embeddable videos
- API error handling
- whether the preview needs matching behavior

## Change Playback Or Navigation Safety

Start with:

- `src/MukundTube/Services/YouTubePlayerController.cs`
- `src/MukundTube/Assets/player.html`
- `src/MukundTube/MainWindow.xaml.cs`

Be conservative. Do not loosen navigation, new-window blocking, or video ID
allow-list enforcement unless the user explicitly asks for that risk.

## Change WPF UI

Start with:

- `src/MukundTube/MainWindow.xaml`
- `src/MukundTube/ViewModels/MainViewModel.cs`

Keep the UI calm and child-friendly. Do not add settings, admin, API-key, search,
or sign-in controls to the child-facing app.

## Change Preview UI

Start with:

- `preview/index.html`
- `preview/app.js`
- `preview/styles.css`
- `preview/server.mjs`

The preview is for development confidence. Keep it aligned with config and feed
behavior, but do not treat it as proof of Windows WebView2 safety behavior.

## Add Future Backend Or Cross-Platform Work

Do not scaffold a backend, mobile app, TV app, or recommendation service just
because roadmap docs mention them. First produce:

- PRD
- domain model
- event flows
- permission model
- API quota strategy
- platform compliance review
- migration plan from the current app
