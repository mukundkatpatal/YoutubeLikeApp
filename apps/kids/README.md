# YouTube Beta Kids PWA

Child-facing React PWA for approved YouTube channels and videos. The child app
does not include search, Google sign-in, comments, subscriptions, uploads, or
local configuration.

## Local setup

```bash
cd apps/kids
npm install
cp .env.sample .env
npm run dev
```

Open a setup link from the parent admin app:

```text
http://localhost:5174/setup?token=child_...
```

The setup route stores the child pairing token locally, removes it from the URL,
loads `/kids/bootstrap`, and then shows approved channels.

## Environment

```text
VITE_API_BASE_URL=http://localhost:4000
VITE_APP_VERSION=0.1.0
```

Production Render values:

```text
VITE_API_BASE_URL=https://sane-videos-api.onrender.com
VITE_APP_VERSION=0.1.0
```

## Behavior

- Uses `x-child-access-token` for API calls.
- Shows cached channels/videos immediately when available.
- Refreshes backend data in the background.
- Shows skeleton loaders when there is no cache yet.
- Uses official YouTube iframe embeds only.
- Blocks the app when the API minimum supported PWA version is higher than the
  build version.

## Deploy

Create a Render Static Site:

```text
Name: sane-videos-kids
Root Directory: apps/kids
Build Command: npm install --include=dev && npm run build
Publish Directory: dist
```

Add rewrite:

```text
Source: /*
Destination: /index.html
Action: Rewrite
```

Sources: Vite PWA guide, MDN Service Workers, MDN IndexedDB, YouTube iframe API,
Render Static Sites.
