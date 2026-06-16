# API MVP

The `apps/api` project is the first backend for the public/PWA direction. It
does not replace the Windows app yet; it creates a portable Node/Postgres
foundation that can later serve the parent admin app and child PWA.

## Architecture

```text
React admin and child PWA clients
        |
        v
Fastify API -> Prisma -> Postgres
        |
        v
YouTube Data API metadata cache
```

The API owns Google parent auth, child profile pairing, config persistence,
YouTube metadata fetches, and legacy config JSON generation. The frontend
clients are `admin/config-editor` for parents and `apps/kids` for the child PWA.
YouTube playback remains a client concern and must use the official iframe
player.

## Database Model

- `ParentUser`: Google-authenticated parent account.
- `Family`: parent-controlled household configuration.
- `FamilyMember`: joins parents to families.
- `ChildProfile`: child access token for kid-facing config.
- `ApprovedChannel`: allowlisted YouTube channels.
- `BlockedVideo`: videos hidden and denied playback.
- `PinnedVideo`: videos shown first by clients.
- `YouTubeChannelCache` and `YouTubeVideoCache`: metadata cache to reduce quota
  pressure.

## Auth Model

Parents sign in with Google OAuth. The API verifies the Google ID token, checks
`PARENT_ALLOWLIST_EMAILS`, then sets a signed HTTP-only session cookie.

Child access is intentionally not Google sign-in for the MVP. Parents create
child profiles from the admin API. Each profile has a generated access token for
pairing a child device/app to the correct family. List responses expose only a
token preview; create and rotate responses return the full token for the parent
to copy into an install link.

## Deployment: Render + Neon

1. Create a Neon Postgres database and copy the connection string.
2. Create a Render Web Service from the GitHub repo.
3. Set the root directory to `apps/api`.
4. Use build command `npm install --include=dev && npm run build`.
5. Use start command `npm run start`.
6. Add environment variables from `apps/api/.env.sample`.
   Child PWA deployments also need `KIDS_WEB_APP_ORIGIN`,
   `KIDS_LATEST_VERSION`, and `KIDS_MINIMUM_SUPPORTED_VERSION`.
7. Run migrations from a trusted machine or Render shell with
   `npm run prisma:deploy`.
8. Seed the current config with `npm run seed:config`.

The implementation uses plain Node.js and Postgres, so moving to AWS later means
deploying the same API elsewhere and changing `DATABASE_URL`.

## API Surface

- `GET /health`
- `GET /auth/google`
- `GET /auth/google/callback`
- `POST /auth/logout`
- `GET /me`
- `GET /admin/children`
- `POST /admin/children`
- `PATCH /admin/children/:childId`
- `POST /admin/children/:childId/rotate-token`
- `GET /admin/config`
- `PUT /admin/config`
- `GET /admin/youtube/channels/search?q=...`
- `GET /admin/youtube/channels/:channelId/videos`
- `GET /kids/bootstrap`
- `GET /kids/channels/:channelId/videos?limit=50&cursor=0`
- `GET /kids/app-version?currentVersion=...`
- `GET /kids/config`
- `GET /legacy/config.json`

## Child Pairing Contract

Parent-only child profile endpoints require the same signed parent session as
the rest of the admin API. A child profile belongs to exactly one family, and
its access token is the pairing credential used by the future child PWA.

- `GET /admin/children` returns child IDs, names, enabled state, timestamps, and
  token previews.
- `POST /admin/children` creates an enabled child profile and returns the full
  token once.
- `PATCH /admin/children/:childId` renames or enables/disables a child profile.
- `POST /admin/children/:childId/rotate-token` invalidates the old token and
  returns the new token once.

## Child PWA API Contract

Child PWA data endpoints use the `x-child-access-token` header. Query-string
`accessToken` remains accepted for setup/legacy compatibility, but the installed
PWA should use the header after storing its token locally.

- `GET /kids/bootstrap` returns the child profile, family metadata, PWA version
  policy, config timestamps, and enabled approved channels with cached
  thumbnails/latest-video dates when available.
- `GET /kids/channels/:channelId/videos?limit=50&cursor=0` returns a cache-first
  page of videos for an approved enabled channel. The cursor is a decimal offset
  returned as `nextCursor`.
- `GET /kids/app-version?currentVersion=...` returns latest/minimum supported
  versions and whether the current PWA must force-update.

The API uses Postgres YouTube metadata cache first. If channel/video cache is
stale, it tries a backend YouTube refresh, but child endpoints still return
cached metadata when YouTube quota or network calls fail.

## Child PWA

`apps/kids` is the installable child-facing React PWA. It stores the
parent-issued pairing token locally after `/setup?token=...`, calls the child
API with `x-child-access-token`, and caches last-good bootstrap/video pages in
IndexedDB. It has no child search, sign-in, admin controls, or browser-local
YouTube API key.

Current viewer behavior includes approved channel grid, per-channel video grid,
load-more pagination, official YouTube iframe playback, skeleton loaders,
cached startup, and app-version blocking when the API minimum supported version
is higher than the PWA build version.

## Guardrails For Future AI/Agent Changes

- Do not expose the YouTube API key to frontend clients.
- Do not reintroduce browser-local YouTube API key storage in the admin app.
- Do not add child-facing Google sign-in, search, comments, subscriptions,
  uploads, or open browsing.
- Do not scrape, download, proxy, or modify YouTube playback.
- Keep the legacy JSON endpoint compatible until the Windows app is retired.
- Parent approval remains required before any AI-suggested content reaches a
  child.

Sources: Render Web Services, Render Deploys, Neon Render guide, Google OAuth
2.0 Web Server Apps, YouTube Data API, Prisma PostgreSQL docs.
