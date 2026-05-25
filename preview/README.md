# Mac Preview

The production app is Windows WPF/WebView2 and cannot run on macOS. This preview is a local browser version for checking the config schema, feed filtering, virtual scrolling, and YouTube embed behavior on this Mac.

Create local preview settings:

```bash
cp preview/settings.local.sample.json preview/settings.local.json
```

Edit `preview/settings.local.json` and paste your YouTube Data API key there. This file is ignored by Git.

Run:

```bash
node preview/server.mjs
```

Open:

```text
http://localhost:4173/preview/
```

Without a YouTube Data API key in `preview/settings.local.json`, the preview shows sample channels. With a key, it reads the same remote config URL as the Windows app.

This preview does not prove Qustodio/WebView2 behavior. That must be tested on the target Windows computer.
