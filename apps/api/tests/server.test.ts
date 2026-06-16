import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/config/env.js";
import { buildServer } from "../src/server.js";

describe("server", () => {
  it("boots with optional integrations missing and serves health", async () => {
    const prisma = {
      parentUser: {
        findUnique: async () => null
      }
    };
    const youtube = {
      searchChannels: async () => [],
      refreshChannelMetadata: async () => undefined,
      listChannelVideos: async () => []
    };
    const app = await buildServer({
      env: loadEnv({ NODE_ENV: "test" }),
      prisma: prisma as never,
      youtube
    });

    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, service: "youtube-beta-api" });

    await app.close();
  });
});
