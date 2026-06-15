# Product Requirements

This document describes the product the codebase is trying to support. It is a
living document and should be updated when product scope changes.

## Users

Parent:

- chooses approved channels
- blocks specific videos
- pins specific videos
- controls API keys and remote config
- signs in to the hosted admin app with Google
- creates child profiles and install links
- installs updates
- decides whether future AI suggestions are accepted

Child:

- watches approved videos
- chooses from approved channels and videos
- cannot search, sign in, configure, browse freely, or administer the app

## Current Requirements

- Load parent-controlled remote config.
- Load local parent-controlled settings from the documented production settings
  file, executable-adjacent local settings, or environment variables.
- Validate config before using it.
- Cache the last valid config for offline or invalid-config fallback.
- Load approved channels through the YouTube Data API.
- Show videos from enabled channels.
- Hide blocked videos.
- Put pinned videos first.
- Allow pinned videos even when not from an enabled channel, if the parent chose
  them explicitly.
- Play videos through the official YouTube iframe player.
- Stop playback if the player reports an unapproved video ID.
- Block WebView2 navigation outside the local player surface.
- Check a remote update manifest and block browsing when an update is required.
- Provide a browser preview for development checks.
- Provide a hosted parent admin app for approved-channel management.
- Let parents create child profiles, disable child access, rotate child access
  tokens, and copy child PWA install links.

## Permission Model

Parent-controlled:

- channel allow-list
- blocked videos
- pinned videos
- API key
- config URL
- update manifest URL
- future AI curation approvals
- production settings file
- child profiles
- child install links
- child access token rotation

Child-allowed:

- view approved channels
- view approved videos
- play approved videos
- move between home, channel, and video list states
- use a parent-issued pairing token stored by the child app

Child-disallowed:

- search
- sign in
- sign in with Google
- open external links
- edit settings
- add channels
- approve videos
- view raw config
- enter arbitrary video IDs or URLs

## Event Flows

Startup:

1. Load settings.
2. Check update manifest.
3. If update is required, block browsing and show update action.
4. Initialize WebView2 player.
5. Load remote config, falling back to cached config if needed.
6. Load approved channels and feed.

Refresh:

1. Stop current playback.
2. Reload config.
3. Load channels and videos.
4. Apply feed policy.
5. Update allowed playback IDs.

Video selection:

1. Set selected video.
2. Set allowed video IDs from current list.
3. Navigate WebView2 to local player URL for the selected video.
4. Stop playback if the player reports any unapproved video ID.

Config failure:

1. Reject invalid remote config.
2. Use last valid cached config when available.
3. Show a clear status message when no usable config exists.

Child pairing:

1. Parent signs into the admin app.
2. Parent creates a child profile.
3. Admin app returns an install link containing a one-time-copy child token.
4. Parent opens the install link on the child device.
5. Child app stores the token locally and uses it to fetch that family's
   approved channels and videos.
6. Parent can disable the profile or rotate the token to revoke old access.

## Future PRD Questions

Before building a backend, mobile app, TV app, or AI recommendation engine, define:

- hosted vs local config ownership
- account and authentication model for parents
- child data retention policy
- approval workflow
- audit log requirements
- API quota and caching strategy
- TV remote navigation behavior
- offline behavior
- support and update model
