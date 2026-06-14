import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppEnv } from "../config/env.js";

export const sessionCookieName = "youtube_beta_session";

export type SessionPayload = {
  parentUserId: string;
  email: string;
};

function encode(payload: SessionPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function decode(value: string, secret: string): SessionPayload | null {
  const [body, signature] = value.split(".");
  if (!body || !signature) {
    return null;
  }

  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
  } catch {
    return null;
  }
}

export function setSessionCookie(reply: FastifyReply, env: AppEnv, payload: SessionPayload): void {
  reply.setCookie(sessionCookieName, encode(payload, env.SESSION_SECRET), {
    httpOnly: true,
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(sessionCookieName, { path: "/" });
}

export function readSession(request: FastifyRequest, env: AppEnv): SessionPayload | null {
  const raw = request.cookies[sessionCookieName];
  return raw ? decode(raw, env.SESSION_SECRET) : null;
}
