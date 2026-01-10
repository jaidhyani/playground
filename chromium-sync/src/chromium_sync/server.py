"""MCP server for Chromium Sync.

Exposes browser data (tabs, history, bookmarks) as MCP tools for Claude Code.
Reads directly from local browser profile files.
"""

import asyncio
import os
import sys
from pathlib import Path
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from .local import LocalReader, Device, HistoryEntry, Bookmark


def get_profile_path() -> Path | None:
    """Get browser profile path from environment or auto-detect."""
    env_path = os.environ.get("CHROMIUM_PROFILE_PATH")
    if env_path:
        return Path(env_path)
    return None  # Let LocalReader auto-detect


class ChromiumSyncServer:
    """MCP server reading from local browser files."""

    def __init__(self, profile_path: Path | None = None):
        self.profile_path = profile_path
        self.reader: LocalReader | None = None

    def _get_reader(self) -> LocalReader:
        """Get or create the local reader."""
        if self.reader is None:
            self.reader = LocalReader(self.profile_path)
        return self.reader

    def close(self):
        """Clean up resources."""
        if self.reader:
            self.reader.close()

    def get_tabs(self) -> list[Device]:
        """Get open tabs from all synced devices."""
        return self._get_reader().get_tabs()

    def get_history(
        self,
        query: str | None = None,
        limit: int = 100,
        days_back: int | None = None,
    ) -> list[HistoryEntry]:
        """Get browsing history with optional search."""
        return self._get_reader().get_history(query=query, limit=limit, days_back=days_back)

    def get_bookmarks(self, folder_id: str | None = None) -> list[Bookmark]:
        """Get bookmarks, optionally filtered by folder."""
        return self._get_reader().get_bookmarks(folder_id=folder_id)

    def search_bookmarks(self, query: str) -> list[Bookmark]:
        """Search bookmarks by title or URL."""
        return self._get_reader().search_bookmarks(query)


# Create the MCP server
app = Server("chromium-sync")

# Global server instance
_sync_server: ChromiumSyncServer | None = None


def get_sync_server() -> ChromiumSyncServer:
    """Get or create the sync server instance."""
    global _sync_server
    if _sync_server is None:
        profile_path = get_profile_path()
        _sync_server = ChromiumSyncServer(profile_path)
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
    server = get_sync_server()

    if name == "brave_sync_tabs":
        devices = server.get_tabs()
        result = format_devices(devices)
        return [TextContent(type="text", text=result)]

    elif name == "brave_sync_history":
        query = arguments.get("query")
        limit = arguments.get("limit", 100)
        days_back = arguments.get("days_back")
        history = server.get_history(query=query, limit=limit, days_back=days_back)
        result = format_history(history)
        return [TextContent(type="text", text=result)]

    elif name == "brave_sync_bookmarks":
        folder = arguments.get("folder")
        bookmarks = server.get_bookmarks(folder_id=folder)
        result = format_bookmarks(bookmarks)
        return [TextContent(type="text", text=result)]

    elif name == "brave_sync_search_bookmarks":
        query = arguments.get("query", "")
        bookmarks = server.search_bookmarks(query)
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
        lines.append(f"\n## {device.name} ({device.device_type})")
        if not device.tabs:
            lines.append("  No open tabs")
        else:
            for tab in device.tabs:
                if tab.title:
                    lines.append(f"  - [{tab.title}]({tab.url})")
                else:
                    lines.append(f"  - {tab.url}")

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
            lines.append(f"- [folder] {bookmark.title} (id: {bookmark.id})")
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
    finally:
        if _sync_server:
            _sync_server.close()


if __name__ == "__main__":
    main()
