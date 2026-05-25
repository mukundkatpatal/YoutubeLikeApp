# Mac Preview

The production app is Windows WPF/WebView2 and cannot run on macOS. This preview is a local browser version for checking the config schema, feed filtering, virtual scrolling, and YouTube embed behavior on this Mac.

Run:

```bash
node preview/server.mjs
```

Open:

```text
http://localhost:4173/preview/
```

Without a YouTube Data API key, the preview shows sample videos. With a key, it reads the same remote config URL as the Windows app.

This preview does not prove Qustodio/WebView2 behavior. That must be tested on the target Windows computer.

