# Changelog

## [0.11.0] - 2026-01-09

### Added
- Browser notifications for permission requests, errors, and session completion
- Notifications appear when browser tab not focused
- Click notification to focus window
- Auto-dismiss after 10 seconds

## [0.10.0] - 2026-01-09

### Added
- Toast notifications for permission requests and errors
- Toasts appear in top-right corner with colored left border
- Auto-dismiss after configurable duration
- Manual dismiss via close button

## [0.9.0] - 2026-01-09

### Added
- Unread message badges on sessions in sidebar
- Badge shows count of new assistant messages
- Badge clears when session is selected

## [0.8.0] - 2026-01-09

### Added
- Activity panel with typing indicator and tool activity
- Animated dots show when assistant is generating text
- Tool activity shows current operation (e.g., "Reading file...")
- Both indicators visible simultaneously during tool use

## [0.7.0] - 2026-01-09

### Added
- Lightbox image viewer for images in assistant messages
- Click any image to view full-screen with dark backdrop
- Close with X button, clicking backdrop, or Escape key
- Images styled as thumbnails in messages

## [0.6.0] - 2026-01-09

### Added
- Prompt queue: queue prompts while session is running
- Queue panel UI above input area shows queued prompts
- Cancel buttons to remove queued prompts
- API endpoints: `GET/DELETE /api/sessions/:id/queue/:promptId`
- Queue processes automatically after current prompt completes

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
