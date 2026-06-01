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

## Publish And Create Shortcut

Run from the repository root:

```powershell
.\src\MukundTube\Tools\Publish-YoutubeBeta.ps1
```

If Windows blocks local scripts with an execution-policy message, run the same
script without changing machine-wide policy:

```powershell
powershell -ExecutionPolicy Bypass -File .\src\MukundTube\Tools\Publish-YoutubeBeta.ps1
```

If Youtube Beta is already running, close it first. To let the script stop the
running app before publishing:

```powershell
.\src\MukundTube\Tools\Publish-YoutubeBeta.ps1 -StopRunning
```

Execution-policy-safe form:

```powershell
powershell -ExecutionPolicy Bypass -File .\src\MukundTube\Tools\Publish-YoutubeBeta.ps1 -StopRunning
```

To publish, update the desktop shortcut, and launch the published app:

```powershell
.\src\MukundTube\Tools\Publish-YoutubeBeta.ps1 -StopRunning -Launch
```

## Settings

The published app reads production settings from:

```text
%LocalAppData%\Youtube Beta\settings.json
```

See `docs/SETTINGS.md` for the exact JSON template and troubleshooting steps.

## Notes

- The script uses `src/MukundTube/Properties/PublishProfiles/FolderProfile.pubxml`.
- The publish profile creates a Release, self-contained, win-x64 build.
- The shortcut always points to the published executable, not `bin` or `obj`.
- Re-run the script after code changes when you want the desktop shortcut to
  launch the latest published version.
