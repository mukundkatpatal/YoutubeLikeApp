# Youtube Beta Config Editor

This is a parent/admin React app for editing the remote `config.json` used by
Youtube Beta.

It starts from the downloaded config at:

```text
src/default-config.json
```

Refresh that file from GitHub:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\Download-Config.ps1
```

The same script also writes the root copy at `config/config.github.json`.

Run the editor:

```powershell
cd admin\config-editor
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5174
```

The editor can:

- edit general config settings
- paste a YouTube API key into browser local storage
- resolve public channel URLs, handles, legacy user URLs, channel IDs, or search text into `UC...` channel IDs
- preview resolved/search result channels before adding them
- open test links for configured channels
- add, remove, reorder, enable, and disable channels
- edit blocked and pinned video IDs
- validate IDs using the same basic rules as the WPF app
- import a JSON file
- copy JSON to the clipboard
- download a GitHub-ready `config.json`

To update GitHub, download or copy the JSON and paste it into:

```text
https://github.com/mukundkatpatal/son-youtube-config/edit/main/config.json
```

Do not put YouTube API keys in this config file.
