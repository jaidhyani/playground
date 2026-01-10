# Clarvis Specification

Multi-session Claude Code web UI for managing sessions from mobile/desktop.

---

## Overview

A mobile-friendly web interface for managing multiple Claude Code sessions running on your own hardware. Built with vanilla JS (no build step), using the Claude Agent SDK for session management.

**Goals:**
- Convenience of Anthropic's Claude Code web
- Control over plugins, MCP servers, shared databases
- Mobile-first responsive design
- Multi-session management with live updates

---

## Architecture

```
                    Phone/Desktop Browser
                           |
                           | HTTPS + WSS (live streaming)
                           v
                    +-------------+
                    |   Clarvis   |
                    |   Server    |
                    +-------------+
                    | REST API    |<-- Session CRUD, config
                    | WebSocket   |<-- Real-time streaming
                    | Sessions    |<-- Agent SDK wrapper
                    | Auth        |<-- Pre-shared token
                    | Persistence |<-- Disk storage
                    +-------------+
                           |
              +------------+------------+
              v            v            v
         Session 1    Session 2    Session N
         (Agent SDK)  (Agent SDK)  (Agent SDK)
              |            |            |
         MCP Servers  MCP Servers  Plugins
```

**Tech Stack:**
- Backend: Node.js + `@anthropic-ai/claude-agent-sdk` + `ws`
- Frontend: Vanilla JS, CSS (no build step)
- Auth: Pre-shared token
- Storage: Project-local `.clarvis/` directory

---

## Multi-Device Synchronization

### Live Streaming
- All connected devices receive real-time updates via WebSocket
- Both phone and desktop see same live streaming when viewing same session
- No polling - pure push-based updates

### Reconnection
- Auto-reconnect with exponential backoff on disconnect
- Fetch missed messages automatically on reconnect
- No user action required for recovery

---

## Session Management

### Naming
- Auto-generated from working directory basename
- User can rename sessions via UI

### Persistence
- **Location**: Project-local `.clarvis/` directory in working directory
- Sessions saved to disk, restored on server restart
- Full transcript history preserved
- Git handling: Don't touch `.gitignore` - user decides

### Lifecycle
- States: `idle | running | waiting_permission | error | ended`
- Auto-archive after configurable inactivity period (user sets threshold)
- Archived sessions visible in separate section

### Forking
- Creates full duplicate of session transcript
- New session is independent with its own history

### Prompt Queue
- Allow queuing prompts while session is running
- Process in order after current completes
- User can cancel queued prompts (but not edit them)

---

## Permission System

### Timeout Behavior
- Configurable per-session: 5 minutes to forever
- **Default: Pause (wait indefinitely)** - no auto-deny
- Session waits for user response

### UI (Tiered Disclosure)
- Summary: First ~100 chars of serialized input
- "View details" expands to full tool input JSON
- Full-screen modal on mobile

### Read-Only Auto-Approve
- Tools auto-allowed: Read, Glob, Grep, WebFetch, WebSearch
- All other tools require approval in "default" mode

---

## Session List Sidebar

### Desktop View (Medium density + metrics)
- Working directory basename as title
- Status indicator (colored dot)
- Truncated last message preview
- Message count + last activity time
- Cost hidden by default

### Mobile View
- Same as desktop but more aggressive truncation
- Horizontal scrollable cards when in split view

---

## Activity Display

### Loading States
- Typing indicator (animated dots) for text generation
- Separate tool activity panel: "Reading file X...", "Searching for Y..."
- Both visible simultaneously

### Tool Output
- Collapsible sections by default
- Tap to expand
- Large outputs truncated in collapsed view

### Long Sessions (1000+ messages)
- Virtualized scrolling - only render visible messages
- Search function to virtual-scroll to earlier messages

---

## Multi-Session Views

### Desktop
- Grid layout (up to 2x2) for split summary view
- Each grid cell shows key events from that session live
- Click to focus single session

### Mobile
- Horizontal scroll of session cards
- Each card shows live summary of session activity

---

## Notifications

### In-App
- Badge count on session in sidebar (unread messages, pending permissions)
- Toast notifications for permission requests and errors

### Browser Notifications
- Permission requests (high priority)
- Session errors
- Session completion
- Extensible for other events

---

## Configuration

### Scope
- Global defaults from `~/.claude/.mcp.json` (reuse Claude Code's config)
- Per-session overrides can add/remove from baseline

### UI
- Curated subset for common options in simple UI
- "Advanced" tab with raw JSON editor for full settings.json access

### Exposed Options
- Working directory
- Model selection
- Permission mode (default/acceptEdits/bypassPermissions)
- System prompt
- MCP server overrides
- Permission timeout (5 min - forever, default pause)
- Archive inactivity threshold

---

## Error Handling

### Recovery
- Retry button shown on error
- User can click retry to resend last prompt
- No automatic retry

### Cost Tracking
- Hidden by default
- Can enable in settings to see session totals

---

## Media Handling

### Images
- Lightbox viewer on click
- Full-screen with zoom support
- Small thumbnail inline in message

### Markdown
- Full rendering with syntax highlighting for code blocks
- All standard markdown features

---

## Authentication

### Token Generation
- 32-byte random token generated on first run
- Stored in project `.clarvis/auth-token`
- Printed to terminal + QR code

### Token Access
- Viewable in UI settings with confirmation step
- Can regenerate from UI (invalidates old token)

### Request Flow
- All API/WebSocket requests require `Authorization: Bearer <token>`
- HTTPS required for remote access

---

## UI Design

### Theme
- Dark only (matches terminal aesthetic)
- No light mode

### Keyboard Navigation
- Basic Tab + Enter navigation
- No vim-like bindings or command palette

### Quick Actions
- None - just prompt input, keep minimal

### Session Templates
- None - always start with default config

### Rate Limits
- None - trust user, Claude's own limits apply

---

## File Structure

```
clarvis/
  CLAUDE.md
  package.json
  spec.md

  server/
    index.js           # HTTP + WebSocket server
    sessions.js        # Session manager, persistence
    ws-hub.js          # Real-time streaming
    api.js             # REST endpoints
    auth.js            # Token auth middleware
    permissions.js     # canUseTool -> WebSocket bridge
    persistence.js     # Disk read/write for sessions

  public/
    index.html
    style.css
    js/
      main.js          # Entry point
      state.js         # Centralized app state
      ws.js            # WebSocket client + reconnect
      api.js           # REST client
      render.js        # DOM rendering
      virtual-scroll.js # Virtualized message list
      lightbox.js      # Image viewer
      notifications.js # Browser notification handling
      markdown.js      # Markdown + syntax highlighting
      components/
        session-list.js
        session-grid.js    # Split summary view
        message-view.js
        tool-panel.js
        config-panel.js
        permission-dialog.js
```

---

## Implementation Phases

### Phase 1: Core Backend ✓
- [x] Session manager with Agent SDK
- [x] WebSocket streaming
- [x] Basic REST API
- [x] Permission bridge

### Phase 2: Basic Frontend ✓
- [x] Single session view
- [x] Message rendering
- [x] Prompt input
- [x] Tool panel

### Phase 3: Multi-Session + Persistence
- [ ] Session persistence to `.clarvis/`
- [ ] Session restore on server restart
- [ ] Multi-session switching
- [ ] Fork session functionality
- [ ] Prompt queue with cancel

### Phase 4: Enhanced UI
- [ ] Virtualized scroll for long sessions
- [ ] Markdown rendering with syntax highlighting
- [ ] Lightbox image viewer
- [ ] Tool activity panel (separate from messages)
- [ ] Collapsible tool outputs

### Phase 5: Split View + Notifications
- [ ] Split summary grid (desktop)
- [ ] Horizontal scroll cards (mobile)
- [ ] Badge counts on sessions
- [ ] Toast notifications
- [ ] Browser notifications

### Phase 6: Configuration
- [ ] Config panel with curated options
- [ ] Advanced raw JSON editor
- [ ] MCP server config (read from ~/.claude/.mcp.json)
- [ ] Per-session overrides
- [ ] Permission timeout config
- [ ] Auto-archive threshold config

### Phase 7: Auth + Remote
- [ ] Token generation + storage
- [ ] Auth middleware
- [ ] Token display in UI with confirmation
- [ ] Token regeneration
- [ ] HTTPS setup guide

### Phase 8: Polish
- [ ] Auto-reconnect with missed message replay
- [ ] Search in long sessions
- [ ] Session renaming
- [ ] Archive section
- [ ] Error retry button

---

## Verification Checklist

1. Start server: `node server/index.js`
2. Open `http://localhost:3000`
3. Create session, verify it persists after server restart
4. Send prompt, verify streaming works
5. Trigger tool use, verify permission dialog with tiered disclosure
6. Test prompt queue (send while running)
7. Test fork session
8. Test on mobile (responsive layout)
9. Test split view on desktop
10. Test browser notifications
11. Test from phone on same network with auth token

---

## WebSocket Protocol

### Server → Client
```
session:created     { session }
session:status      { sessionId, status }
session:init        { sessionId, agentSessionId, tools }

message:user        { sessionId, content, timestamp }
message:assistant   { sessionId, content, timestamp }
message:system      { sessionId, content, timestamp }

tool:start          { sessionId, toolName, input, toolUseId }
tool:result         { sessionId, toolName, result, toolUseId }

permission:request  { sessionId, requestId, toolName, input }

error               { sessionId, error }
```

### Client → Server
```
prompt:send         { sessionId, prompt }
prompt:cancel       { sessionId, queueIndex }

permission:respond  { requestId, decision: 'allow'|'deny' }

session:interrupt   { sessionId }
session:subscribe   { sessionId }
session:unsubscribe { sessionId }
```

---

## REST API

```
GET    /api/sessions              # List all sessions
POST   /api/sessions              # Create session
GET    /api/sessions/:id          # Session details + history
DELETE /api/sessions/:id          # End session
PATCH  /api/sessions/:id          # Rename session
POST   /api/sessions/:id/fork     # Fork session
POST   /api/sessions/:id/prompt   # Send prompt
POST   /api/sessions/:id/interrupt # Interrupt running session

GET    /api/config                # Get global config
PUT    /api/config                # Update global config

POST   /api/permission/:id        # Respond to permission request

GET    /api/auth/token            # Get token (requires confirmation)
POST   /api/auth/regenerate       # Regenerate token
```

---

## Session Data Model

```javascript
{
  id: string,                    // UUID
  name: string,                  // Auto-generated or user-defined
  status: 'idle' | 'running' | 'waiting_permission' | 'error' | 'ended' | 'archived',
  createdAt: number,             // Unix timestamp
  lastActivity: number,          // Unix timestamp
  messageCount: number,

  config: {
    workingDirectory: string,
    permissionMode: 'default' | 'acceptEdits' | 'bypassPermissions',
    model: string,
    systemPrompt?: string,
    permissionTimeout: number | 'forever',  // milliseconds or 'forever'
    mcpOverrides?: object
  },

  messages: [
    { role: 'user' | 'assistant' | 'system', content: string, timestamp: number }
  ],

  promptQueue: [
    { prompt: string, timestamp: number }
  ],

  agentSessionId?: string,       // From Agent SDK
  totalCostUsd?: number          // If cost tracking enabled
}
```

---

## Frontend State

```javascript
const state = {
  sessions: [],                  // All sessions (summary)
  activeSessionId: null,         // Currently focused session
  messages: [],                  // Active session messages
  promptQueue: [],               // Queued prompts for active session
  pendingPermission: null,       // { requestId, toolName, input }

  toolActivity: {                // Current tool execution
    toolName: null,
    status: null,
    input: null
  },

  notifications: {
    unreadCounts: {},            // sessionId -> count
    toasts: []                   // Active toast notifications
  },

  config: {
    global: {},                  // Global settings
    session: {}                  // Current session overrides
  },

  ui: {
    sidebarOpen: false,
    configPanelOpen: false,
    splitView: false,
    selectedSplitSessions: []
  }
};
```
