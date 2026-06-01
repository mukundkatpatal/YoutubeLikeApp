# Architecture

Youtube Beta is a Windows WPF app that presents a parent-curated YouTube feed to
a child. The current implementation favors a small local app with remote config
over a backend-heavy platform.

## Runtime Shape

```text
Remote config JSON
        |
        v
ConfigService -> ConfigValidator -> cached last-good config
        |
        v
FeedService -> YouTubeDataApiClient -> YouTube Data API
        |
        v
FeedComposer -> approved videos, pinned videos, blocked videos
        |
        v
MainViewModel -> WPF UI -> YouTubePlayerController -> WebView2 iframe player
```

## Production App

`src/MukundTube` contains the production Windows app.

- `MainWindow.xaml` defines the WPF layout.
- `MainWindow.xaml.cs` wires services, update checks, refresh, channel selection,
  video selection, and shutdown cleanup.
- `ViewModels/MainViewModel.cs` owns UI state for channels, videos, shorts,
  selection, loading status, and update-required state.
- `Services/SettingsService.cs` loads local settings and environment overrides.
- `Services/ConfigService.cs` fetches remote config and caches the last valid
  config.
- `Services/FeedService.cs` calls YouTube APIs and delegates policy to
  `FeedComposer`.
- `Services/FeedComposer.cs` applies the local content policy.
- `Services/YouTubePlayerController.cs` initializes WebView2, hosts the local
  player asset, sets request referrers, blocks new windows, and stops playback
  when a video ID is not allowed.
- `Services/UpdateService.cs` checks a remote update manifest.

## WebView2 Player

The app maps `https://app.mukundtube.local/` to local assets and loads
`Assets/player.html`. The page embeds the official YouTube iframe player.

Playback safety is split across:

- WPF-side allowed video IDs in `YouTubePlayerController`.
- WebView2 navigation blocking.
- Web messages from the player page back to WPF.
- Official YouTube iframe behavior and limitations.

Do not replace this with scraping or a custom video player.

## Remote Config

The expected config shape lives in `config/config.sample.json`.

The app supports:

- approved channels
- blocked video IDs
- pinned video IDs
- refresh interval
- maximum videos per channel

Channel IDs must be YouTube `UC...` IDs, not handles.

## Browser Preview

`preview` is a browser implementation for checking feed and config behavior on
machines that cannot run WPF. It should stay aligned with the config schema and
basic feed behavior, but it does not prove WebView2 lockdown, Windows packaging,
or parental-control integration.

## Tests

`tests/MukundTube.Tests` currently covers:

- feed policy behavior
- config validation behavior

Add tests here when modifying domain policy, config rules, update parsing, or
other logic that can be tested without a real WebView2 instance.
