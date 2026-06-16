import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { useRegisterSW } from "virtual:pwa-register/react";
import { fetchBootstrap, fetchChannelVideos } from "./api";
import { readCache, writeCache } from "./cache";
import type { ChildBootstrap, ChildChannelSummary, ChildVideoItem, ChildVideoPage } from "./types";
import { compareVersions } from "./version";
import "./styles.css";

const tokenStorageKey = "sane-videos-child-token";
const bootstrapCacheKey = "bootstrap";
const appVersion = import.meta.env.VITE_APP_VERSION || "0.1.0";

function App() {
  const [accessToken, setAccessToken] = useState(() => readInitialToken());
  const [bootstrap, setBootstrap] = useState<ChildBootstrap | null>(null);
  const [status, setStatus] = useState("Loading approved channels...");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<ChildChannelSummary | null>(null);
  const [videos, setVideos] = useState<ChildVideoItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<ChildVideoItem | null>(null);
  const [allowedVideoIds, setAllowedVideoIds] = useState<Set<string>>(() => new Set());

  const {
    needRefresh: [needRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) {
        return;
      }
      const checkForUpdate = () => registration.update().catch(() => undefined);
      checkForUpdate();
      window.addEventListener("focus", checkForUpdate);
      window.addEventListener("online", checkForUpdate);
      window.setInterval(checkForUpdate, 1000 * 60 * 60);
    }
  });

  const updateRequired = useMemo(() => {
    const minimumVersion = bootstrap?.app.minimumSupportedVersion;
    return minimumVersion ? compareVersions(appVersion, minimumVersion) < 0 : false;
  }, [bootstrap]);

  useEffect(() => {
    const setupToken = tokenFromUrl();
    if (setupToken) {
      localStorage.setItem(tokenStorageKey, setupToken);
      setAccessToken(setupToken);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!accessToken) {
        setIsLoading(false);
        setStatus("Open the install link from the parent admin app.");
        return;
      }

      setIsLoading(true);
      const cached = await readCache<ChildBootstrap>(bootstrapCacheKey);
      if (!cancelled && cached) {
        setBootstrap(cached);
        setStatus("Showing saved channels while checking for updates...");
      }

      try {
        const fresh = await fetchBootstrap(accessToken);
        if (cancelled) {
          return;
        }
        setBootstrap(fresh);
        setStatus(`${fresh.channels.length} approved channels loaded.`);
        await writeCache(bootstrapCacheKey, fresh);
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (cached) {
          setStatus(`Using saved channels. ${error instanceof Error ? error.message : "Could not refresh."}`);
        } else {
          setBootstrap(null);
          setStatus(error instanceof Error ? error.message : "Could not load child app.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function openChannel(channel: ChildChannelSummary) {
    if (!accessToken) {
      return;
    }

    setSelectedChannel(channel);
    setSelectedVideo(null);
    setVideos([]);
    setNextCursor(null);
    setIsLoadingVideos(true);
    setStatus(`Loading videos from ${channel.title}...`);

    const cacheKey = videosCacheKey(channel.channelId);
    const cached = await readCache<ChildVideoPage>(cacheKey);
    if (cached) {
      setVideos(cached.items);
      setNextCursor(cached.nextCursor);
      setAllowedVideoIds(new Set(cached.items.map((video) => video.videoId)));
      setStatus(`Showing saved videos from ${channel.title}.`);
    }

    try {
      const page = await fetchChannelVideos(accessToken, channel.channelId);
      setVideos(page.items);
      setNextCursor(page.nextCursor);
      setAllowedVideoIds(new Set(page.items.map((video) => video.videoId)));
      setStatus(`${page.items.length} approved videos loaded from ${channel.title}.`);
      await writeCache(cacheKey, page);
    } catch (error) {
      setStatus(cached
        ? `Using saved videos. ${error instanceof Error ? error.message : "Could not refresh."}`
        : error instanceof Error ? error.message : "Could not load videos.");
    } finally {
      setIsLoadingVideos(false);
    }
  }

  async function loadMoreVideos() {
    if (!accessToken || !selectedChannel || !nextCursor) {
      return;
    }

    setIsLoadingVideos(true);
    try {
      const page = await fetchChannelVideos(accessToken, selectedChannel.channelId, nextCursor);
      const merged = [...videos, ...page.items];
      setVideos(merged);
      setNextCursor(page.nextCursor);
      setAllowedVideoIds(new Set(merged.map((video) => video.videoId)));
      await writeCache(videosCacheKey(selectedChannel.channelId), {
        items: merged,
        nextCursor: page.nextCursor,
        refreshedAt: page.refreshedAt
      });
      setStatus(`${merged.length} approved videos loaded from ${selectedChannel.title}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load more videos.");
    } finally {
      setIsLoadingVideos(false);
    }
  }

  function playVideo(video: ChildVideoItem) {
    if (!allowedVideoIds.has(video.videoId)) {
      setSelectedVideo(null);
      setStatus("Blocked an unapproved video.");
      return;
    }

    setSelectedVideo(video);
    setStatus(`Playing approved video: ${video.title}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!accessToken) {
    return <SetupRequired />;
  }

  if (updateRequired || needRefresh) {
    return (
      <UpdateRequired
        updateRequired={updateRequired}
        currentVersion={appVersion}
        minimumVersion={bootstrap?.app.minimumSupportedVersion}
        onUpdate={() => updateServiceWorker(true)}
      />
    );
  }

  return (
    <main>
      <header className="topbar">
        <div>
          <p className="eyebrow">YouTube Beta</p>
          <h1>{selectedChannel ? selectedChannel.title : "Channels"}</h1>
          <p className="status">{status}</p>
        </div>
        <div className="header-actions">
          {selectedChannel && (
            <button type="button" onClick={() => {
              setSelectedChannel(null);
              setSelectedVideo(null);
              setVideos([]);
              setNextCursor(null);
              setStatus(`${bootstrap?.channels.length ?? 0} approved channels loaded.`);
            }}>
              Channels
            </button>
          )}
          <button type="button" onClick={() => window.location.reload()}>
            Refresh
          </button>
        </div>
      </header>

      {selectedVideo && <Player video={selectedVideo} />}

      {!selectedChannel ? (
        <ChannelGrid
          bootstrap={bootstrap}
          isLoading={isLoading}
          onOpenChannel={openChannel}
        />
      ) : (
        <VideoGrid
          channel={selectedChannel}
          videos={videos}
          isLoading={isLoadingVideos}
          nextCursor={nextCursor}
          onPlay={playVideo}
          onLoadMore={loadMoreVideos}
        />
      )}
    </main>
  );
}

function SetupRequired() {
  return (
    <main className="center-shell">
      <section className="message-panel">
        <p className="eyebrow">YouTube Beta</p>
        <h1>Setup needed</h1>
        <p>Open the child install link from the parent admin app on this device.</p>
      </section>
    </main>
  );
}

function UpdateRequired({
  updateRequired,
  currentVersion,
  minimumVersion,
  onUpdate
}: {
  updateRequired: boolean;
  currentVersion: string;
  minimumVersion?: string;
  onUpdate: () => void;
}) {
  return (
    <main className="center-shell">
      <section className="message-panel">
        <p className="eyebrow">YouTube Beta</p>
        <h1>{updateRequired ? "Update required" : "Update ready"}</h1>
        <p>
          Current version {currentVersion}
          {minimumVersion ? `, minimum version ${minimumVersion}.` : "."}
        </p>
        <button type="button" className="primary" onClick={onUpdate}>
          Update now
        </button>
      </section>
    </main>
  );
}

function ChannelGrid({
  bootstrap,
  isLoading,
  onOpenChannel
}: {
  bootstrap: ChildBootstrap | null;
  isLoading: boolean;
  onOpenChannel: (channel: ChildChannelSummary) => void;
}) {
  if (isLoading && !bootstrap) {
    return <SkeletonGrid type="channel" count={12} />;
  }

  if (!bootstrap || bootstrap.channels.length === 0) {
    return <p className="empty-state">No approved channels are available.</p>;
  }

  return (
    <section className="content-grid channel-grid" aria-label="Approved channels">
      {bootstrap.channels.map((channel) => (
        <button
          type="button"
          className="channel-card"
          key={channel.channelId}
          onClick={() => onOpenChannel(channel)}
        >
          <span className="channel-thumb-wrap">
            {channel.thumbnailUrl ? <img src={channel.thumbnailUrl} alt="" /> : <span className="thumb-fallback" />}
          </span>
          <strong>{channel.title}</strong>
          <span>{channel.latestPublishedAt ? `Latest ${formatDate(channel.latestPublishedAt)}` : "Approved channel"}</span>
        </button>
      ))}
    </section>
  );
}

function VideoGrid({
  channel,
  videos,
  isLoading,
  nextCursor,
  onPlay,
  onLoadMore
}: {
  channel: ChildChannelSummary;
  videos: ChildVideoItem[];
  isLoading: boolean;
  nextCursor: string | null;
  onPlay: (video: ChildVideoItem) => void;
  onLoadMore: () => void;
}) {
  if (isLoading && videos.length === 0) {
    return <SkeletonGrid type="video" count={12} />;
  }

  return (
    <section className="video-section" aria-label={`${channel.title} videos`}>
      {videos.length === 0 ? (
        <p className="empty-state">No approved videos are available for this channel yet.</p>
      ) : (
        <div className="content-grid video-grid">
          {videos.map((video) => (
            <button type="button" className="video-card" key={video.videoId} onClick={() => onPlay(video)}>
              {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" /> : <span className="video-thumb-fallback" />}
              <strong>{video.title}</strong>
              <span>{formatDate(video.publishedAt)}{video.isPinned ? " • Pinned" : ""}</span>
            </button>
          ))}
        </div>
      )}
      {nextCursor && (
        <div className="load-more">
          <button type="button" className="primary" onClick={onLoadMore} disabled={isLoading}>
            {isLoading ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </section>
  );
}

function Player({ video }: { video: ChildVideoItem }) {
  const query = new URLSearchParams({
    autoplay: "1",
    controls: "1",
    disablekb: "1",
    enablejsapi: "1",
    fs: "1",
    playsinline: "1",
    rel: "0",
    origin: window.location.origin
  });

  return (
    <section className="player-section" aria-label="Player">
      <div className="player-frame">
        <iframe
          title={video.title}
          src={`https://www.youtube.com/embed/${encodeURIComponent(video.videoId)}?${query.toString()}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <h2>{video.title}</h2>
    </section>
  );
}

function SkeletonGrid({ type, count }: { type: "channel" | "video"; count: number }) {
  return (
    <section className={`content-grid ${type}-grid skeleton-grid`} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-card" key={index}>
          <div className={type === "channel" ? "skeleton-channel-thumb" : "skeleton-video-thumb"} />
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
        </div>
      ))}
    </section>
  );
}

function readInitialToken(): string {
  return tokenFromUrl() || localStorage.getItem(tokenStorageKey) || "";
}

function tokenFromUrl(): string {
  const url = new URL(window.location.href);
  return url.searchParams.get("token")?.trim() || "";
}

function videosCacheKey(channelId: string): string {
  return `videos:${channelId}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

createRoot(document.getElementById("root")!).render(<App />);
