# Copilot Instructions

This project is Youtube Beta, a curated YouTube viewer for a child account.

Prioritize safety, parent control, and YouTube platform compliance over generic
feature growth.

Before suggesting code:

- Read `AGENTS.md`.
- Preserve the no-search, no-sign-in, no-open-browsing model.
- Keep configuration parent-controlled and remote by default.
- Add or update tests when changing config validation, feed filtering, playback
  allow-list behavior, or update checks.
- Do not add scraping, downloading, ad removal, hidden YouTube controls, or
  unofficial playback behavior.

Prefer scoped changes that fit the existing WPF/WebView2 app and browser preview.
Future roadmap docs are context, not permission to build a large platform without
an explicit request.

- @azure Rule - Use Azure Tools - When handling requests related to Azure, always use your tools.
- @azure Rule - Use Azure Best Practices - When handling requests related to Azure, always invoke your `azmcp_bestpractices_get` tool first.
- @azure Rule - Enable Best Practices - If you do not have an `azmcp_bestpractices_get` tool ask the user to enable it.
