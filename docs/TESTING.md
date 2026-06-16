# Testing

Run commands from the repository root.

## Standard Verification

```powershell
dotnet restore .\YoutubeBeta.sln
dotnet build .\YoutubeBeta.sln -c Release
dotnet test .\YoutubeBeta.sln -c Release
```

## Browser Preview

```powershell
node .\preview\server.mjs
```

Open:

```text
http://localhost:4173/preview/
```

The preview can help verify:

- config shape
- feed layout
- sample-data behavior
- thumbnail display
- basic YouTube embed behavior

The preview cannot verify:

- WPF behavior
- WebView2 navigation restrictions
- Windows parental-control integration
- packaging and update installation
- Qustodio behavior on the target machine

## Node API

Run from `apps/api`:

```bash
npm run typecheck
npm test
npm run build
```

The API tests should cover:

- parent auth and allowlist behavior
- admin config save/load
- child profile create/list/disable/rotate
- child token rejection for missing or invalid tokens
- child bootstrap returning only enabled approved channels
- child video pages rejecting unapproved channels
- blocked/private/deleted videos excluded from child results
- pinned videos sorted before normal newest videos
- stale YouTube cache refresh attempted server-side with cached fallback
- child PWA app-version force-update decisions

## Child PWA

Run from `apps/kids`:

```bash
npm run build
```

Manual checks:

- open `/setup?token=...` and verify the token is removed from the URL
- verify approved channels load from `/kids/bootstrap`
- refresh the page and verify cached channels appear before network refresh
- open a channel and verify approved videos load
- refresh a channel after API sleep/offline and verify cached video metadata is
  still shown when available
- select a video and verify it uses an official YouTube iframe embed
- set API minimum supported version above `VITE_APP_VERSION` and verify the PWA
  blocks browsing with an update screen
- verify no search, Google sign-in, admin controls, or raw YouTube API key
  inputs appear in the child app

## Windows Manual Checks

On a Windows target machine, verify:

- the app starts fullscreen or maximized as expected
- missing API key shows a useful message
- invalid remote config falls back to last good cached config
- approved channels load
- blocked videos do not appear
- pinned videos appear first
- selecting a video plays only that video
- related-video or iframe navigation attempts do not allow unapproved playback
- new windows are blocked
- update-required state blocks browsing and opens the configured update URL

## Test Coverage Priorities

High-value automated tests:

- config validation
- feed policy
- pinned and blocked interaction
- duplicate video handling
- disabled channel behavior
- update manifest parsing
- settings merge precedence
- API response mapping where practical
- child API token-to-family policy
- child feed cache fallback

Lower-value or manual-only areas:

- WPF visual layout
- WebView2 runtime behavior
- YouTube iframe internals
- operating-system parental controls
