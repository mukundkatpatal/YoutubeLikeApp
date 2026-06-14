# API MVP

The `apps/api` project is the first backend for the public/PWA direction. It
does not replace the Windows app yet; it creates a portable Node/Postgres
foundation that can later serve the parent admin app and child PWA.

## Architecture

```text
React admin/PWA clients
        |
        v
Fastify API -> Prisma -> Postgres
        |
        v
YouTube Data API metadata cache
```

The API owns Google parent auth, config persistence, YouTube metadata fetches,
and legacy config JSON generation. YouTube playback remains a client concern and
must use the official iframe player.

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

Child access is intentionally not Google sign-in for the MVP. `GET /kids/config`
requires a child access token, which avoids putting a parent login on the child
device.

## Deployment: Render + Neon

1. Create a Neon Postgres database and copy the connection string.
2. Create a Render Web Service from the GitHub repo.
3. Set the root directory to `apps/api`.
4. Use build command `npm install && npm run build`.
5. Use start command `npm run start`.
6. Add environment variables from `apps/api/.env.sample`.
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
- `GET /admin/config`
- `PUT /admin/config`
- `GET /admin/youtube/channels/search?q=...`
- `GET /admin/youtube/channels/:channelId/videos`
- `GET /kids/config`
- `GET /legacy/config.json`

## Guardrails For Future AI/Agent Changes

- Do not expose the YouTube API key to frontend clients.
- Do not add child-facing search, comments, subscriptions, uploads, sign-in, or
  open browsing.
- Do not scrape, download, proxy, or modify YouTube playback.
- Keep the legacy JSON endpoint compatible until the Windows app is retired.
- Parent approval remains required before any AI-suggested content reaches a
  child.

Sources: Render Web Services, Render Deploys, Neon Render guide, Google OAuth
2.0 Web Server Apps, YouTube Data API, Prisma PostgreSQL docs.
