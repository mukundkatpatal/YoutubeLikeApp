# Product Guardrails

Youtube Beta exists to make YouTube narrower, calmer, and parent-controlled for a
child. These guardrails should shape all product and engineering decisions.

## Must Preserve

- Parent-approved content sources.
- No child-facing search.
- No child-facing sign-in.
- Parent-issued child pairing tokens are allowed for device/app setup; child
  Google login is not part of the MVP safety model.
- No open web browsing.
- No comments, uploads, subscriptions, or algorithmic YouTube home feed.
- Remote parent-controlled config.
- Playback only for approved or explicitly pinned videos.
- Clear behavior when config is missing, invalid, or stale.
- Respect for official YouTube player and API requirements.

## Explicit Non-Goals

- Full device lockdown.
- A replacement for Windows Family Safety, Qustodio, router filtering, or child
  Windows account restrictions.
- A general YouTube client.
- A hidden browser.
- A downloader or ad-removal tool.
- A way to bypass YouTube controls, policy, branding, or terms.

## Risky Changes

Require explicit human approval before making changes that:

- add search, recommendations, browse pages, or external links
- add child Google sign-in or child-controlled user accounts
- add local admin/config UI inside the child app
- loosen WebView2 navigation restrictions
- allow arbitrary video IDs from URLs, query strings, clipboard, or user input
- change YouTube API usage patterns in a way that may affect quota or compliance
- introduce server-side storage of child viewing behavior
- monetize, track, profile, or personalize child behavior

## YouTube Platform Constraints

The app should use:

- YouTube Data API for metadata
- official YouTube iframe player for playback
- normal YouTube player controls and branding

The app should not:

- scrape YouTube pages
- download or proxy videos
- remove ads
- hide YouTube branding
- cover required player controls
- misrepresent YouTube content ownership

## AI Feature Constraint

AI should assist the parent, not independently curate for the child.

Good AI use cases:

- summarize channel risk for a parent
- suggest tags and age ranges
- detect config mistakes
- propose videos to block or pin
- explain why a video may be unsuitable
- generate a draft config change for parent approval

Avoid:

- autonomous child-facing recommendations
- opaque scoring that decides what the child sees
- personalization based on sensitive child profiling
- direct AI chat with the child unless separately designed and reviewed
