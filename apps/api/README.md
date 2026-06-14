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

## Important rules

- Keep `YOUTUBE_API_KEY` server-side only.
- Google auth is parent-only.
- Kid-facing endpoints must not expose search or arbitrary browsing.
- Playback must remain through official YouTube embeds in the client.
