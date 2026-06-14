import { OAuth2Client } from "google-auth-library";
import type { AppEnv } from "../config/env.js";

export type GoogleProfile = {
  googleSubject: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
};

export function getGoogleRedirectUri(env: AppEnv): string {
  return `${env.PUBLIC_BASE_URL}/auth/google/callback`;
}

export function buildGoogleAuthUrl(env: AppEnv, state: string): string {
  const client = new OAuth2Client(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    getGoogleRedirectUri(env)
  );

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "select_account",
    scope: ["openid", "email", "profile"],
    state
  });
}

export async function exchangeGoogleCode(env: AppEnv, code: string): Promise<GoogleProfile> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth is not configured.");
  }

  const client = new OAuth2Client(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    getGoogleRedirectUri(env)
  );
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) {
    throw new Error("Google did not return an ID token.");
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: env.GOOGLE_CLIENT_ID
  });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new Error("Google profile is missing required identity fields.");
  }

  return {
    googleSubject: payload.sub,
    email: payload.email.toLowerCase(),
    displayName: payload.name,
    avatarUrl: payload.picture
  };
}

export function isParentAllowed(env: AppEnv, email: string): boolean {
  return env.parentAllowlistEmails.size === 0 || env.parentAllowlistEmails.has(email.toLowerCase());
}
