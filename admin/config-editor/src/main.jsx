import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import defaultConfig from "./default-config.json";
import "./styles.css";

const rawConfigUrl = "https://raw.githubusercontent.com/mukundkatpatal/son-youtube-config/main/config.json";
const githubEditUrl = "https://github.com/mukundkatpatal/son-youtube-config/edit/main/config.json";
const youtubeApiBaseUrl = "https://www.googleapis.com/youtube/v3";
const apiKeyStorageKey = "youtube-beta-config-editor-api-key";

function createEmptyChannel() {
  return {
    channelId: "",
    title: "",
    enabled: true
  };
}

function normalizeConfig(config) {
  return {
    version: Number(config.version ?? 1),
    updatedAt: config.updatedAt || new Date().toISOString(),
    refreshIntervalMinutes: Number(config.refreshIntervalMinutes ?? 60),
    maxVideosPerChannel: Number(config.maxVideosPerChannel ?? 100),
    channels: Array.isArray(config.channels) ? config.channels.map(normalizeChannel) : [],
    blockedVideoIds: Array.isArray(config.blockedVideoIds) ? config.blockedVideoIds : [],
    pinnedVideoIds: Array.isArray(config.pinnedVideoIds) ? config.pinnedVideoIds : []
  };
}

function normalizeChannel(channel) {
  return {
    channelId: channel.channelId || "",
    title: channel.title || "",
    enabled: channel.enabled !== false
  };
}

function formatConfig(config) {
  return JSON.stringify(
    {
      ...config,
      updatedAt: config.updatedAt || new Date().toISOString(),
      channels: config.channels.map(normalizeChannel),
      blockedVideoIds: config.blockedVideoIds.filter(Boolean),
      pinnedVideoIds: config.pinnedVideoIds.filter(Boolean)
    },
    null,
    2
  );
}

function splitVideoIds(value) {
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateConfig(config) {
  const errors = [];

  if (config.version !== 1) {
    errors.push("Only config version 1 is supported.");
  }

  if (config.refreshIntervalMinutes < 1 || config.refreshIntervalMinutes > 1440) {
    errors.push("Refresh interval must be between 1 and 1440 minutes.");
  }

  if (config.maxVideosPerChannel < 1 || config.maxVideosPerChannel > 500) {
    errors.push("Max videos per channel must be between 1 and 500.");
  }

  const channelIds = new Set();
  config.channels.forEach((channel, index) => {
    const label = channel.title || `Channel ${index + 1}`;
    if (!looksLikeChannelId(channel.channelId)) {
      errors.push(`${label}: channel ID must be a UC... YouTube channel ID.`);
    }

    if (channelIds.has(channel.channelId)) {
      errors.push(`${label}: duplicate channel ID.`);
    }

    channelIds.add(channel.channelId);
  });

  validateVideoIds(config.blockedVideoIds, "Blocked video", errors);
  validateVideoIds(config.pinnedVideoIds, "Pinned video", errors);

  return errors;
}

function looksLikeChannelId(value) {
  return /^UC[A-Za-z0-9_-]{18,38}$/.test(value);
}

function validateVideoIds(videoIds, label, errors) {
  const seen = new Set();
  videoIds.forEach((videoId) => {
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      errors.push(`${label} '${videoId}' must be an 11-character YouTube video ID.`);
    }

    if (seen.has(videoId)) {
      errors.push(`${label} '${videoId}' is duplicated.`);
    }

    seen.add(videoId);
  });
}

function channelUrl(channelId) {
  return `https://www.youtube.com/channel/${encodeURIComponent(channelId)}`;
}

function parseChannelInput(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return { kind: "empty", value: "" };
  }

  if (looksLikeChannelId(trimmed)) {
    return { kind: "id", value: trimmed };
  }

  if (trimmed.startsWith("@")) {
    return { kind: "handle", value: trimmed };
  }

  try {
    const url = new URL(trimmed);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const channelIndex = pathParts.indexOf("channel");
    const userIndex = pathParts.indexOf("user");
    const customIndex = pathParts.indexOf("c");

    if (channelIndex >= 0 && looksLikeChannelId(pathParts[channelIndex + 1] || "")) {
      return { kind: "id", value: pathParts[channelIndex + 1] };
    }

    if (pathParts[0]?.startsWith("@")) {
      return { kind: "handle", value: pathParts[0] };
    }

    if (userIndex >= 0 && pathParts[userIndex + 1]) {
      return { kind: "username", value: pathParts[userIndex + 1] };
    }

    if (customIndex >= 0 && pathParts[customIndex + 1]) {
      return { kind: "search", value: pathParts[customIndex + 1].replace(/-/g, " ") };
    }
  } catch {
    // Plain text falls through to search.
  }

  return { kind: "search", value: trimmed.replace(/^@/, "") };
}

async function getJson(url) {
  const response = await fetch(url);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`YouTube API returned ${response.status}: ${body}`);
  }

  return JSON.parse(body);
}

function toCandidate(item) {
  const snippet = item.snippet || {};
  return {
    channelId: item.id?.channelId || item.id || "",
    title: snippet.title || "",
    description: snippet.description || "",
    thumbnailUrl:
      snippet.thumbnails?.default?.url ||
      snippet.thumbnails?.medium?.url ||
      snippet.thumbnails?.high?.url ||
      "",
    source: item.source || ""
  };
}

async function resolveExactChannel(parsed, apiKey) {
  const params = new URLSearchParams({
    part: "snippet",
    key: apiKey
  });

  if (parsed.kind === "id") {
    params.set("id", parsed.value);
  } else if (parsed.kind === "handle") {
    params.set("forHandle", parsed.value);
  } else if (parsed.kind === "username") {
    params.set("forUsername", parsed.value);
  } else {
    return [];
  }

  const data = await getJson(`${youtubeApiBaseUrl}/channels?${params.toString()}`);
  return (data.items || []).map((item) => toCandidate({ ...item, source: parsed.kind }));
}

async function searchChannels(query, apiKey) {
  const params = new URLSearchParams({
    part: "snippet",
    type: "channel",
    maxResults: "6",
    q: query,
    key: apiKey
  });

  const data = await getJson(`${youtubeApiBaseUrl}/search?${params.toString()}`);
  return (data.items || []).map((item) => toCandidate({ ...item, source: "search" }));
}

function App() {
  const [config, setConfig] = useState(() => normalizeConfig(defaultConfig));
  const [jsonDraft, setJsonDraft] = useState(() => formatConfig(normalizeConfig(defaultConfig)));
  const [message, setMessage] = useState("Loaded downloaded GitHub config.");
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(apiKeyStorageKey) || "");
  const [channelInput, setChannelInput] = useState("");
  const [resolverStatus, setResolverStatus] = useState("");
  const [resolverResults, setResolverResults] = useState([]);
  const [isResolving, setIsResolving] = useState(false);
  const errors = useMemo(() => validateConfig(config), [config]);
  const channelIdSet = useMemo(
    () => new Set(config.channels.map((channel) => channel.channelId).filter(Boolean)),
    [config.channels]
  );
  const enabledCount = config.channels.filter((channel) => channel.enabled).length;

  function updateConfig(patch) {
    setConfig((current) => {
      const next = { ...current, ...patch };
      setJsonDraft(formatConfig(next));
      return next;
    });
  }

  function updateChannel(index, patch) {
    updateConfig({
      channels: config.channels.map((channel, channelIndex) =>
        channelIndex === index ? { ...channel, ...patch } : channel
      )
    });
  }

  function removeChannel(index) {
    updateConfig({
      channels: config.channels.filter((_, channelIndex) => channelIndex !== index)
    });
  }

  function moveChannel(index, direction) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= config.channels.length) {
      return;
    }

    const channels = [...config.channels];
    const [channel] = channels.splice(index, 1);
    channels.splice(nextIndex, 0, channel);
    updateConfig({ channels });
  }

  function addChannel() {
    updateConfig({ channels: [...config.channels, createEmptyChannel()] });
  }

  function saveApiKey(value) {
    setApiKey(value);
    if (value.trim()) {
      localStorage.setItem(apiKeyStorageKey, value.trim());
    } else {
      localStorage.removeItem(apiKeyStorageKey);
    }
  }

  async function resolveChannel() {
    const parsed = parseChannelInput(channelInput);
    if (parsed.kind === "empty") {
      setResolverStatus("Paste a YouTube channel URL, @handle, channel ID, or search text.");
      setResolverResults([]);
      return;
    }

    if (!apiKey.trim()) {
      setResolverStatus("Paste a YouTube Data API key first.");
      setResolverResults([]);
      return;
    }

    setIsResolving(true);
    setResolverStatus("Resolving channel...");
    setResolverResults([]);

    try {
      let results = await resolveExactChannel(parsed, apiKey.trim());
      if (results.length === 0 && parsed.kind !== "search") {
        setResolverStatus("No exact match found. Searching channels...");
        results = await searchChannels(parsed.value.replace(/^@/, ""), apiKey.trim());
      } else if (parsed.kind === "search") {
        results = await searchChannels(parsed.value, apiKey.trim());
      }

      setResolverResults(results);
      setResolverStatus(
        results.length === 0
          ? "No channels found."
          : parsed.kind === "search"
            ? "Choose the correct channel from the search results."
            : "Review the resolved channel before adding it."
      );
    } catch (error) {
      setResolverStatus(error.message);
    } finally {
      setIsResolving(false);
    }
  }

  function addResolvedChannel(candidate) {
    if (!candidate.channelId) {
      setResolverStatus("Could not add this channel because the channel ID is missing.");
      return;
    }

    if (channelIdSet.has(candidate.channelId)) {
      setResolverStatus(`${candidate.title || candidate.channelId} is already in the config.`);
      return;
    }

    updateConfig({
      channels: [
        ...config.channels,
        {
          channelId: candidate.channelId,
          title: candidate.title || candidate.channelId,
          enabled: true
        }
      ]
    });
    setResolverStatus(`Added ${candidate.title || candidate.channelId}.`);
  }

  function applyJsonDraft() {
    try {
      const parsed = normalizeConfig(JSON.parse(jsonDraft));
      setConfig(parsed);
      setJsonDraft(formatConfig(parsed));
      setMessage("JSON applied.");
    } catch (error) {
      setMessage(`Could not parse JSON: ${error.message}`);
    }
  }

  async function importFile(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    try {
      const parsed = normalizeConfig(JSON.parse(text));
      setConfig(parsed);
      setJsonDraft(formatConfig(parsed));
      setMessage(`Imported ${file.name}.`);
    } catch (error) {
      setMessage(`Could not import ${file.name}: ${error.message}`);
    }
  }

  async function copyJson() {
    await navigator.clipboard.writeText(formatConfig(config));
    setMessage("Config JSON copied to clipboard.");
  }

  function downloadJson() {
    const blob = new Blob([formatConfig(config), "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "config.json";
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Downloaded config.json.");
  }

  return (
    <main>
      <header className="topbar">
        <div>
          <p className="eyebrow">Youtube Beta Admin</p>
          <h1>Config editor</h1>
        </div>
        <div className="actions">
          <a className="button ghost" href={rawConfigUrl} target="_blank" rel="noreferrer">
            Raw config
          </a>
          <a className="button ghost" href={githubEditUrl} target="_blank" rel="noreferrer">
            Edit on GitHub
          </a>
          <button type="button" onClick={copyJson}>
            Copy JSON
          </button>
          <button type="button" className="primary" onClick={downloadJson}>
            Download config.json
          </button>
        </div>
      </header>

      <section className="status-grid">
        <article>
          <span>{config.channels.length}</span>
          <p>Channels</p>
        </article>
        <article>
          <span>{enabledCount}</span>
          <p>Enabled</p>
        </article>
        <article>
          <span>{config.blockedVideoIds.length}</span>
          <p>Blocked videos</p>
        </article>
        <article>
          <span>{config.pinnedVideoIds.length}</span>
          <p>Pinned videos</p>
        </article>
      </section>

      <section className="notice">
        <strong>{errors.length === 0 ? "Config is valid" : `${errors.length} issue(s) to fix`}</strong>
        <span>{message}</span>
        {errors.length > 0 && (
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
      </section>

      <div className="layout">
        <section className="panel">
          <div className="section-head">
            <h2>General</h2>
          </div>
          <div className="form-grid">
            <label>
              Version
              <input
                type="number"
                min="1"
                value={config.version}
                onChange={(event) => updateConfig({ version: Number(event.target.value) })}
              />
            </label>
            <label>
              Updated at
              <input
                value={config.updatedAt}
                onChange={(event) => updateConfig({ updatedAt: event.target.value })}
              />
            </label>
            <label>
              Refresh interval minutes
              <input
                type="number"
                min="1"
                max="1440"
                value={config.refreshIntervalMinutes}
                onChange={(event) => updateConfig({ refreshIntervalMinutes: Number(event.target.value) })}
              />
            </label>
            <label>
              Max videos per channel
              <input
                type="number"
                min="1"
                max="500"
                value={config.maxVideosPerChannel}
                onChange={(event) => updateConfig({ maxVideosPerChannel: Number(event.target.value) })}
              />
            </label>
          </div>

          <div className="section-head spaced">
            <div>
              <h2>Add channel from YouTube</h2>
              <p className="section-note">Paste a channel URL, @handle, UC channel ID, legacy user URL, or search text.</p>
            </div>
          </div>
          <div className="resolver">
            <label>
              YouTube Data API key
              <input
                type="password"
                value={apiKey}
                onChange={(event) => saveApiKey(event.target.value)}
                placeholder="Stored in this browser only"
              />
            </label>
            <label>
              Public channel input
              <input
                value={channelInput}
                onChange={(event) => setChannelInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    resolveChannel();
                  }
                }}
                placeholder="https://www.youtube.com/@GothamChess"
              />
            </label>
            <button type="button" className="primary" onClick={resolveChannel} disabled={isResolving}>
              {isResolving ? "Resolving..." : "Find channel"}
            </button>
          </div>
          <p className="helper-text">{resolverStatus}</p>
          {resolverResults.length > 0 && (
            <div className="candidate-list">
              {resolverResults.map((candidate) => {
                const exists = channelIdSet.has(candidate.channelId);
                return (
                  <article className="candidate-card" key={candidate.channelId}>
                    <img src={candidate.thumbnailUrl} alt="" />
                    <div>
                      <strong>{candidate.title || "Untitled channel"}</strong>
                      <span>{candidate.channelId}</span>
                      <p>{candidate.description}</p>
                    </div>
                    <div className="candidate-actions">
                      <a className="button ghost" href={channelUrl(candidate.channelId)} target="_blank" rel="noreferrer">
                        Test link
                      </a>
                      <button type="button" onClick={() => addResolvedChannel(candidate)} disabled={exists}>
                        {exists ? "Already added" : "Add enabled"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="section-head spaced">
            <h2>Channels</h2>
            <button type="button" onClick={addChannel}>
              Add channel
            </button>
          </div>
          <div className="channel-list">
            {config.channels.map((channel, index) => (
              <article className="channel-row" key={`${channel.channelId}-${index}`}>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={channel.enabled}
                    onChange={(event) => updateChannel(index, { enabled: event.target.checked })}
                  />
                  Enabled
                </label>
                <label>
                  Title
                  <input
                    value={channel.title}
                    onChange={(event) => updateChannel(index, { title: event.target.value })}
                  />
                </label>
                <label>
                  Channel ID
                  <input
                    value={channel.channelId}
                    onChange={(event) => updateChannel(index, { channelId: event.target.value.trim() })}
                    placeholder="UC..."
                  />
                </label>
                <div className="row-actions">
                  <a className="button ghost" href={channelUrl(channel.channelId)} target="_blank" rel="noreferrer">
                    Test
                  </a>
                  <button type="button" onClick={() => moveChannel(index, -1)} disabled={index === 0}>
                    Up
                  </button>
                  <button type="button" onClick={() => moveChannel(index, 1)} disabled={index === config.channels.length - 1}>
                    Down
                  </button>
                  <button type="button" className="danger" onClick={() => removeChannel(index)}>
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="panel">
          <div className="section-head">
            <h2>Video rules</h2>
          </div>
          <label>
            Blocked video IDs
            <textarea
              value={config.blockedVideoIds.join("\n")}
              onChange={(event) => updateConfig({ blockedVideoIds: splitVideoIds(event.target.value) })}
              placeholder="One YouTube video ID per line"
            />
          </label>
          <label>
            Pinned video IDs
            <textarea
              value={config.pinnedVideoIds.join("\n")}
              onChange={(event) => updateConfig({ pinnedVideoIds: splitVideoIds(event.target.value) })}
              placeholder="One YouTube video ID per line"
            />
          </label>

          <div className="section-head spaced">
            <h2>Import / JSON</h2>
            <label className="file-button">
              Import file
              <input type="file" accept="application/json,.json" onChange={importFile} />
            </label>
          </div>
          <textarea
            className="json-editor"
            value={jsonDraft}
            onChange={(event) => setJsonDraft(event.target.value)}
            spellCheck="false"
          />
          <button type="button" className="wide" onClick={applyJsonDraft}>
            Apply JSON editor
          </button>
        </aside>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
