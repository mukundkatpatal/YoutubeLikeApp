import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/config/env.js";
import { buildServer } from "../src/server.js";

const validToken = "child_valid_token_123";
const now = new Date();
const staleDate = new Date("2026-01-01T00:00:00Z");

type ApprovedChannel = {
  channelId: string;
  title: string;
  enabled: boolean;
  sortOrder: number;
};

function createMockPrisma(options: { stale?: boolean } = {}) {
  const approvedChannels: ApprovedChannel[] = [
    {
      channelId: "UC1111111111111111111111",
      title: "Allowed channel",
      enabled: true,
      sortOrder: 0
    },
    {
      channelId: "UC2222222222222222222222",
      title: "Disabled channel",
      enabled: false,
      sortOrder: 1
    }
  ];
  const channelCaches = [
    {
      channelId: "UC1111111111111111111111",
      title: "Allowed channel cached",
      thumbnailUrl: "https://img.example/channel.jpg",
      uploadsPlaylist: "UU1111111111111111111111",
      fetchedAt: options.stale ? staleDate : now
    }
  ];
  const videoCaches = [
    {
      videoId: "newest00001",
      channelId: "UC1111111111111111111111",
      title: "Newest video",
      thumbnailUrl: "https://img.example/newest.jpg",
      publishedAt: new Date("2026-06-01T00:00:00Z"),
      fetchedAt: options.stale ? staleDate : now
    },
    {
      videoId: "pinned00001",
      channelId: "UC1111111111111111111111",
      title: "Pinned video",
      thumbnailUrl: "https://img.example/pinned.jpg",
      publishedAt: new Date("2026-05-01T00:00:00Z"),
      fetchedAt: options.stale ? staleDate : now
    },
    {
      videoId: "blocked0001",
      channelId: "UC1111111111111111111111",
      title: "Blocked video",
      thumbnailUrl: null,
      publishedAt: new Date("2026-04-01T00:00:00Z"),
      fetchedAt: options.stale ? staleDate : now
    },
    {
      videoId: "private0001",
      channelId: "UC1111111111111111111111",
      title: "Private video",
      thumbnailUrl: null,
      publishedAt: new Date("2026-03-01T00:00:00Z"),
      fetchedAt: options.stale ? staleDate : now
    }
  ];

  return {
    prisma: {
      parentUser: {
        findUnique: async () => null
      },
      childProfile: {
        findFirst: async ({ where, select }: { where: { accessToken?: string; enabled?: boolean }; select?: unknown }) => {
          if (where.accessToken !== validToken || where.enabled !== true) {
            return null;
          }

          if (select && "displayName" in (select as Record<string, unknown>)) {
            return {
              id: "child-1",
              displayName: "Test child",
              familyId: "family-1"
            };
          }

          return {
            familyId: "family-1"
          };
        }
      },
      family: {
        findUnique: async ({ where, include }: { where: { id: string }; include?: Record<string, unknown> }) => {
          if (where.id !== "family-1") {
            return null;
          }

          const channelInclude = include?.approvedChannels as
            | { where?: { enabled?: boolean; channelId?: string }; take?: number }
            | undefined;
          const filteredChannels = approvedChannels
            .filter((channel) => channelInclude?.where?.enabled === undefined || channel.enabled === channelInclude.where.enabled)
            .filter((channel) => channelInclude?.where?.channelId === undefined || channel.channelId === channelInclude.where.channelId)
            .slice(0, channelInclude?.take);

          return {
            id: "family-1",
            name: "Test family",
            updatedAt: new Date("2026-06-02T00:00:00Z"),
            refreshIntervalMinutes: 60,
            maxVideosPerChannel: 100,
            approvedChannels: filteredChannels,
            blockedVideos: [{ videoId: "blocked0001" }],
            pinnedVideos: [{ videoId: "pinned00001", sortOrder: 0, createdAt: new Date("2026-01-01T00:00:00Z") }]
          };
        }
      },
      youTubeChannelCache: {
        findMany: async ({ where }: { where: { channelId: { in: string[] } } }) =>
          channelCaches.filter((cache) => where.channelId.in.includes(cache.channelId)),
        findUnique: async ({ where }: { where: { channelId: string } }) =>
          channelCaches.find((cache) => cache.channelId === where.channelId) ?? null
      },
      youTubeVideoCache: {
        findMany: async ({ where, take }: { where: { channelId?: string | { in: string[] } }; take?: number }) => {
          const channelWhere = where.channelId;
          const videos = videoCaches
            .filter((video) => {
              if (typeof channelWhere === "string") {
                return video.channelId === channelWhere;
              }
              return channelWhere ? channelWhere.in.includes(video.channelId) : true;
            })
            .sort((left, right) => right.publishedAt.getTime() - left.publishedAt.getTime());
          return typeof take === "number" ? videos.slice(0, take) : videos;
        },
        findFirst: async ({ where }: { where: { channelId: string } }) =>
          videoCaches
            .filter((video) => video.channelId === where.channelId)
            .sort((left, right) => right.fetchedAt.getTime() - left.fetchedAt.getTime())[0] ?? null
      }
    }
  };
}

describe("kids routes", () => {
  it("requires a valid child token for bootstrap", async () => {
    const { prisma } = createMockPrisma();
    const app = await buildServer({ env: loadEnv({ NODE_ENV: "test" }), prisma: prisma as never });

    const missing = await app.inject({ method: "GET", url: "/kids/bootstrap" });
    expect(missing.statusCode).toBe(401);

    const invalid = await app.inject({
      method: "GET",
      url: "/kids/bootstrap",
      headers: { "x-child-access-token": "wrong_child_token_123" }
    });
    expect(invalid.statusCode).toBe(403);

    await app.close();
  });

  it("returns enabled channels and version policy in bootstrap", async () => {
    const { prisma } = createMockPrisma();
    const app = await buildServer({
      env: loadEnv({
        NODE_ENV: "test",
        KIDS_LATEST_VERSION: "0.2.0",
        KIDS_MINIMUM_SUPPORTED_VERSION: "0.1.0"
      }),
      prisma: prisma as never
    });

    const response = await app.inject({
      method: "GET",
      url: "/kids/bootstrap",
      headers: { "x-child-access-token": validToken }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      child: { id: "child-1", displayName: "Test child" },
      app: { latestVersion: "0.2.0", minimumSupportedVersion: "0.1.0" },
      channels: [
        {
          channelId: "UC1111111111111111111111",
          title: "Allowed channel cached",
          thumbnailUrl: "https://img.example/channel.jpg"
        }
      ]
    });
    expect(response.body).not.toContain("Disabled channel");
    await app.close();
  });

  it("returns approved channel videos from cache with blocked videos removed and pinned first", async () => {
    const { prisma } = createMockPrisma();
    let refreshCalls = 0;
    const youtube = {
      searchChannels: async () => [],
      listChannelVideos: async () => {
        refreshCalls += 1;
        return [];
      }
    };
    const app = await buildServer({ env: loadEnv({ NODE_ENV: "test" }), prisma: prisma as never, youtube });

    const response = await app.inject({
      method: "GET",
      url: "/kids/channels/UC1111111111111111111111/videos?limit=2",
      headers: { "x-child-access-token": validToken }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      items: [
        { videoId: "pinned00001", isPinned: true },
        { videoId: "newest00001", isPinned: false }
      ],
      nextCursor: null
    });
    expect(response.body).not.toContain("blocked0001");
    expect(response.body).not.toContain("private0001");
    expect(refreshCalls).toBe(0);
    await app.close();
  });

  it("rejects unapproved channels for child videos", async () => {
    const { prisma } = createMockPrisma();
    const app = await buildServer({ env: loadEnv({ NODE_ENV: "test" }), prisma: prisma as never });

    const response = await app.inject({
      method: "GET",
      url: "/kids/channels/UC2222222222222222222222/videos",
      headers: { "x-child-access-token": validToken }
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("tries to refresh stale cache but still returns cached videos when YouTube fails", async () => {
    const { prisma } = createMockPrisma({ stale: true });
    let refreshCalls = 0;
    const youtube = {
      searchChannels: async () => [],
      listChannelVideos: async () => {
        refreshCalls += 1;
        throw new Error("quota failed");
      }
    };
    const app = await buildServer({ env: loadEnv({ NODE_ENV: "test" }), prisma: prisma as never, youtube });

    const response = await app.inject({
      method: "GET",
      url: "/kids/channels/UC1111111111111111111111/videos",
      headers: { "x-child-access-token": validToken }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().items).toHaveLength(2);
    expect(refreshCalls).toBe(1);
    await app.close();
  });

  it("reports forced update requirement from version env vars", async () => {
    const { prisma } = createMockPrisma();
    const app = await buildServer({
      env: loadEnv({
        NODE_ENV: "test",
        KIDS_LATEST_VERSION: "0.3.0",
        KIDS_MINIMUM_SUPPORTED_VERSION: "0.2.0"
      }),
      prisma: prisma as never
    });

    const response = await app.inject({
      method: "GET",
      url: "/kids/app-version?currentVersion=0.1.9"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      latestVersion: "0.3.0",
      minimumSupportedVersion: "0.2.0",
      currentVersion: "0.1.9",
      updateRequired: true
    });
    await app.close();
  });
});
