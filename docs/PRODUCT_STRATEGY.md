# Product Strategy

Youtube Beta is a calmer, parent-curated YouTube experience for a child. The
strategic idea is not to compete with YouTube, but to narrow YouTube into a
trusted viewing surface controlled by a parent.

## Vision

Give families a simple way to allow beneficial video content without exposing the
child to search, comments, infinite recommendations, open browsing, or account
features.

## Product Philosophy

- Parent control over child autonomy for content discovery.
- Calm browsing over engagement optimization.
- Explicit approval over algorithmic exploration.
- Small trusted surface over feature breadth.
- Platform compliance over clever workarounds.
- Local-first simplicity until a backend is truly needed.

## Current Product

The current app is:

- Windows WPF
- WebView2 based
- powered by remote JSON config
- using YouTube Data API for metadata
- using the official YouTube iframe player for playback
- supported by a browser preview for development

## Future Possibilities

Potential future directions:

- parent admin dashboard
- hosted config management
- channel review workflow
- TV-first navigation model
- mobile companion admin app
- cross-platform child viewer
- parent-approved AI curation assistant
- family profiles and age bands
- audit trail for config changes
- quota-aware YouTube API backend

These are roadmap ideas, not current implementation requirements.

## Monetization Possibilities

Possible long-term models:

- paid family subscription
- one-time license for local app
- hosted parent dashboard
- premium AI-assisted curation
- school or small-group deployment

Monetization should not compromise child privacy, safety, YouTube compliance, or
the no-dark-pattern product philosophy.

## Strategic Risks

- YouTube platform policy changes.
- YouTube API quota limits.
- Embedded playback limitations.
- Related videos cannot be fully disabled.
- Device-level bypass through other browsers or apps.
- Overbuilding backend infrastructure before product behavior is validated.
- AI features that accidentally become child-facing recommendations.

## Execution Principle

When in doubt, improve the current safe viewer before building a broader
platform.
