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

export type ChildVideoItem = {
  videoId: string;
  channelId: string;
  title: string;
  thumbnailUrl?: string;
  publishedAt: string;
  isPinned: boolean;
};

export type ChildVideoPage = {
  items: ChildVideoItem[];
  nextCursor: string | null;
  refreshedAt: string | null;
};
