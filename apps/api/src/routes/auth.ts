import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  isParentAllowed
} from "../auth/google.js";
import { clearSessionCookie, setSessionCookie } from "../auth/session.js";

const googleStateCookie = "youtube_beta_google_state";

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/auth/google", async (_request, reply) => {
    if (!app.api.env.GOOGLE_CLIENT_ID || !app.api.env.GOOGLE_CLIENT_SECRET) {
      return reply.code(503).send({ error: "Google OAuth is not configured." });
    }

    const state = randomBytes(24).toString("base64url");
    reply.setCookie(googleStateCookie, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: app.api.env.NODE_ENV === "production",
      path: "/auth/google/callback",
      maxAge: 60 * 10
    });
    return reply.redirect(buildGoogleAuthUrl(app.api.env, state));
  });

  app.get<{ Querystring: { code?: string; state?: string } }>(
    "/auth/google/callback",
    async (request, reply) => {
      const expectedState = request.cookies[googleStateCookie];
      reply.clearCookie(googleStateCookie, { path: "/auth/google/callback" });
      if (!request.query.code || !request.query.state || request.query.state !== expectedState) {
        return reply.code(400).send({ error: "Invalid Google OAuth callback." });
      }

      const profile = await exchangeGoogleCode(app.api.env, request.query.code);
      if (!isParentAllowed(app.api.env, profile.email)) {
        return reply.code(403).send({ error: "This Google account is not allowed for this MVP." });
      }

      const parent = await app.api.prisma.parentUser.upsert({
        where: { googleSubject: profile.googleSubject },
        create: {
          googleSubject: profile.googleSubject,
          email: profile.email,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl
        },
        update: {
          email: profile.email,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl
        }
      });

      setSessionCookie(reply, app.api.env, { parentUserId: parent.id, email: parent.email });
      return reply.redirect(`${app.api.env.WEB_APP_ORIGIN}/admin`);
    }
  );

  app.post("/auth/logout", async (_request, reply) => {
    clearSessionCookie(reply);
    return { ok: true };
  });
}
