# Changelog

## [0.30.0] - 2026-01-09

### Added
- QR code display for auth token (scan to authenticate other devices)
- Token input UI for initial authentication when auth is enabled
- Token stored in sessionStorage for subsequent API calls
- qrcode.js library for QR code generation

## [0.29.0] - 2026-01-09

### Changed
- Permission modal now full-screen on mobile devices
- Modal uses flexbox layout for better content distribution
- Buttons anchored to bottom of modal on mobile

## [0.28.0] - 2026-01-09

### Added
- Last message preview in session sidebar
- Shows truncated preview (60 chars) of most recent message
- Preview included in API session list response (`lastMessagePreview` field)

## [0.27.0] - 2026-01-09

### Added
- Clear session messages via 🗑 button in session header
- Confirmation dialog before clearing
- API endpoint: `POST /api/sessions/:id/clear`
- WebSocket event broadcasts to sync across clients

## [0.26.0] - 2026-01-09

### Added
- Auto-archive inactive sessions via `AUTO_ARCHIVE_HOURS` environment variable
- Sessions inactive longer than threshold automatically move to archived section
- Running sessions are never auto-archived
- Periodic check runs at configurable intervals (max every hour)

## [0.25.0] - 2026-01-09

### Added
- Archive/unarchive sessions via sidebar buttons
- Archived sessions displayed in separate section at bottom of sidebar
- Archive state persisted to disk

## [0.24.0] - 2026-01-09

### Added
- Permission timeout configuration in config panel
- Options: wait forever (default), 1 min, 5 min, 10 min, 30 min
- Timeout stored per-session and honored by permission handler

## [0.23.0] - 2026-01-09

### Added
- System prompt configuration in config panel
- System prompt persisted per-session and passed to Claude Agent SDK
- Session config lazily loaded when switching sessions

## [0.22.0] - 2026-01-09

### Changed
- Search now bypasses virtual scroll to find all matching messages
- Hidden messages become visible during active search
- Virtual scroll restored when search is closed

## [0.21.0] - 2026-01-09

### Added
- Virtual scroll for long sessions (100+ messages)
- "Load more" banner shows count of hidden older messages
- Click to load 50 more messages at a time
- Improves performance for sessions with 1000+ messages

## [0.20.0] - 2026-01-09

### Added
- Auth token management UI in config panel
- Show/hide token with confirmation dialog
- Copy token to clipboard
- Regenerate token button with confirmation
- Auth section only visible when AUTH=true enabled

### Fixed
- UI now loads gracefully when auth fails (shows empty state)

## [0.19.0] - 2026-01-09

### Changed
- Permission modal now uses tiered disclosure
- Summary shows first ~100 chars of tool input
- "View full input" expands to show complete JSON

## [0.18.0] - 2026-01-09

### Added
- Message count displayed in session list sidebar

## [0.17.0] - 2026-01-09

### Added
- Optional auth token system for remote access
- Enable with `AUTH=true` environment variable
- Token auto-generated and stored in `.clarvis/auth-token`
- Protects API and WebSocket connections when enabled

## [0.16.0] - 2026-01-09

### Added
- Search messages functionality via 🔍 button in header
- Filters messages to show only matches
- Highlights matching text in yellow
- Shows match count
- Close with ✕ button or Escape key

## [0.15.0] - 2026-01-09

### Added
- Delete session button (appears on hover in sidebar)
- Confirmation dialog before deletion
- Session deletion removes from disk and UI

## [0.14.0] - 2026-01-09

### Added
- Auto-fetch missed messages on WebSocket reconnect
- Shows success toast when messages are recovered
- Syncs session status on reconnect

## [0.13.0] - 2026-01-09

### Added
- Error retry panel with Retry and Dismiss buttons
- Shows error message above input when session errors occur
- Retry resends the last prompt

## [0.12.0] - 2026-01-09

### Added
- Session renaming via inline edit in header
- Click session title to rename, Enter to save, Escape to cancel
- API endpoint: `POST /api/sessions/:id/rename`

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
