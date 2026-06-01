# Decisions

Use this file to record important product and technical decisions. Keep entries
short. Add dates when a decision is made or changed.

## Current Decisions

### 2026-06-01: Root Agent Instructions

The repository uses `AGENTS.md` as the primary instruction file for AI coding
agents. Product strategy docs provide context, but `AGENTS.md` contains the
operational rules agents should follow when editing code.

### 2026-06-01: Parent-Controlled Curation

The child app should not include search, sign-in, open browsing, or local admin
configuration. Parent-controlled remote config remains the source of truth.

### 2026-06-01: AI Assists Parents First

Future AI features should help parents review, classify, and approve content.
They should not autonomously recommend content directly to the child.

### 2026-06-01: Official YouTube Playback

Playback should continue to use the official YouTube iframe player through
WebView2. The app should not scrape, download, proxy, hide required controls, or
remove ads.

## Template

### YYYY-MM-DD: Decision Title

Decision:

Rationale:

Consequences:
