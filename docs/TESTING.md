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

Lower-value or manual-only areas:

- WPF visual layout
- WebView2 runtime behavior
- YouTube iframe internals
- operating-system parental controls
