# Publishing

Use this flow when you want to run the published Youtube Beta app instead of a
development build.

The local publish target is:

```text
%LocalAppData%\Youtube Beta\App\
```

The published executable is:

```text
%LocalAppData%\Youtube Beta\App\Youtube Beta.exe
```

The desktop shortcut is:

```text
Desktop\Youtube Beta.lnk
```

The tray notifier is published separately to:

```text
%LocalAppData%\Youtube Beta\Notifier\
```

## Publish And Create Shortcut

Run from the repository root:

```powershell
.\src\YoutubeBeta\Tools\Publish-YoutubeBeta.ps1
```

If Windows blocks local scripts with an execution-policy message, run the same
script without changing machine-wide policy:

```powershell
powershell -ExecutionPolicy Bypass -File .\src\YoutubeBeta\Tools\Publish-YoutubeBeta.ps1
```

If Youtube Beta is already running, close it first. To let the script stop the
running app before publishing:

```powershell
.\src\YoutubeBeta\Tools\Publish-YoutubeBeta.ps1 -StopRunning
```

Execution-policy-safe form:

```powershell
powershell -ExecutionPolicy Bypass -File .\src\YoutubeBeta\Tools\Publish-YoutubeBeta.ps1 -StopRunning
```

To publish, update the desktop shortcut, and launch the published app:

```powershell
.\src\YoutubeBeta\Tools\Publish-YoutubeBeta.ps1 -StopRunning -Launch
```

## Register The Tray Notifier

The notifier is a separate process that owns the system tray icon and Windows
toast notifications. It watches:

```text
%LocalAppData%\Youtube Beta\update-state.json
```

Publish it, register the per-user logon Scheduled Task, and start it:

```powershell
.\src\YoutubeBeta\Tools\Register-YoutubeBetaNotifier.ps1 -StopRunning
```

The script also checks for the Windows App Runtime 2 packages required by
`Microsoft.WindowsAppSDK` 2.1.3 and installs them from the restored NuGet cache
when they are missing. To skip that check:

```powershell
.\src\YoutubeBeta\Tools\Register-YoutubeBetaNotifier.ps1 -StopRunning -SkipRuntimeInstall
```

Execution-policy-safe form:

```powershell
powershell -ExecutionPolicy Bypass -File .\src\YoutubeBeta\Tools\Register-YoutubeBetaNotifier.ps1 -StopRunning
```

To publish/register without launching it immediately:

```powershell
.\src\YoutubeBeta\Tools\Register-YoutubeBetaNotifier.ps1 -StopRunning -NoLaunch
```

For a local notification test, start the notifier and then write a fresh update
event:

```powershell
$appData = Join-Path $env:LOCALAPPDATA 'Youtube Beta'
$appExe = Join-Path $appData 'App\Youtube Beta.exe'
$state = @{
  schemaVersion = 1
  eventId = "manual-test-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
  status = 'Published'
  version = 'manual-test'
  publishedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
  message = 'Youtube Beta manual test update is ready.'
  appExePath = $appExe
}
$state | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $appData 'update-state.json') -Encoding UTF8
```

## Settings

The published app reads production settings from:

```text
%LocalAppData%\Youtube Beta\settings.json
```

See `docs/SETTINGS.md` for the exact JSON template and troubleshooting steps.

## Notes

- The script uses `src/YoutubeBeta/Properties/PublishProfiles/FolderProfile.pubxml`.
- The publish profile creates a Release, self-contained, win-x64 build.
- The shortcut always points to the published executable, not `bin` or `obj`.
- Re-run the script after code changes when you want the desktop shortcut to
  launch the latest published version.
- `Update-YoutubeBeta.ps1` writes `update-state.json` only after a successful
  publish and published executable check. The notifier reads that file and
  suppresses duplicate notifications for the same `eventId`.
