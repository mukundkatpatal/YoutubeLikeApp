import type { PrismaClient } from "@prisma/client";
import type { AppEnv } from "../config/env.js";
import type { YouTubeService } from "./youtubeService.js";

const channelCacheTtlMs = 1000 * 60 * 60 * 12;
const videoCacheTtlMs = 1000 * 60 * 60 * 6;

export type ChildBootstrap = {
  child: {
    id: string;
    displayName: string;
  };
  family: {
    id: string;
    name: string;
    updatedAt: string;
  };
  app: {
    latestVersion: string;
    minimumSupportedVersion: string;
  };
  config: {
    updatedAt: string;
    refreshIntervalMinutes: number;
    maxVideosPerChannel: number;
  };
  channels: ChildChannelSummary[];
};

export type ChildChannelSummary = {
  channelId: string;
  title: string;
  thumbnailUrl?: string;
  latestPublishedAt?: string;
};

export type ChildVideoPage = {
  items: ChildVideoItem[];
  nextCursor: string | null;
  refreshedAt: string | null;
};

export type ChildVideoItem = {
  videoId: string;
  channelId: string;
  title: string;
  thumbnailUrl?: string;
  publishedAt: string;
  isPinned: boolean;
};

export async function buildChildBootstrap(
  prisma: PrismaClient,
  env: AppEnv,
  youtube: YouTubeService,
  child: { childId: string; displayName: string; familyId: string }
): Promise<ChildBootstrap> {
  const family = await prisma.family.findUnique({
    where: { id: child.familyId },
    include: {
      approvedChannels: {
        where: { enabled: true },
        orderBy: [{ sortOrder: "asc" }, { title: "asc" }]
      }
    }
  });
  if (!family) {
    throw new Error("Family was not found.");
  }

  const channelIds = family.approvedChannels.map((channel) => channel.channelId);
  await refreshChannelMetadataIfStale(prisma, youtube, channelIds);
  const [channelCaches, videoCaches] = await Promise.all([
    prisma.youTubeChannelCache.findMany({
      where: { channelId: { in: channelIds } }
    }),
    prisma.youTubeVideoCache.findMany({
      where: { channelId: { in: channelIds } },
      orderBy: { publishedAt: "desc" }
    })
  ]);

  const channelCacheById = new Map(channelCaches.map((cache) => [cache.channelId, cache]));
  const latestVideoByChannelId = new Map<string, { publishedAt: Date; thumbnailUrl: string | null }>();
  for (const video of videoCaches) {
    if (!latestVideoByChannelId.has(video.channelId)) {
      latestVideoByChannelId.set(video.channelId, {
        publishedAt: video.publishedAt,
        thumbnailUrl: video.thumbnailUrl
      });
    }
  }

  return {
    child: {
      id: child.childId,
      displayName: child.displayName
    },
    family: {
      id: family.id,
      name: family.name,
      updatedAt: family.updatedAt.toISOString()
    },
    app: {
      latestVersion: env.KIDS_LATEST_VERSION,
      minimumSupportedVersion: env.KIDS_MINIMUM_SUPPORTED_VERSION
    },
    config: {
      updatedAt: family.updatedAt.toISOString(),
      refreshIntervalMinutes: family.refreshIntervalMinutes,
      maxVideosPerChannel: family.maxVideosPerChannel
    },
    channels: family.approvedChannels
      .map((channel) => {
        const cache = channelCacheById.get(channel.channelId);
        const latestVideo = latestVideoByChannelId.get(channel.channelId);
        return removeUndefined({
          channelId: channel.channelId,
          title: cache?.title ?? channel.title,
          thumbnailUrl: cache?.thumbnailUrl ?? latestVideo?.thumbnailUrl ?? undefined,
          latestPublishedAt: latestVideo?.publishedAt.toISOString()
        });
      })
      .sort((left, right) =>
        new Date(right.latestPublishedAt ?? 0).getTime() - new Date(left.latestPublishedAt ?? 0).getTime()
      )
  };
}

async function refreshChannelMetadataIfStale(
  prisma: PrismaClient,
  youtube: YouTubeService,
  channelIds: string[]
): Promise<void> {
  if (channelIds.length === 0) {
    return;
  }

  const caches = await prisma.youTubeChannelCache.findMany({
    where: { channelId: { in: channelIds } }
  });
  const cacheById = new Map(caches.map((cache) => [cache.channelId, cache]));
  const staleOrMissing = channelIds.filter((channelId) => {
    const cache = cacheById.get(channelId);
    return !cache || Date.now() - cache.fetchedAt.getTime() >= channelCacheTtlMs;
  });
  if (staleOrMissing.length === 0) {
    return;
  }

  try {
    await youtube.refreshChannelMetadata(staleOrMissing);
  } catch {
    // Bootstrap stays cache-first. Missing thumbnails are better than blocking the child app.
  }
}

export async function buildChildVideoPage(
  prisma: PrismaClient,
  youtube: YouTubeService,
  child: { familyId: string },
  channelId: string,
  input: { limit: number; cursor: number }
): Promise<ChildVideoPage | null> {
  const family = await prisma.family.findUnique({
    where: { id: child.familyId },
    include: {
      approvedChannels: {
        where: { channelId, enabled: true },
        take: 1
      },
      blockedVideos: true,
      pinnedVideos: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }
    }
  });
  if (!family || family.approvedChannels.length === 0) {
    return null;
  }

  await refreshChannelIfStale(prisma, youtube, channelId, family.maxVideosPerChannel);
  const videos = await prisma.youTubeVideoCache.findMany({
    where: { channelId },
    orderBy: { publishedAt: "desc" },
    take: Math.min(family.maxVideosPerChannel, input.cursor + input.limit)
  });

  const blockedVideoIds = new Set(family.blockedVideos.map((video) => video.videoId));
  const pinnedOrder = new Map(family.pinnedVideos.map((video, index) => [video.videoId, index]));
  const filtered = videos
    .filter((video) => !blockedVideoIds.has(video.videoId))
    .filter((video) => !isPlaceholderTitle(video.title))
    .map((video) => ({
      videoId: video.videoId,
      channelId: video.channelId,
      title: video.title,
      thumbnailUrl: video.thumbnailUrl ?? undefined,
      publishedAt: video.publishedAt.toISOString(),
      isPinned: pinnedOrder.has(video.videoId)
    }))
    .sort((left, right) => {
      if (left.isPinned !== right.isPinned) {
        return left.isPinned ? -1 : 1;
      }
      if (left.isPinned && right.isPinned) {
        return (pinnedOrder.get(left.videoId) ?? Number.MAX_SAFE_INTEGER)
          - (pinnedOrder.get(right.videoId) ?? Number.MAX_SAFE_INTEGER);
      }
      return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime();
    });

  const start = input.cursor;
  const end = start + input.limit;
  const page = filtered.slice(start, end);
  const refreshedAt = videos.reduce<Date | null>(
    (latest, video) => latest && latest > video.fetchedAt ? latest : video.fetchedAt,
    null
  );

  return {
    items: page.map(removeUndefined),
    nextCursor: end < filtered.length ? String(end) : null,
    refreshedAt: refreshedAt?.toISOString() ?? null
  };
}

async function refreshChannelIfStale(
  prisma: PrismaClient,
  youtube: YouTubeService,
  channelId: string,
  maxVideosPerChannel: number
): Promise<void> {
  const [channelCache, newestVideo] = await Promise.all([
    prisma.youTubeChannelCache.findUnique({ where: { channelId } }),
    prisma.youTubeVideoCache.findFirst({
      where: { channelId },
      orderBy: { fetchedAt: "desc" }
    })
  ]);

  const channelIsFresh = channelCache
    && Date.now() - channelCache.fetchedAt.getTime() < channelCacheTtlMs;
  const videosAreFresh = newestVideo
    && Date.now() - newestVideo.fetchedAt.getTime() < videoCacheTtlMs;
  if (channelIsFresh && videosAreFresh) {
    return;
  }

  try {
    await youtube.listChannelVideos(channelId, maxVideosPerChannel);
  } catch {
    // Child endpoints are cache-first: stale data is better than a blank app.
  }
}

function isPlaceholderTitle(title: string): boolean {
  return title === "Private video" || title === "Deleted video";
}

function removeUndefined<T extends Record<string, unknown>>(value: T): T {
  for (const key of Object.keys(value)) {
    if (value[key] === undefined) {
      delete value[key];
    }
  }
  return value;
}
