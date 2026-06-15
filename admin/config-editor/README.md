# Parent YouTube Admin

This is the parent/admin React app for managing approved YouTube channels stored
in the Node API database. It no longer edits the GitHub raw JSON file directly
and it no longer stores a YouTube Data API key in the browser.

The app talks to the API configured by:

```text
VITE_API_BASE_URL=http://localhost:4000
```

Run the editor:

```powershell
cd admin\config-editor
npm install
copy .env.sample .env
npm run dev
```

Open:

```text
http://127.0.0.1:5173/admin
```

The editor can:

- sign in through the backend Google OAuth flow
- load and save approved channels through the Node API
- resolve public channel URLs, handles, legacy user URLs, channel IDs, or search text through the backend YouTube API integration
- preview resolved/search result channels before adding them
- open test links for approved channels
- add, remove, reorder, enable, and disable channels
- validate IDs using the same basic rules as the WPF app

Do not put YouTube API keys in this app. The YouTube API key belongs only in
`apps/api/.env`.
