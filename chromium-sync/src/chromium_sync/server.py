"""MCP server for Chromium Sync.

Exposes sync data (tabs, history, bookmarks) as MCP tools for Claude Code.
"""

import asyncio
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from .auth import create_credentials
from .cache import SyncCache
from .client import SyncClient, SyncError, Bookmark, Device, HistoryEntry


# Cache TTL - how long before we refresh from server
CACHE_TTL_MINUTES = 5


def get_env_config() -> dict[str, Any]:
    """Get configuration from environment variables."""
    seed_phrase = os.environ.get("CHROMIUM_SYNC_SEED")
    if not seed_phrase:
        raise ValueError("CHROMIUM_SYNC_SEED environment variable is required")

    return {
        "seed_phrase": seed_phrase,
        "cache_path": os.environ.get("CHROMIUM_SYNC_CACHE_PATH"),
        "server_url": os.environ.get(
            "CHROMIUM_SYNC_SERVER", "https://sync-v2.brave.com/v2"
        ),
    }


class ChromiumSyncServer:
    """MCP server wrapping the sync client and cache."""

    def __init__(self, config: dict[str, Any]):
        self.config = config
        self.cache = SyncCache(config.get("cache_path"))
        self.client: SyncClient | None = None
        self._initialized = False

    async def initialize(self):
        """Initialize cache and sync client."""
        if self._initialized:
            return

        await self.cache.initialize()

        credentials = create_credentials(self.config["seed_phrase"])
        self.client = SyncClient(
            credentials=credentials,
            server_url=self.config["server_url"],
        )

        # Initialize encryption
        try:
            await self.client.initialize_encryption(self.config["seed_phrase"])
        except SyncError:
            # May fail if server is unreachable; we'll use cache
            pass

        self._initialized = True

    async def close(self):
        """Clean up resources."""
        if self.client:
            await self.client.close()
        await self.cache.close()

    def _is_cache_stale(self, last_sync: datetime | None) -> bool:
        """Check if the cache needs refreshing."""
        if not last_sync:
            return True
        return datetime.now() - last_sync > timedelta(minutes=CACHE_TTL_MINUTES)

    async def get_tabs(self) -> list[Device]:
        """Get open tabs from all devices."""
        last_sync = await self.cache.get_last_sync_time()
        use_cache = not self._is_cache_stale(last_sync)

        if not use_cache and self.client:
            try:
                devices = await self.client.fetch_sessions()
                await self.cache.save_devices(devices)
                return devices
            except SyncError:
                # Fall back to cache
                pass

        return await self.cache.get_devices()

    async def get_history(
        self,
        query: str | None = None,
        limit: int = 100,
        days_back: int | None = None,
    ) -> list[HistoryEntry]:
        """Get browsing history with optional search."""
        last_sync = await self.cache.get_last_sync_time()
        use_cache = not self._is_cache_stale(last_sync)

        if not use_cache and self.client:
            try:
                history = await self.client.fetch_history()
                await self.cache.save_history(history)
            except SyncError:
                # Fall back to cache
                pass

        return await self.cache.get_history(query=query, limit=limit, days_back=days_back)

    async def get_bookmarks(self, folder_id: str | None = None) -> list[Bookmark]:
        """Get bookmarks, optionally filtered by folder."""
        last_sync = await self.cache.get_last_sync_time()
        use_cache = not self._is_cache_stale(last_sync)

        if not use_cache and self.client:
            try:
                bookmarks = await self.client.fetch_bookmarks()
                await self.cache.save_bookmarks(bookmarks)
                return bookmarks
            except SyncError:
                # Fall back to cache
                pass

        return await self.cache.get_bookmarks(folder_id=folder_id)

    async def search_bookmarks(self, query: str) -> list[Bookmark]:
        """Search bookmarks by title or URL."""
        # Ensure cache is populated
        await self.get_bookmarks()
        return await self.cache.search_bookmarks(query)


# Create the MCP server
app = Server("chromium-sync")

# Global server instance
_sync_server: ChromiumSyncServer | None = None


async def get_sync_server() -> ChromiumSyncServer:
    """Get or create the sync server instance."""
    global _sync_server
    if _sync_server is None:
        config = get_env_config()
        _sync_server = ChromiumSyncServer(config)
        await _sync_server.initialize()
    return _sync_server


@app.list_tools()
async def list_tools() -> list[Tool]:
    """List available sync tools."""
    return [
        Tool(
            name="brave_sync_tabs",
            description="Get open tabs from all synced devices. Returns a list of devices with their open tabs.",
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        Tool(
            name="brave_sync_history",
            description="Search browsing history across all synced devices. Supports text search and date filtering.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Text to search for in URLs and titles. Optional.",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of results to return. Default 100.",
                        "default": 100,
                    },
                    "days_back": {
                        "type": "integer",
                        "description": "Only return history from the last N days. Optional.",
                    },
                },
            },
        ),
        Tool(
            name="brave_sync_bookmarks",
            description="Get bookmarks from sync. Optionally filter by parent folder ID.",
            inputSchema={
                "type": "object",
                "properties": {
                    "folder": {
                        "type": "string",
                        "description": "Parent folder ID to filter by. Optional - returns all bookmarks if not specified.",
                    },
                },
            },
        ),
        Tool(
            name="brave_sync_search_bookmarks",
            description="Search bookmarks by title or URL.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Text to search for in bookmark titles and URLs.",
                    },
                },
                "required": ["query"],
            },
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    """Handle tool calls."""
    server = await get_sync_server()

    if name == "brave_sync_tabs":
        devices = await server.get_tabs()
        result = format_devices(devices)
        return [TextContent(type="text", text=result)]

    elif name == "brave_sync_history":
        query = arguments.get("query")
        limit = arguments.get("limit", 100)
        days_back = arguments.get("days_back")
        history = await server.get_history(query=query, limit=limit, days_back=days_back)
        result = format_history(history)
        return [TextContent(type="text", text=result)]

    elif name == "brave_sync_bookmarks":
        folder = arguments.get("folder")
        bookmarks = await server.get_bookmarks(folder_id=folder)
        result = format_bookmarks(bookmarks)
        return [TextContent(type="text", text=result)]

    elif name == "brave_sync_search_bookmarks":
        query = arguments.get("query", "")
        bookmarks = await server.search_bookmarks(query)
        result = format_bookmarks(bookmarks)
        return [TextContent(type="text", text=result)]

    else:
        return [TextContent(type="text", text=f"Unknown tool: {name}")]


def format_devices(devices: list[Device]) -> str:
    """Format devices and tabs for display."""
    if not devices:
        return "No devices with open tabs found."

    lines = []
    for device in devices:
        lines.append(f"\n## {device.name}")
        if not device.tabs:
            lines.append("  No open tabs")
        else:
            for tab in device.tabs:
                time_str = tab.last_active.strftime("%Y-%m-%d %H:%M") if tab.last_active else "unknown"
                lines.append(f"  - [{tab.title}]({tab.url}) (last active: {time_str})")

    return "\n".join(lines)


def format_history(history: list[HistoryEntry]) -> str:
    """Format history entries for display."""
    if not history:
        return "No history entries found."

    lines = [f"Found {len(history)} history entries:\n"]
    for entry in history:
        time_str = entry.visit_time.strftime("%Y-%m-%d %H:%M")
        visits = f" ({entry.visit_count} visits)" if entry.visit_count > 1 else ""
        lines.append(f"- [{entry.title}]({entry.url}) - {time_str}{visits}")

    return "\n".join(lines)


def format_bookmarks(bookmarks: list[Bookmark]) -> str:
    """Format bookmarks for display."""
    if not bookmarks:
        return "No bookmarks found."

    lines = [f"Found {len(bookmarks)} bookmarks:\n"]
    for bookmark in bookmarks:
        if bookmark.is_folder:
            lines.append(f"- 📁 {bookmark.title} (id: {bookmark.id})")
        else:
            lines.append(f"- [{bookmark.title}]({bookmark.url})")

    return "\n".join(lines)


async def run_server():
    """Run the MCP server."""
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())


def main():
    """Entry point for the MCP server."""
    try:
        asyncio.run(run_server())
    except KeyboardInterrupt:
        pass
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
