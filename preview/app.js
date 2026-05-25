const defaultConfigUrl = "https://raw.githubusercontent.com/mukundkatpatal/son-youtube-config/main/config.json";
const apiBaseUrl = "https://www.googleapis.com/youtube/v3";
const rowHeight = 104;

const elements = {
  status: document.querySelector("#status"),
  refreshButton: document.querySelector("#refreshButton"),
  apiKeyInput: document.querySelector("#apiKeyInput"),
  configUrlInput: document.querySelector("#configUrlInput"),
  virtualList: document.querySelector("#virtualList"),
  virtualSpacer: document.querySelector("#virtualSpacer"),
  player: document.querySelector("#player"),
  selectedTitle: document.querySelector("#selectedTitle"),
  selectedMeta: document.querySelector("#selectedMeta")
};

const state = {
  videos: [],
  selectedVideoId: "",
  allowedVideoIds: new Set()
};

elements.apiKeyInput.value = localStorage.getItem("mukundtube.preview.apiKey") || "";
elements.configUrlInput.value = localStorage.getItem("mukundtube.preview.configUrl") || defaultConfigUrl;

elements.apiKeyInput.addEventListener("change", () => {
  localStorage.setItem("mukundtube.preview.apiKey", elements.apiKeyInput.value.trim());
});

elements.configUrlInput.addEventListener("change", () => {
  localStorage.setItem("mukundtube.preview.configUrl", elements.configUrlInput.value.trim());
});

elements.refreshButton.addEventListener("click", () => {
  refresh().catch(error => setStatus(`Could not load preview. ${error.message}`));
});

elements.virtualList.addEventListener("scroll", renderVirtualRows);
window.addEventListener("resize", renderVirtualRows);

await refresh();

async function refresh() {
  elements.refreshButton.disabled = true;
  setStatus("Loading approved videos...");

  try {
    const apiKey = elements.apiKeyInput.value.trim();

    if (!apiKey) {
      state.videos = await loadSampleVideos();
      state.allowedVideoIds = new Set(state.videos.map(video => video.videoId));
      setStatus("No API key set. Showing local sample data for Mac UI testing.");
      renderVirtualRows();
      return;
    }

    const config = await loadConfig();
    const candidates = [];
    for (const channel of config.channels.filter(channel => channel.enabled)) {
      candidates.push(...await getLatestChannelVideos(channel.channelId, config.maxVideosPerChannel, apiKey));
    }

    if (config.pinnedVideoIds.length) {
      candidates.push(...await getVideosByIds(config.pinnedVideoIds, apiKey));
    }

    state.videos = applyPolicy(config, candidates);
    state.allowedVideoIds = new Set(state.videos.map(video => video.videoId));
    setStatus(`${state.videos.length} approved videos loaded from remote config.`);
    renderVirtualRows();
  } finally {
    elements.refreshButton.disabled = false;
  }
}

async function loadConfig() {
  const configUrl = elements.configUrlInput.value.trim() || defaultConfigUrl;
  const config = await fetchJson(configUrl);
  return {
    version: config.version,
    updatedAt: config.updatedAt,
    refreshIntervalMinutes: config.refreshIntervalMinutes ?? 60,
    maxVideosPerChannel: Math.min(Math.max(config.maxVideosPerChannel ?? 25, 1), 50),
    channels: Array.isArray(config.channels) ? config.channels : [],
    blockedVideoIds: Array.isArray(config.blockedVideoIds) ? config.blockedVideoIds : [],
    pinnedVideoIds: Array.isArray(config.pinnedVideoIds) ? config.pinnedVideoIds : []
  };
}

async function loadSampleVideos() {
  return fetchJson("/preview/sample-videos.json");
}

async function getLatestChannelVideos(channelId, maxResults, apiKey) {
  const channelResponse = await fetchJson(`${apiBaseUrl}/channels?part=contentDetails&id=${encodeURIComponent(channelId)}&key=${encodeURIComponent(apiKey)}`);
  const uploadsPlaylistId = channelResponse.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) {
    return [];
  }

  const playlistResponse = await fetchJson(`${apiBaseUrl}/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploadsPlaylistId)}&maxResults=${maxResults}&key=${encodeURIComponent(apiKey)}`);
  return (playlistResponse.items || [])
    .map(item => ({
      videoId: item.contentDetails?.videoId || item.snippet?.resourceId?.videoId || "",
      title: item.snippet?.title || "",
      channelId: item.snippet?.videoOwnerChannelId || item.snippet?.channelId || "",
      channelTitle: item.snippet?.videoOwnerChannelTitle || item.snippet?.channelTitle || "",
      publishedAt: item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt || "",
      thumbnailUrl: pickThumbnail(item.snippet?.thumbnails),
      isPinned: false
    }))
    .filter(video => video.videoId && !isPlaceholderTitle(video.title));
}

async function getVideosByIds(videoIds, apiKey) {
  const uniqueIds = [...new Set(videoIds)].filter(Boolean);
  const videos = [];

  for (let index = 0; index < uniqueIds.length; index += 50) {
    const batch = uniqueIds.slice(index, index + 50);
    const response = await fetchJson(`${apiBaseUrl}/videos?part=snippet,status&id=${batch.map(encodeURIComponent).join(",")}&key=${encodeURIComponent(apiKey)}`);
    videos.push(...(response.items || [])
      .filter(item => item.status?.embeddable !== false)
      .filter(item => !item.status?.privacyStatus || item.status.privacyStatus === "public")
      .map(item => ({
        videoId: item.id || "",
        title: item.snippet?.title || "",
        channelId: item.snippet?.channelId || "",
        channelTitle: item.snippet?.channelTitle || "",
        publishedAt: item.snippet?.publishedAt || "",
        thumbnailUrl: pickThumbnail(item.snippet?.thumbnails),
        isPinned: false
      }))
      .filter(video => video.videoId && !isPlaceholderTitle(video.title)));
  }

  return videos;
}

function applyPolicy(config, candidates) {
  const enabledChannelIds = new Set(config.channels.filter(channel => channel.enabled).map(channel => channel.channelId));
  const blockedVideoIds = new Set(config.blockedVideoIds);
  const pinnedVideoIds = new Set(config.pinnedVideoIds);
  const pinnedOrder = new Map(config.pinnedVideoIds.map((videoId, index) => [videoId, index]));
  const byVideoId = new Map();

  for (const video of candidates) {
    if (!video.videoId || blockedVideoIds.has(video.videoId)) {
      continue;
    }

    if (!enabledChannelIds.has(video.channelId) && !pinnedVideoIds.has(video.videoId)) {
      continue;
    }

    byVideoId.set(video.videoId, {
      ...video,
      isPinned: pinnedVideoIds.has(video.videoId)
    });
  }

  return [...byVideoId.values()].sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return left.isPinned ? -1 : 1;
    }

    if (left.isPinned && right.isPinned) {
      return (pinnedOrder.get(left.videoId) ?? Number.MAX_SAFE_INTEGER)
        - (pinnedOrder.get(right.videoId) ?? Number.MAX_SAFE_INTEGER);
    }

    return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime();
  });
}

function renderVirtualRows() {
  const totalHeight = state.videos.length * rowHeight;
  elements.virtualSpacer.style.height = `${totalHeight}px`;
  elements.virtualSpacer.innerHTML = "";

  if (!state.videos.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No approved videos are available.";
    elements.virtualSpacer.append(empty);
    return;
  }

  const scrollTop = elements.virtualList.scrollTop;
  const viewportHeight = elements.virtualList.clientHeight;
  const start = Math.max(Math.floor(scrollTop / rowHeight) - 4, 0);
  const end = Math.min(Math.ceil((scrollTop + viewportHeight) / rowHeight) + 4, state.videos.length);

  for (let index = start; index < end; index++) {
    elements.virtualSpacer.append(renderRow(state.videos[index], index));
  }
}

function renderRow(video, index) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = `video-row${video.videoId === state.selectedVideoId ? " selected" : ""}`;
  row.style.top = `${index * rowHeight}px`;
  row.setAttribute("role", "option");
  row.setAttribute("aria-selected", video.videoId === state.selectedVideoId ? "true" : "false");
  row.addEventListener("click", () => playVideo(video));

  const thumbnail = document.createElement("img");
  thumbnail.className = "thumb";
  thumbnail.alt = "";
  thumbnail.src = video.thumbnailUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='68'%3E%3Crect width='120' height='68' fill='%23dde4ee'/%3E%3C/svg%3E";

  const body = document.createElement("div");
  const title = document.createElement("p");
  title.className = "video-title";
  title.textContent = video.title;

  const meta = document.createElement("div");
  meta.className = "video-meta";
  meta.textContent = video.channelTitle;

  const date = document.createElement("div");
  date.className = "video-date";
  date.textContent = `${formatDate(video.publishedAt)}${video.isPinned ? "  Pinned" : ""}`;
  if (video.isPinned) {
    date.classList.add("pinned");
  }

  body.append(title, meta, date);
  row.append(thumbnail, body);
  return row;
}

async function playVideo(video) {
  state.selectedVideoId = video.videoId;
  elements.selectedTitle.textContent = video.title;
  elements.selectedMeta.textContent = `${video.channelTitle} • ${formatDate(video.publishedAt)}`;
  renderVirtualRows();
  setStatus(`Opening approved video: ${video.title}`);

  if (!state.allowedVideoIds.has(video.videoId)) {
    setStatus(`Blocked an unapproved video: ${video.videoId}.`);
    stopPlayer();
    return;
  }

  const playerVars = {
    autoplay: 1,
    controls: 1,
    disablekb: 1,
    enablejsapi: 1,
    fs: 1,
    iv_load_policy: 3,
    playsinline: 1,
    rel: 0,
    origin: window.location.origin
  };
  setStatus(`Preparing player for approved video: ${video.title}`);

  setStatus("Mac preview playback uses a direct official YouTube embed. The Windows app adds the playback guard.");
  renderFallbackIframe(video, playerVars);
}

function stopPlayer() {
  elements.player.replaceChildren();
  state.selectedVideoId = "";
  renderVirtualRows();
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
