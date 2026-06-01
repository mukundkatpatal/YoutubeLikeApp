import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import defaultConfig from "../../../config/config.github.json";
import "./styles.css";

const rawConfigUrl = "https://raw.githubusercontent.com/mukundkatpatal/son-youtube-config/main/config.json";
const githubEditUrl = "https://github.com/mukundkatpatal/son-youtube-config/edit/main/config.json";

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

  if (config.maxVideosPerChannel < 1 || config.maxVideosPerChannel > 200) {
    errors.push("Max videos per channel must be between 1 and 200.");
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

function App() {
  const [config, setConfig] = useState(() => normalizeConfig(defaultConfig));
  const [jsonDraft, setJsonDraft] = useState(() => formatConfig(normalizeConfig(defaultConfig)));
  const [message, setMessage] = useState("Loaded downloaded GitHub config.");
  const errors = useMemo(() => validateConfig(config), [config]);
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
                max="200"
                value={config.maxVideosPerChannel}
                onChange={(event) => updateConfig({ maxVideosPerChannel: Number(event.target.value) })}
              />
            </label>
          </div>

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
