# Chromium Sync MCP Server

An MCP server that connects to Chromium-based browser sync services (starting with Brave Sync v2), enabling Claude Code to read open tabs, search browsing history, and manage bookmarks across all devices in your sync chain.

## Quick Start

1. Set your Brave sync phrase:
   ```bash
   export CHROMIUM_SYNC_SEED="your twelve word brave sync phrase here"
   ```

2. Add to Claude Code's MCP config:
   ```json
   {
     "mcpServers": {
       "chromium-sync": {
         "command": "uv",
         "args": ["run", "--directory", "/path/to/chromium-sync", "chromium-sync"],
         "env": {
           "CHROMIUM_SYNC_SEED": "your twelve word brave sync phrase here"
         }
       }
     }
   }
   ```

## Available Tools

- `brave_sync_tabs` - List open tabs from all synced devices
- `brave_sync_history` - Search browsing history with optional text query and date filtering
- `brave_sync_bookmarks` - List bookmarks, optionally filtered by folder
- `brave_sync_search_bookmarks` - Search bookmarks by title or URL

## Environment Variables

- `CHROMIUM_SYNC_SEED` (required): Your Brave sync phrase (12 or 24 BIP39 words)
- `CHROMIUM_SYNC_CACHE_PATH`: Path to SQLite cache (default: `~/.cache/chromium-sync/cache.db`)
- `CHROMIUM_SYNC_SERVER`: Sync server URL (default: `https://sync-v2.brave.com/v2`)

## Development

```bash
# Install dependencies
uv sync

# Run the server
uv run chromium-sync

# Run tests
uv run pytest
```
