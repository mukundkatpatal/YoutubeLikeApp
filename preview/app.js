const defaultConfigUrl = "https://raw.githubusercontent.com/mukundkatpatal/son-youtube-config/main/config.json";
const apiBaseUrl = "https://www.googleapis.com/youtube/v3";

const elements = {
  status: document.querySelector("#status"),
  refreshButton: document.querySelector("#refreshButton"),
  playerSection: document.querySelector("#playerSection"),
  channelSection: document.querySelector("#channelSection"),
  videoSection: document.querySelector("#videoSection"),
  channelGrid: document.querySelector("#channelGrid"),
  videoVirtualList: document.querySelector("#videoVirtualList"),
  videoVirtualSpacer: document.querySelector("#videoVirtualSpacer"),
  backButton: document.querySelector("#backButton"),
  channelTitle: document.querySelector("#channelTitle"),
  player: document.querySelector("#player"),
  selectedTitle: document.querySelector("#selectedTitle"),
  selectedMeta: document.querySelector("#selectedMeta")
};

const state = {
  settings: {
    youTubeApiKey: "",
    configUrl: defaultConfigUrl
  },
  config: null,
  channels: [],
  videosByChannelId: new Map(),
  allowedVideoIds: new Set(),
  visibleVideos: [],
  selectedChannelId: "",
  selectedVideoId: ""
};

elements.refreshButton.addEventListener("click", () => {
  refresh().catch(error => setStatus(`Could not load preview. ${error.message}`));
});

elements.backButton.addEventListener("click", () => {
  stopPlayer();
  state.selectedChannelId = "";
  elements.videoSection.classList.add("hidden");
  elements.channelSection.classList.remove("hidden");
  setStatus(`${state.channels.length} approved channels loaded.`);
});

elements.videoVirtualList.addEventListener("scroll", renderVirtualVideos);
window.addEventListener("resize", renderVirtualVideos);

await refresh();

async function refresh() {
  elements.refreshButton.disabled = true;
  setStatus("Loading approved channels...");

  try {
    stopPlayer();
    state.settings = await loadSettings();

    if (!state.settings.youTubeApiKey) {
      state.channels = await loadSampleChannels();
      state.config = null;
      state.allowedVideoIds = new Set();
      renderChannels();
      setStatus("No local API key found. Showing sample channels.");
      return;
    }

    state.config = await loadConfig(state.settings.configUrl);
    const channelLoadResult = await loadChannelCards(state.config, state.settings.youTubeApiKey);
    state.channels = channelLoadResult.channels;
    state.videosByChannelId = channelLoadResult.videosByChannelId;
    state.allowedVideoIds = new Set();
    renderChannels();
    setStatus(`${state.channels.length} approved channels loaded.`);
  } finally {
    elements.refreshButton.disabled = false;
  }
}

async function loadSettings() {
  try {
    const settings = await fetchJson("/preview/settings.local.json");
    return {
      youTubeApiKey: settings.youTubeApiKey || "",
      configUrl: settings.configUrl || defaultConfigUrl
    };
  } catch {
    return {
      youTubeApiKey: "",
      configUrl: defaultConfigUrl
    };
  }
}

async function loadConfig(configUrl) {
  const config = await fetchJson(configUrl || defaultConfigUrl);
  return {
    version: config.version,
    updatedAt: config.updatedAt,
    refreshIntervalMinutes: config.refreshIntervalMinutes ?? 60,
    maxVideosPerChannel: Math.min(Math.max(config.maxVideosPerChannel ?? 25, 1), 200),
    channels: Array.isArray(config.channels) ? config.channels : [],
    blockedVideoIds: Array.isArray(config.blockedVideoIds) ? config.blockedVideoIds : [],
    pinnedVideoIds: Array.isArray(config.pinnedVideoIds) ? config.pinnedVideoIds : []
  };
}

async function loadSampleChannels() {
  const channels = [
    {
      channelId: "UC11111111111111111111",
      title: "Preview Channel",
      description: "Sample data for local layout testing.",
      thumbnailUrl: ""
    },
    {
      channelId: "UC33333333333333333333",
      title: "Second Preview Channel",
      description: "Shows channel sorting by newest upload.",
      thumbnailUrl: ""
    }
  ];

  state.videosByChannelId = new Map();
  for (const channel of channels) {
    const videos = await loadSampleVideos(channel.channelId);
    state.videosByChannelId.set(channel.channelId, videos);
    channel.thumbnailUrl = channel.thumbnailUrl || videos[0]?.thumbnailUrl || "";
    channel.latestPublishedAt = videos[0]?.publishedAt || "";
  }

  return channels.sort((left, right) => new Date(right.latestPublishedAt || 0).getTime()
    - new Date(left.latestPublishedAt || 0).getTime());
}

async function loadSampleVideos(channelId) {
  const videos = await fetchJson("/preview/sample-videos.json");
  return videos
    .filter(video => video.channelId === channelId)
    .sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime());
}

async function loadChannelCards(config, apiKey) {
  const enabledChannels = config.channels.filter(channel => channel.enabled);
  const channelIds = enabledChannels.map(channel => channel.channelId).filter(Boolean);
  const channelTitles = new Map(enabledChannels.map(channel => [channel.channelId, channel.title]));
  const channels = [];

  for (const batch of chunk(channelIds, 50)) {
    const response = await fetchJson(`${apiBaseUrl}/channels?part=snippet,contentDetails&id=${batch.map(encodeURIComponent).join(",")}&key=${encodeURIComponent(apiKey)}`);
    channels.push(...(response.items || []).map(item => ({
      channelId: item.id || "",
      title: channelTitles.get(item.id) || item.snippet?.title || "",
      description: item.snippet?.description || "",
      thumbnailUrl: pickThumbnail(item.snippet?.thumbnails),
      uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads || ""
    })));
  }

  const videosByChannelId = new Map();
  for (const channel of channels.filter(channel => channel.channelId)) {
    const videos = await loadChannelVideos(channel, config, apiKey);
    videosByChannelId.set(channel.channelId, videos);
    channel.thumbnailUrl = channel.thumbnailUrl || videos[0]?.thumbnailUrl || "";
    channel.latestPublishedAt = videos[0]?.publishedAt || "";
  }

  return {
    channels: channels
      .filter(channel => channel.channelId)
      .sort((left, right) => new Date(right.latestPublishedAt || 0).getTime()
        - new Date(left.latestPublishedAt || 0).getTime()),
    videosByChannelId
  };
}

async function loadChannelVideos(channel, config, apiKey) {
  if (state.videosByChannelId.has(channel.channelId)) {
    return state.videosByChannelId.get(channel.channelId);
  }

  if (!apiKey) {
    const sampleVideos = await loadSampleVideos(channel.channelId);
    state.videosByChannelId.set(channel.channelId, sampleVideos);
    return sampleVideos;
  }

  if (!channel.uploadsPlaylistId) {
    state.videosByChannelId.set(channel.channelId, []);
    return [];
  }

  const responseItems = await getPlaylistItems(channel.uploadsPlaylistId, config.maxVideosPerChannel, apiKey);
  const blockedVideoIds = new Set(config.blockedVideoIds);
  const pinnedVideoIds = new Set(config.pinnedVideoIds);
  const pinnedOrder = new Map(config.pinnedVideoIds.map((videoId, index) => [videoId, index]));

  const videos = responseItems
    .map(item => ({
      videoId: item.contentDetails?.videoId || item.snippet?.resourceId?.videoId || "",
      title: item.snippet?.title || "",
      channelId: item.snippet?.videoOwnerChannelId || item.snippet?.channelId || channel.channelId,
      channelTitle: item.snippet?.videoOwnerChannelTitle || item.snippet?.channelTitle || channel.title,
      publishedAt: item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt || "",
      thumbnailUrl: pickThumbnail(item.snippet?.thumbnails),
      isPinned: false
    }))
    .filter(video => video.videoId && !blockedVideoIds.has(video.videoId))
    .filter(video => !isPlaceholderTitle(video.title))
    .map(video => ({
      ...video,
      isPinned: pinnedVideoIds.has(video.videoId)
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

  state.videosByChannelId.set(channel.channelId, videos);
  return videos;
}

async function getPlaylistItems(playlistId, maxResults, apiKey) {
  const requestedResults = Math.min(Math.max(maxResults || 25, 1), 200);
  let remaining = requestedResults;
  let pageToken = "";
  const items = [];

  while (remaining > 0) {
    const pageSize = Math.min(remaining, 50);
    const pageTokenParameter = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
    const response = await fetchJson(`${apiBaseUrl}/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(playlistId)}&maxResults=${pageSize}${pageTokenParameter}&key=${encodeURIComponent(apiKey)}`);
    items.push(...(response.items || []));

    remaining = requestedResults - items.length;
    if (!response.nextPageToken || !(response.items || []).length) {
      break;
    }

    pageToken = response.nextPageToken;
  }

  return items;
}

function renderChannels() {
  elements.channelGrid.innerHTML = "";
  elements.videoSection.classList.add("hidden");
  elements.channelSection.classList.remove("hidden");

  if (!state.channels.length) {
    elements.channelGrid.append(emptyMessage("No approved channels are available."));
    return;
  }

  for (const channel of state.channels) {
    elements.channelGrid.append(renderChannelCard(channel));
  }
}

function renderChannelCard(channel) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "channel-card";
  card.addEventListener("click", () => showChannelVideos(channel));

  const thumbWrap = document.createElement("div");
  thumbWrap.className = "channel-thumb-wrap";

  const thumbnail = document.createElement("img");
  thumbnail.className = "channel-thumb";
  thumbnail.alt = "";
  thumbnail.src = channel.thumbnailUrl || placeholderSvg("156", "156");
  thumbWrap.append(thumbnail);

  const title = document.createElement("p");
  title.className = "card-title";
  title.textContent = channel.title || "Untitled channel";

  const meta = document.createElement("p");
  meta.className = "card-meta";
  meta.textContent = channel.latestPublishedAt
    ? `Latest video ${formatDate(channel.latestPublishedAt)}`
    : "Approved channel";

  card.append(thumbWrap, title, meta);
  return card;
}

async function showChannelVideos(channel) {
  state.visibleVideos = [];
  elements.videoVirtualSpacer.innerHTML = "";
  elements.videoVirtualSpacer.style.height = "0px";
  state.selectedChannelId = channel.channelId;
  stopPlayer();
  elements.refreshButton.disabled = true;
  setStatus(`Loading videos from ${channel.title}...`);

  try {
    const videos = await loadChannelVideos(channel, state.config, state.settings.youTubeApiKey);
    state.allowedVideoIds = new Set(videos.map(video => video.videoId));
    elements.channelTitle.textContent = channel.title || "Videos";
    renderVideos(videos);
    elements.channelSection.classList.add("hidden");
    elements.videoSection.classList.remove("hidden");
    setStatus(`${videos.length} approved videos loaded from ${channel.title}.`);
  } finally {
    elements.refreshButton.disabled = false;
  }
}

function renderVideos(videos) {
  state.visibleVideos = videos;
  elements.videoVirtualList.scrollTop = 0;
  renderVirtualVideos();
}

function renderVirtualVideos() {
  const videos = state.visibleVideos;
  const layout = getVideoGridLayout();
  const rowCount = Math.ceil(videos.length / layout.columns);
  elements.videoVirtualSpacer.style.height = `${rowCount * layout.rowHeight}px`;
  elements.videoVirtualSpacer.innerHTML = "";

  if (!videos.length) {
    elements.videoVirtualSpacer.style.height = "auto";
    elements.videoVirtualSpacer.append(emptyMessage("No approved videos are available for this channel."));
    return;
  }

  const scrollTop = elements.videoVirtualList.scrollTop;
  const viewportHeight = elements.videoVirtualList.clientHeight;
  const startRow = Math.max(Math.floor(scrollTop / layout.rowHeight) - 2, 0);
  const endRow = Math.min(Math.ceil((scrollTop + viewportHeight) / layout.rowHeight) + 2, rowCount);
  const startIndex = startRow * layout.columns;
  const endIndex = Math.min(endRow * layout.columns, videos.length);

  for (let index = startIndex; index < endIndex; index++) {
    const row = Math.floor(index / layout.columns);
    const column = index % layout.columns;
    const card = renderVideoCard(videos[index]);
    card.classList.add("virtual-video-card");
    card.style.width = `${layout.cardWidth}px`;
    card.style.left = `${column * (layout.cardWidth + layout.columnGap)}px`;
    card.style.top = `${row * layout.rowHeight}px`;
    elements.videoVirtualSpacer.append(card);
  }
}

function getVideoGridLayout() {
  const width = elements.videoVirtualList.clientWidth;
  const columnGap = window.matchMedia("(max-width: 760px)").matches ? 14 : 18;
  const rowGap = window.matchMedia("(max-width: 760px)").matches ? 22 : 26;
  const minCardWidth = window.matchMedia("(max-width: 760px)").matches ? 170 : 230;
  const columns = Math.max(1, Math.floor((width + columnGap) / (minCardWidth + columnGap)));
  const cardWidth = Math.floor((width - columnGap * (columns - 1)) / columns);
  const thumbnailHeight = cardWidth * 9 / 16;
  const rowHeight = Math.ceil(thumbnailHeight + 82 + rowGap);

  return { cardWidth, columnGap, columns, rowHeight };
}

function renderVideoCard(video) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = `video-card${video.videoId === state.selectedVideoId ? " selected" : ""}`;
  card.addEventListener("click", () => playVideo(video));

  const thumbnail = document.createElement("img");
  thumbnail.className = "video-thumb";
  thumbnail.alt = "";
  thumbnail.src = video.thumbnailUrl || placeholderSvg("320", "180");

  const title = document.createElement("p");
  title.className = "card-title";
  title.textContent = video.title;

  const meta = document.createElement("p");
  meta.className = "card-meta";
  meta.textContent = `${formatDate(video.publishedAt)}${video.isPinned ? "  Pinned" : ""}`;

  card.append(thumbnail, title, meta);
  return card;
}

async function playVideo(video) {
  state.selectedVideoId = video.videoId;
  elements.selectedTitle.textContent = video.title;
  elements.selectedMeta.textContent = `${video.channelTitle} • ${formatDate(video.publishedAt)}`;
  setStatus(`Opening approved video: ${video.title}`);

  if (!state.allowedVideoIds.has(video.videoId)) {
    setStatus(`Blocked an unapproved video: ${video.videoId}.`);
    stopPlayer();
    return;
  }

  elements.playerSection.classList.remove("hidden");
  renderFallbackIframe(video, {
    autoplay: 1,
    controls: 1,
    disablekb: 1,
    enablejsapi: 1,
    fs: 1,
    iv_load_policy: 3,
    playsinline: 1,
    rel: 0,
    origin: window.location.origin
  });

  elements.playerSection.scrollIntoView({ behavior: "smooth", block: "start" });
  setStatus("Playing approved video.");
}

function stopPlayer() {
  elements.player.replaceChildren();
  elements.playerSection.classList.add("hidden");
  state.selectedVideoId = "";
}

function renderFallbackIframe(video, playerVars) {
  elements.player.replaceChildren();

  const iframe = document.createElement("iframe");
  const query = new URLSearchParams(playerVars);
  iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(video.videoId)}?${query.toString()}`;
  iframe.title = video.title;
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  elements.player.append(iframe);
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${redactApiKey(url)} returned HTTP ${response.status}`);
  }
  return response.json();
}

function redactApiKey(url) {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("key")) {
      parsed.searchParams.set("key", "REDACTED");
    }
    return parsed.toString();
  } catch {
    return url.replace(/([?&]key=)[^&]+/i, "$1REDACTED");
  }
}

function pickThumbnail(thumbnails) {
  for (const key of ["maxres", "standard", "high", "medium", "default"]) {
    if (thumbnails?.[key]?.url) {
      return thumbnails[key].url;
    }
  }
  return "";
}

function isPlaceholderTitle(title) {
  return title === "Private video" || title === "Deleted video";
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function setStatus(message) {
  elements.status.textContent = message;
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function emptyMessage(text) {
  const empty = document.createElement("p");
  empty.className = "empty";
  empty.textContent = text;
  return empty;
}

function placeholderSvg(width, height) {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'%3E%3Crect width='${width}' height='${height}' fill='%23eeeeee'/%3E%3C/svg%3E`;
}
