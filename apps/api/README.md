# Youtube Beta API

Node.js + TypeScript API for the public/PWA direction of Youtube Beta.

## Local setup

```bash
cd apps/api
npm install
cp .env.sample .env
npm run prisma:migrate
npm run seed:config
npm run dev
```

Health check:

```text
http://localhost:4000/health
```

## Local checks

```bash
npm run typecheck
npm test
npm run build
```

## Parent admin endpoints

- `GET /admin/config`
- `PUT /admin/config`
- `GET /admin/children`
- `POST /admin/children`
- `PATCH /admin/children/:childId`
- `POST /admin/children/:childId/rotate-token`
- `GET /admin/youtube/channels/search?q=...`
- `GET /admin/youtube/channels/:channelId/videos`

Child profiles are paired to devices with generated access tokens. Listing
children returns only a token preview; the full token is returned when a child is
created or rotated so the parent can copy the install link.

## Child PWA endpoints

- `GET /kids/bootstrap`
- `GET /kids/channels/:channelId/videos?limit=50&cursor=0`
- `GET /kids/app-version?currentVersion=0.1.0`
- `GET /kids/config` for legacy config-compatible child access

Child data endpoints require `x-child-access-token`. The token maps the child
app/device to one family, so the API can return only that family's approved
channels and videos. Video pages are cache-first and fall back to stale cached
metadata if YouTube quota or network calls fail.

## Important rules

- Keep `YOUTUBE_API_KEY` server-side only.
- Google auth is parent-only.
- Child access uses parent-issued pairing tokens, not child Google sign-in.
- Kid-facing endpoints must not expose search or arbitrary browsing.
- Playback must remain through official YouTube embeds in the client.
