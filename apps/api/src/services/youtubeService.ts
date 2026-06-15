import type { PrismaClient } from "@prisma/client";
import type { AppEnv } from "../config/env.js";

export type YouTubeChannelSearchResult = {
  channelId: string;
  title: string;
  thumbnailUrl?: string;
};

export type YouTubeVideoResult = {
  videoId: string;
  channelId: string;
  title: string;
  thumbnailUrl?: string;
  publishedAt: string;
};

export type YouTubeService = {
  searchChannels(query: string): Promise<YouTubeChannelSearchResult[]>;
  listChannelVideos(channelId: string, maxResults?: number): Promise<YouTubeVideoResult[]>;
};

type YouTubeSearchResponse = {
  items?: Array<{
    snippet?: {
      channelId?: string;
      channelTitle?: string;
      title?: string;
      thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
    };
  }>;
};

type YouTubeChannelsResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
    };
    contentDetails?: {
      relatedPlaylists?: {
        uploads?: string;
      };
    };
  }>;
};

type YouTubePlaylistItemsResponse = {
  nextPageToken?: string;
  items?: Array<{
    contentDetails?: {
      videoId?: string;
      videoPublishedAt?: string;
    };
    snippet?: {
      resourceId?: { videoId?: string };
      channelId?: string;
      title?: string;
      publishedAt?: string;
      thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
    };
  }>;
};

export class GoogleYouTubeService implements YouTubeService {
  constructor(
    private readonly env: AppEnv,
    private readonly prisma: PrismaClient
  ) {}

  async searchChannels(query: string): Promise<YouTubeChannelSearchResult[]> {
    const data = await this.fetchJson<YouTubeSearchResponse>("/search", {
      part: "snippet",
      type: "channel",
      maxResults: "10",
      q: query
    });

    const results: YouTubeChannelSearchResult[] = [];
    for (const item of data.items ?? []) {
      const snippet = item.snippet;
      const channelId = snippet?.channelId;
      const title = snippet?.channelTitle ?? snippet?.title;
      if (!channelId || !title) {
        continue;
      }

      const thumbnailUrl = snippet?.thumbnails?.medium?.url ?? snippet?.thumbnails?.default?.url;
      results.push(removeUndefined({ channelId, title, thumbnailUrl }));
    }

    return results;
  }

  async listChannelVideos(channelId: string, maxResults = 25): Promise<YouTubeVideoResult[]> {
    const channel = await this.getChannel(channelId);
    if (!channel.uploadsPlaylist) {
      return [];
    }

    const requestedResults = Math.min(Math.max(maxResults, 1), 250);
    let pageToken = "";
    const videos: YouTubeVideoResult[] = [];
    while (videos.length < requestedResults) {
      const pageSize = Math.min(requestedResults - videos.length, 50);
      const params: Record<string, string> = {
        part: "snippet,contentDetails",
        playlistId: channel.uploadsPlaylist,
        maxResults: String(pageSize)
      };
      if (pageToken) {
        params.pageToken = pageToken;
      }
      const data = await this.fetchJson<YouTubePlaylistItemsResponse>("/playlistItems", params);

      for (const item of data.items ?? []) {
        const snippet = item.snippet;
        const videoId = item.contentDetails?.videoId ?? snippet?.resourceId?.videoId;
        const publishedAt = item.contentDetails?.videoPublishedAt ?? snippet?.publishedAt;
        if (!videoId || !snippet?.title || !publishedAt) {
          continue;
        }

        const thumbnailUrl = snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url;
        videos.push(removeUndefined({
          videoId,
          channelId,
          title: snippet.title,
          thumbnailUrl,
          publishedAt
        }));
      }

      if (!data.nextPageToken || !(data.items ?? []).length) {
        break;
      }
      pageToken = data.nextPageToken;
    }

    await this.cacheVideos(videos);
    return videos;
  }

  private async getChannel(channelId: string): Promise<{ uploadsPlaylist?: string }> {
    const cached = await this.prisma.youTubeChannelCache.findUnique({ where: { channelId } });
    if (cached && Date.now() - cached.fetchedAt.getTime() < 1000 * 60 * 60 * 12) {
      return { uploadsPlaylist: cached.uploadsPlaylist ?? undefined };
    }

    const data = await this.fetchJson<YouTubeChannelsResponse>("/channels", {
      part: "snippet,contentDetails",
      id: channelId
    });
    const item = data.items?.[0];
    const title = item?.snippet?.title;
    const uploadsPlaylist = item?.contentDetails?.relatedPlaylists?.uploads;
    if (!item?.id || !title) {
      return {};
    }

    await this.prisma.youTubeChannelCache.upsert({
      where: { channelId: item.id },
      create: {
        channelId: item.id,
        title,
        thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url,
        uploadsPlaylist
      },
      update: {
        title,
        thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url,
        uploadsPlaylist,
        fetchedAt: new Date()
      }
    });

    return { uploadsPlaylist };
  }

  private async cacheVideos(videos: YouTubeVideoResult[]): Promise<void> {
    await Promise.all(
      videos.map((video) =>
        this.prisma.youTubeVideoCache.upsert({
          where: { videoId: video.videoId },
          create: {
            videoId: video.videoId,
            channelId: video.channelId,
            title: video.title,
            thumbnailUrl: video.thumbnailUrl,
            publishedAt: new Date(video.publishedAt)
          },
          update: {
            title: video.title,
            thumbnailUrl: video.thumbnailUrl,
            publishedAt: new Date(video.publishedAt),
            fetchedAt: new Date()
          }
        })
      )
    );
  }

  private async fetchJson<T>(path: string, params: Record<string, string>): Promise<T> {
    if (!this.env.YOUTUBE_API_KEY) {
      throw new Error("YOUTUBE_API_KEY is not configured.");
    }

    const url = new URL(`https://www.googleapis.com/youtube/v3${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set("key", this.env.YOUTUBE_API_KEY);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`YouTube API request failed with ${response.status}.`);
    }
    return (await response.json()) as T;
  }
}

function removeUndefined<T extends Record<string, unknown>>(value: T): T {
  for (const key of Object.keys(value)) {
    if (value[key] === undefined) {
      delete value[key];
    }
  }
  return value;
}
