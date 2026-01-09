# Changelog

## [0.5.0] - 2026-01-09

### Added
- Fork session functionality via API (`POST /api/sessions/:id/fork`)
- Fork button in session header (⎇)
- Forked sessions named "original (fork)"

### Changed
- Session list and header now display session name instead of path

## [0.4.0] - 2026-01-09

### Added
- Collapsible tool output panel with smooth animation
- Click tool header to expand/collapse output
- Chevron icon rotates to indicate collapsed state

## [0.3.0] - 2026-01-09

### Added
- Markdown rendering for assistant messages using marked.js
- Syntax highlighting for code blocks using highlight.js (github-dark theme)
- CSS styling for markdown elements (headings, lists, blockquotes, code, links)
- New `markdown.js` module for rendering

## [0.2.0] - 2026-01-09

### Added
- Session persistence to project-local `.clarvis/` directory
- Sessions automatically saved on creation, after prompts, and on errors
- Sessions restored on server restart
- Session name auto-generated from working directory basename
- New `persistence.js` module for disk read/write operations

### Changed
- `createSession`, `deleteSession` now async (return promises)
- Sessions include `name` field in API responses
- User messages saved to disk via `addUserMessage` function

## [0.1.0] - 2026-01-09

### Added
- Initial Clarvis implementation
- Multi-session Claude Code web UI
- Real-time WebSocket streaming
- REST API for session management
- Permission request bridge (canUseTool → WebSocket)
- Mobile-responsive dark theme UI
- Session list sidebar
- Tool execution panel
- Permission approval modal
