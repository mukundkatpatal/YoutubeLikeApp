import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/config/env.js";
import { sessionCookieName } from "../src/auth/session.js";
import { buildServer } from "../src/server.js";

type Profile = {
  id: string;
  familyId: string;
  displayName: string;
  accessToken: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function signSession(secret: string): string {
  const body = Buffer.from(JSON.stringify({
    parentUserId: "parent-1",
    email: "parent@example.com"
  }), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function createMockPrisma() {
  let nextId = 1;
  const profiles: Profile[] = [
    {
      id: "child-existing",
      familyId: "family-1",
      displayName: "Existing child",
      accessToken: "child_existing_token_value",
      enabled: true,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z")
    }
  ];

  return {
    profiles,
    prisma: {
      parentUser: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          where.id === "parent-1" ? { id: "parent-1", email: "parent@example.com" } : null
      },
      family: {
        findUnique: async () => ({ id: "family-1" })
      },
      familyMember: {
        upsert: async () => ({ id: "member-1" })
      },
      childProfile: {
        findMany: async ({ where }: { where: { familyId: string } }) =>
          profiles.filter((profile) => profile.familyId === where.familyId),
        findFirst: async ({ where, select }: { where: { id: string; familyId: string }; select?: { id: true } }) => {
          const profile = profiles.find((item) => item.id === where.id && item.familyId === where.familyId);
          return profile && select?.id ? { id: profile.id } : profile ?? null;
        },
        create: async ({ data }: { data: { familyId: string; displayName: string; accessToken: string } }) => {
          const now = new Date("2026-01-02T00:00:00Z");
          const profile = {
            id: `child-${nextId++}`,
            familyId: data.familyId,
            displayName: data.displayName,
            accessToken: data.accessToken,
            enabled: true,
            createdAt: now,
            updatedAt: now
          };
          profiles.push(profile);
          return profile;
        },
        update: async ({ where, data }: { where: { id: string }; data: Partial<Profile> }) => {
          const profile = profiles.find((item) => item.id === where.id);
          if (!profile) {
            throw new Error("Profile not found.");
          }

          Object.assign(profile, data, { updatedAt: new Date("2026-01-03T00:00:00Z") });
          return profile;
        }
      }
    }
  };
}

describe("admin child profile routes", () => {
  it("requires a parent session", async () => {
    const env = loadEnv({ NODE_ENV: "test" });
    const { prisma } = createMockPrisma();
    const app = await buildServer({ env, prisma: prisma as never });

    const response = await app.inject({ method: "GET", url: "/admin/children" });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("lists child profiles without returning raw access tokens", async () => {
    const secret = "test-secret";
    const env = loadEnv({ NODE_ENV: "test", SESSION_SECRET: secret });
    const { prisma } = createMockPrisma();
    const app = await buildServer({ env, prisma: prisma as never });

    const response = await app.inject({
      method: "GET",
      url: "/admin/children",
      cookies: { [sessionCookieName]: signSession(secret) }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      items: [
        {
          id: "child-existing",
          displayName: "Existing child",
          enabled: true,
          tokenPreview: "child_ex...alue"
        }
      ]
    });
    expect(response.body).not.toContain("child_existing_token_value");
    await app.close();
  });

  it("creates, updates, and rotates child profiles for the parent family", async () => {
    const secret = "test-secret";
    const env = loadEnv({ NODE_ENV: "test", SESSION_SECRET: secret });
    const { prisma } = createMockPrisma();
    const app = await buildServer({ env, prisma: prisma as never });
    const cookies = { [sessionCookieName]: signSession(secret) };

    const createResponse = await app.inject({
      method: "POST",
      url: "/admin/children",
      cookies,
      payload: { displayName: "New child" }
    });
    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json()).toMatchObject({
      id: "child-1",
      displayName: "New child",
      enabled: true
    });
    expect(createResponse.json().accessToken).toMatch(/^child_[a-zA-Z0-9_-]{40,}$/);

    const updateResponse = await app.inject({
      method: "PATCH",
      url: "/admin/children/child-1",
      cookies,
      payload: { displayName: "Renamed child", enabled: false }
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toMatchObject({
      id: "child-1",
      displayName: "Renamed child",
      enabled: false
    });
    expect(updateResponse.body).not.toContain(createResponse.json().accessToken);

    const rotateResponse = await app.inject({
      method: "POST",
      url: "/admin/children/child-1/rotate-token",
      cookies
    });
    expect(rotateResponse.statusCode).toBe(200);
    expect(rotateResponse.json().accessToken).toMatch(/^child_[a-zA-Z0-9_-]{40,}$/);
    expect(rotateResponse.json().accessToken).not.toBe(createResponse.json().accessToken);

    await app.close();
  });

  it("does not update a child outside the parent family", async () => {
    const secret = "test-secret";
    const env = loadEnv({ NODE_ENV: "test", SESSION_SECRET: secret });
    const { prisma } = createMockPrisma();
    const app = await buildServer({ env, prisma: prisma as never });

    const response = await app.inject({
      method: "PATCH",
      url: "/admin/children/not-found",
      cookies: { [sessionCookieName]: signSession(secret) },
      payload: { enabled: false }
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
