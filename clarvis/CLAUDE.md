# Clarvis

Multi-session Claude Code web UI for managing sessions from mobile/desktop.

## Quick Start

```bash
npm install
npm start        # Production
npm run dev      # Development with auto-reload
```

Open http://localhost:3000

## Architecture

- **server/**: Node.js backend with Agent SDK, WebSocket, REST API
- **public/**: Vanilla JS frontend (no build step)

Key files:
- `server/sessions.js` - Wraps Agent SDK, manages session lifecycle
- `server/ws-hub.js` - Real-time streaming to clients
- `server/permissions.js` - Bridges canUseTool to WebSocket

## Development Notes

- Uses ES modules (`"type": "module"` in package.json)
- No build step - edit and refresh
- WebSocket on same port as HTTP server
- Session state in memory, transcripts on disk
