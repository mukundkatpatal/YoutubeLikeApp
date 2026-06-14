import { describe, expect, it } from "vitest";
import { appConfigSchema } from "../src/config/schemas.js";

describe("appConfigSchema", () => {
  it("accepts the legacy config shape", () => {
    const parsed = appConfigSchema.parse({
      version: 1,
      updatedAt: "2026-05-25T00:00:00Z",
      refreshIntervalMinutes: 60,
      maxVideosPerChannel: 100,
      channels: [
        {
          channelId: "UC4rlAVgAK0SGk-yTfe48Qpw",
          title: "BrightSide",
          enabled: true
        }
      ],
      blockedVideoIds: ["wtDh0yR6hiA"],
      pinnedVideoIds: ["dQw4w9WgXcQ"]
    });

    expect(parsed.channels).toHaveLength(1);
  });

  it("rejects handles instead of canonical channel IDs", () => {
    const result = appConfigSchema.safeParse({
      version: 1,
      updatedAt: "2026-05-25T00:00:00Z",
      refreshIntervalMinutes: 60,
      maxVideosPerChannel: 100,
      channels: [
        {
          channelId: "@BRIGHTSIDEOFFICIAL",
          title: "BrightSide",
          enabled: true
        }
      ],
      blockedVideoIds: [],
      pinnedVideoIds: []
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid video IDs", () => {
    const result = appConfigSchema.safeParse({
      version: 1,
      updatedAt: "2026-05-25T00:00:00Z",
      refreshIntervalMinutes: 60,
      maxVideosPerChannel: 100,
      channels: [],
      blockedVideoIds: ["not-a-valid-video-id"],
      pinnedVideoIds: []
    });

    expect(result.success).toBe(false);
  });
});
