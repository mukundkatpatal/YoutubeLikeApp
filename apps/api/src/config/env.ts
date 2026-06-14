import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:4000"),
  WEB_APP_ORIGIN: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().optional(),
  YOUTUBE_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  SESSION_SECRET: z.string().default("dev-only-session-secret-change-before-production"),
  PARENT_ALLOWLIST_EMAILS: z.string().default("")
});

export type AppEnv = z.infer<typeof envSchema> & {
  parentAllowlistEmails: Set<string>;
};

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.parse(source);

  if (parsed.NODE_ENV === "production" && parsed.SESSION_SECRET.includes("dev-only")) {
    throw new Error("SESSION_SECRET must be set to a production-safe value.");
  }

  return {
    ...parsed,
    parentAllowlistEmails: new Set(
      parsed.PARENT_ALLOWLIST_EMAILS.split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    )
  };
}
