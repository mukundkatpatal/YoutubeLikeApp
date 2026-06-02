# Youtube Beta Setup

## What This App Does

Youtube Beta is a curated YouTube viewer. It shows only videos allowed by a remote JSON config and plays them through the official YouTube embedded player.

It is not a full parental-control system. Qustodio, Windows Family Safety, a child Windows account, and blocking alternate browsers still matter. If `youtube.com` is blocked only inside Chrome and Edge, WebView2 may still work, but test it on the actual Windows machine before trusting that assumption.

## Create The Remote Config Repo

1. Create a public GitHub repo named `son-youtube-config` under `mukundkatpatal`.
2. Copy `config/config.sample.json` to that repo as `config.json`.
3. Replace the sample channel IDs with real YouTube channel IDs.
4. Commit to the `main` branch.
5. Confirm the raw URL opens:

   `https://raw.githubusercontent.com/mukundkatpatal/son-youtube-config/main/config.json`

Use YouTube channel IDs that start with `UC...`, not handles like `@channelname`.

## Add A YouTube Data API Key

Create a YouTube Data API v3 key in Google Cloud and restrict it as tightly as Google allows for your deployment. Then put it in either:

- `%LocalAppData%\Youtube Beta\settings.json`
- `settings.local.json` beside `Youtube Beta.exe`
- Environment variable `YOUTUBE_BETA_YOUTUBE_API_KEY`

For step-by-step Windows commands and troubleshooting, see `docs/SETTINGS.md`.

Example:

```json
{
  "youTubeApiKey": "PASTE_RESTRICTED_YOUTUBE_DATA_API_KEY_HERE",
  "configUrl": "https://raw.githubusercontent.com/mukundkatpatal/son-youtube-config/main/config.json",
  "updateManifestUrl": "https://raw.githubusercontent.com/mukundkatpatal/son-youtube-config/main/update-manifest.json",
  "appReferrer": "https://youtubebeta.local/"
}
```

## App Version Updates

Channel/video rules update through `config.json`; they do not require reinstalling the app.

Source-code updates use `update-manifest.json` in the same config repo:

```json
{
  "version": "0.1.0",
  "required": false,
  "downloadUrl": "https://github.com/mukundkatpatal/YoutubeLikeApp/releases/latest",
  "notes": "Initial development version.",
  "publishedAt": "2026-05-26T00:00:00Z"
}
```

The WPF app reads its installed version from `src/YoutubeBeta/YoutubeBeta.csproj`. On startup it checks the manifest. While open, it also checks every six hours. If the manifest version is newer than the installed version, the app blocks browsing and opens the update URL when `Download and install` is clicked.

For the first Windows packaging pass, use MSIX with App Installer and point `downloadUrl` at the published `.appinstaller` file or a GitHub release that contains it. The app cannot overwrite itself while running; the practical flow is prompt, open installer, close app, install update, relaunch.

## Build On Windows

Install:

- Visual Studio 2022 or newer
- .NET desktop development workload
- .NET 10 SDK
- Microsoft Edge WebView2 Runtime

Build:

```powershell
dotnet restore .\YoutubeBeta.sln
dotnet build .\YoutubeBeta.sln -c Release
dotnet test .\YoutubeBeta.sln -c Release
```

Publish a local build:

```powershell
dotnet publish .\src\YoutubeBeta\YoutubeBeta.csproj -c Release -r win-x64 --self-contained true
```

Or publish to `%LocalAppData%\Youtube Beta\App\` and create/update the desktop
shortcut:

```powershell
.\src\YoutubeBeta\Tools\Publish-YoutubeBeta.ps1
```

See `docs/PUBLISHING.md` for the full local publishing flow.

The output can be wrapped with MSIX or a simple local installer on the Windows machine. This repo includes the app source and publish path; MSIX signing should be completed on Windows because certificates and packaging identity are machine/account specific.

## Test On This Mac

The WPF/WebView2 app itself is Windows-only. For this Mac, use the browser preview:

```bash
node preview/server.mjs
```

Then open:

```text
http://localhost:4173/preview/
```

The preview uses the same config shape and feed filtering. Without a YouTube Data API key it shows local sample videos. With a key it reads the remote config and YouTube Data API. Playback in the preview uses a direct official YouTube embed; the Windows app adds the WebView2 playback guard.

For real data in the Mac preview, create `preview/settings.local.json` from `preview/settings.local.sample.json` and paste the API key there. That local settings file is ignored by Git. The production Windows app reads the API key from `settings.local.json`, `%LocalAppData%\Youtube Beta\settings.json`, or the `YOUTUBE_BETA_YOUTUBE_API_KEY` environment variable.

`maxVideosPerChannel` controls how many approved uploads are fetched per channel. YouTube returns at most 50 playlist items per request, so the app paginates up to the configured limit. Keep this number reasonable, such as 50-100 for normal use. For channels with many Shorts, values up to 500 are supported, but they use more API quota and take longer to refresh.

## Compliance Notes

- The app uses YouTube Data API for metadata and the official IFrame player for playback.
- It does not scrape, download, strip ads, hide YouTube branding, or cover player controls.
- The player guard stops playback if the embedded player switches to a video ID not present in the approved feed.
- YouTube related videos cannot be completely disabled. `rel=0` limits related videos to the same channel, so approving a channel is still a trust decision.

## Sources

- YouTube IFrame Player API: https://developers.google.com/youtube/iframe_api_reference
- YouTube player parameters: https://developers.google.com/youtube/player_parameters
- YouTube Data API playlistItems: https://developers.google.com/youtube/v3/docs/playlistItems/list
- YouTube API Developer Policies: https://developers.google.com/youtube/terms/developer-policies
- YouTube Required Minimum Functionality: https://developers.google.com/youtube/terms/required-minimum-functionality
- Microsoft WebView2 WPF docs: https://learn.microsoft.com/en-us/microsoft-edge/webview2/get-started/wpf
- Microsoft .NET support policy: https://dotnet.microsoft.com/en-us/platform/support/policy
