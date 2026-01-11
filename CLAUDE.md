# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

A low-friction playground for experimenting with random projects. Each subdirectory is an independent project.

## Projects

### claude-code-game
An incremental/idle game where you play as an engineer at Anthropic working on Claude Code. Vanilla JS with no build step.

```bash
cd claude-code-game
npm test           # Run all tests (vitest + jsdom)
npm run test:watch # Watch mode
```

Has its own `CLAUDE.md` with project-specific guidance. Key docs in `dev/` folder.

### tab-overview-extension
Chrome extension providing Safari-style grid/list view of open tabs. Load directly in Chrome via `chrome://extensions` (no build step).

### imagine
Claude plugin for image generation via Google Gemini. Requires `GEMINI_API_KEY` env var.

```bash
cd imagine/scripts
uv run generate.py --prompt "description" --aspect 16:9 --size 2K
```

### clarvis
Web UI for the Claude Agent SDK. Multi-session Claude Code management with mobile-friendly design. Preact + htm frontend, no build step.

```bash
cd clarvis
./start.sh    # Start server (loads .env, opens at localhost:3000)
npm run dev   # Start with --watch
npm test      # Run tests
```

## Architecture Notes

- **claude-code-game**: Modular ES modules (state.js, render.js, etc.), tech tree as DAG, localStorage persistence, tick-based game loop
- **tab-overview-extension**: Manifest v3, service worker pattern, message-based communication between background.js and overview.js
- **imagine**: Single Python script with PEP 723 metadata, designed as Claude Code plugin
- **clarvis**: Node.js WebSocket server bridging to Claude Agent SDK, Preact + htm frontend with no build step, session state managed by SDK
