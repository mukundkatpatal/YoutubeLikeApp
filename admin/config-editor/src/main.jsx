import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import defaultConfig from "./default-config.json";
import "./styles.css";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

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

function validateConfig(config) {
  const errors = [];

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

  return errors;
}

function looksLikeChannelId(value) {
  return /^UC[A-Za-z0-9_-]{20,30}$/.test(value);
}

function channelUrl(channelId) {
  return looksLikeChannelId(channelId)
    ? `https://www.youtube.com/channel/${encodeURIComponent(channelId)}`
    : "https://www.youtube.com/";
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
    return { kind: "search", value: trimmed.replace(/^@/, "") };
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
      return { kind: "search", value: pathParts[0].replace(/^@/, "") };
    }

    if (userIndex >= 0 && pathParts[userIndex + 1]) {
      return { kind: "search", value: pathParts[userIndex + 1] };
    }

    if (customIndex >= 0 && pathParts[customIndex + 1]) {
      return { kind: "search", value: pathParts[customIndex + 1].replace(/-/g, " ") };
    }
  } catch {
    // Plain text falls through to search.
  }

  return { kind: "search", value: trimmed.replace(/^@/, "") };
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(data?.error || `API returned ${response.status}.`);
    error.status = response.status;
    throw error;
  }

  return data;
}

function LoginScreen({ status }) {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">Parent YouTube Admin</p>
        <h1>Parent sign-in</h1>
        <p className="auth-copy">
          Sign in with the parent Google account allowed for this app.
        </p>
        {status && <p className="helper-text">{status}</p>}
        <button type="button" className="primary" onClick={() => (window.location.href = `${apiBaseUrl}/auth/google`)}>
          Sign in with Google
        </button>
      </section>
    </main>
  );
}

function LoadingScreen() {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">Parent YouTube Admin</p>
        <h1>Loading</h1>
        <p className="auth-copy">Checking your parent session and loading approved channels.</p>
      </section>
    </main>
  );
}

function App() {
  const [parent, setParent] = useState(null);
  const [authStatus, setAuthStatus] = useState("");
  const [isBooting, setIsBooting] = useState(true);
  const [config, setConfig] = useState(() => normalizeConfig(defaultConfig));
  const [message, setMessage] = useState("Loading approved channels...");
  const [isSaving, setIsSaving] = useState(false);
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

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const me = await apiFetch("/me");
        if (cancelled) {
          return;
        }
        setParent(me.parent);
        const loaded = normalizeConfig(await apiFetch("/admin/config"));
        if (cancelled) {
          return;
        }
        setConfig(loaded);
        setMessage("Loaded approved channels.");
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (error.status === 401) {
          setAuthStatus("You are not signed in.");
        } else {
          setAuthStatus(error.message);
        }
        setParent(null);
      } finally {
        if (!cancelled) {
          setIsBooting(false);
        }
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateConfig(patch) {
    setConfig((current) => {
      return { ...current, ...patch };
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

  async function resolveChannel() {
    const parsed = parseChannelInput(channelInput);
    if (parsed.kind === "empty") {
      setResolverStatus("Paste a YouTube channel URL, @handle, channel ID, or search text.");
      setResolverResults([]);
      return;
    }

    setIsResolving(true);
    setResolverStatus("Resolving channel through API...");
    setResolverResults([]);

    try {
      if (parsed.kind === "id") {
        setResolverResults([{ channelId: parsed.value, title: parsed.value, thumbnailUrl: "", source: "manual" }]);
        setResolverStatus("Review the channel ID before adding it.");
        return;
      }

      const data = await apiFetch(`/admin/youtube/channels/search?q=${encodeURIComponent(parsed.value)}`);
      const results = data.items || [];
      setResolverResults(results);
      setResolverStatus(results.length === 0 ? "No channels found." : "Choose the correct channel from the search results.");
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
      setResolverStatus(`${candidate.title || candidate.channelId} is already approved.`);
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

  async function saveConfig() {
    if (errors.length > 0) {
      setMessage("Fix validation issues before saving.");
      return;
    }

    setIsSaving(true);
    try {
      const saved = normalizeConfig(
        await apiFetch("/admin/config", {
          method: "PUT",
          body: formatConfig({
            ...config,
            updatedAt: new Date().toISOString()
          })
        })
      );
      setConfig(saved);
      setMessage("Saved approved channels.");
    } catch (error) {
      setMessage(`Save failed: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => null);
    setParent(null);
    setAuthStatus("You have signed out.");
  }

  if (isBooting) {
    return <LoadingScreen />;
  }

  if (!parent) {
    return <LoginScreen status={authStatus} />;
  }

  return (
    <main>
      <header className="topbar">
        <div>
          <p className="eyebrow">Parent YouTube Admin</p>
          <h1>Approved channels</h1>
          <p className="signed-in">Signed in as {parent.email}</p>
        </div>
        <div className="actions">
          <button type="button" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <section className="save-bar">
        <div>
          <strong>{errors.length === 0 ? "Ready to save" : `${errors.length} issue(s) to fix`}</strong>
          <span>{message}</span>
        </div>
        <button type="button" className="primary" onClick={saveConfig} disabled={isSaving || errors.length > 0}>
          {isSaving && <span className="spinner" aria-hidden="true" />}
          {isSaving ? "Saving..." : "Save changes"}
        </button>
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
            <div>
              <h2>Add a channel</h2>
              <p className="section-note">Paste a channel URL, @handle, channel ID, or search text.</p>
            </div>
          </div>
          <div className="resolver api-resolver">
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
                    {candidate.thumbnailUrl ? <img src={candidate.thumbnailUrl} alt="" /> : <div className="avatar-fallback" />}
                    <div>
                      <strong>{candidate.title || "Untitled channel"}</strong>
                      <span>{candidate.channelId}</span>
                      {candidate.description && <p>{candidate.description}</p>}
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
            <div>
              <h2>Channels</h2>
              <p className="section-note">{config.channels.length} total, {enabledCount} enabled</p>
            </div>
            <button type="button" onClick={addChannel}>Add channel</button>
          </div>
          <div className="channel-list">
            {config.channels.map((channel, index) => (
              <article className={`channel-row${channel.enabled ? "" : " disabled-channel"}`} key={`${channel.channelId}-${index}`}>
                <label className="switch" title={channel.enabled ? "Allowed in the child app" : "Hidden from the child app"}>
                  <input
                    type="checkbox"
                    checked={channel.enabled}
                    onChange={(event) => updateChannel(index, { enabled: event.target.checked })}
                    aria-label={`${channel.enabled ? "Hide" : "Allow"} ${channel.title || "channel"}`}
                  />
                  <span aria-hidden="true" />
                </label>
                <label className="channel-title-field">
                  Channel name
                  <input
                    value={channel.title}
                    onChange={(event) => updateChannel(index, { title: event.target.value })}
                  />
                </label>
                <div className="channel-meta">
                  <span>{channel.channelId}</span>
                  <strong>{channel.enabled ? "Allowed" : "Hidden"}</strong>
                </div>
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
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
