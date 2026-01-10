"""SQLite cache layer for Chromium Sync data.

Provides local caching of sync data for:
- Offline access when sync server is unreachable
- Faster repeated queries
- History search functionality
"""

import json
import os
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Any

import aiosqlite

from .client import Bookmark, Device, Tab, HistoryEntry


DEFAULT_CACHE_PATH = Path.home() / ".cache" / "chromium-sync" / "cache.db"


class SyncCache:
    """SQLite-based cache for sync data."""

    def __init__(self, db_path: Path | str | None = None):
        self.db_path = Path(db_path) if db_path else DEFAULT_CACHE_PATH
        self._conn: aiosqlite.Connection | None = None

    async def initialize(self):
        """Initialize the database and create tables if needed."""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        self._conn = await aiosqlite.connect(self.db_path)
        self._conn.row_factory = aiosqlite.Row

        await self._conn.executescript("""
            CREATE TABLE IF NOT EXISTS bookmarks (
                id TEXT PRIMARY KEY,
                url TEXT,
                title TEXT,
                parent_id TEXT,
                creation_time TEXT,
                is_folder INTEGER,
                position INTEGER,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS devices (
                id TEXT PRIMARY KEY,
                name TEXT,
                device_type TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS tabs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT,
                url TEXT,
                title TEXT,
                favicon_url TEXT,
                last_active TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (device_id) REFERENCES devices(id)
            );

            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT,
                title TEXT,
                visit_time TEXT,
                visit_count INTEGER,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS metadata (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            -- Indexes for search performance
            CREATE INDEX IF NOT EXISTS idx_bookmarks_title ON bookmarks(title);
            CREATE INDEX IF NOT EXISTS idx_history_url ON history(url);
            CREATE INDEX IF NOT EXISTS idx_history_title ON history(title);
            CREATE INDEX IF NOT EXISTS idx_history_visit_time ON history(visit_time);
            CREATE INDEX IF NOT EXISTS idx_tabs_url ON tabs(url);
        """)
        await self._conn.commit()

    async def close(self):
        """Close the database connection."""
        if self._conn:
            await self._conn.close()
            self._conn = None

    async def get_metadata(self, key: str) -> str | None:
        """Get a metadata value."""
        if not self._conn:
            return None

        async with self._conn.execute(
            "SELECT value FROM metadata WHERE key = ?", (key,)
        ) as cursor:
            row = await cursor.fetchone()
            return row["value"] if row else None

    async def set_metadata(self, key: str, value: str):
        """Set a metadata value."""
        if not self._conn:
            return

        await self._conn.execute(
            """INSERT OR REPLACE INTO metadata (key, value, updated_at)
               VALUES (?, ?, ?)""",
            (key, value, datetime.now().isoformat()),
        )
        await self._conn.commit()

    async def get_last_sync_time(self) -> datetime | None:
        """Get the time of the last successful sync."""
        value = await self.get_metadata("last_sync_time")
        return datetime.fromisoformat(value) if value else None

    async def set_last_sync_time(self, time: datetime | None = None):
        """Set the last sync time."""
        time = time or datetime.now()
        await self.set_metadata("last_sync_time", time.isoformat())

    # Bookmarks

    async def save_bookmarks(self, bookmarks: list[Bookmark]):
        """Save bookmarks to cache, replacing existing ones."""
        if not self._conn:
            return

        await self._conn.execute("DELETE FROM bookmarks")

        for bookmark in bookmarks:
            await self._conn.execute(
                """INSERT INTO bookmarks (id, url, title, parent_id, creation_time, is_folder, position)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    bookmark.id,
                    bookmark.url,
                    bookmark.title,
                    bookmark.parent_id,
                    bookmark.creation_time.isoformat() if bookmark.creation_time else None,
                    1 if bookmark.is_folder else 0,
                    bookmark.position,
                ),
            )

        await self.set_last_sync_time()
        await self._conn.commit()

    async def get_bookmarks(self, folder_id: str | None = None) -> list[Bookmark]:
        """Get bookmarks, optionally filtered by parent folder."""
        if not self._conn:
            return []

        if folder_id:
            query = "SELECT * FROM bookmarks WHERE parent_id = ?"
            params = (folder_id,)
        else:
            query = "SELECT * FROM bookmarks"
            params = ()

        bookmarks = []
        async with self._conn.execute(query, params) as cursor:
            async for row in cursor:
                bookmarks.append(Bookmark(
                    id=row["id"],
                    url=row["url"] or "",
                    title=row["title"] or "",
                    parent_id=row["parent_id"],
                    creation_time=datetime.fromisoformat(row["creation_time"])
                        if row["creation_time"] else None,
                    is_folder=bool(row["is_folder"]),
                    position=row["position"] or 0,
                ))

        return bookmarks

    async def search_bookmarks(self, query: str) -> list[Bookmark]:
        """Search bookmarks by title or URL."""
        if not self._conn:
            return []

        bookmarks = []
        search_pattern = f"%{query}%"
        async with self._conn.execute(
            "SELECT * FROM bookmarks WHERE title LIKE ? OR url LIKE ?",
            (search_pattern, search_pattern),
        ) as cursor:
            async for row in cursor:
                bookmarks.append(Bookmark(
                    id=row["id"],
                    url=row["url"] or "",
                    title=row["title"] or "",
                    parent_id=row["parent_id"],
                    creation_time=datetime.fromisoformat(row["creation_time"])
                        if row["creation_time"] else None,
                    is_folder=bool(row["is_folder"]),
                    position=row["position"] or 0,
                ))

        return bookmarks

    # Devices and Tabs

    async def save_devices(self, devices: list[Device]):
        """Save devices and their tabs to cache."""
        if not self._conn:
            return

        await self._conn.execute("DELETE FROM tabs")
        await self._conn.execute("DELETE FROM devices")

        for i, device in enumerate(devices):
            device_id = f"device_{i}"
            await self._conn.execute(
                """INSERT INTO devices (id, name, device_type)
                   VALUES (?, ?, ?)""",
                (device_id, device.name, device.device_type),
            )

            for tab in device.tabs:
                await self._conn.execute(
                    """INSERT INTO tabs (device_id, url, title, favicon_url, last_active)
                       VALUES (?, ?, ?, ?, ?)""",
                    (
                        device_id,
                        tab.url,
                        tab.title,
                        tab.favicon_url,
                        tab.last_active.isoformat() if tab.last_active else None,
                    ),
                )

        await self.set_last_sync_time()
        await self._conn.commit()

    async def get_devices(self) -> list[Device]:
        """Get all devices with their tabs."""
        if not self._conn:
            return []

        devices = []
        async with self._conn.execute("SELECT * FROM devices") as cursor:
            async for row in cursor:
                device = Device(
                    name=row["name"],
                    device_type=row["device_type"],
                    tabs=[],
                )

                # Fetch tabs for this device
                async with self._conn.execute(
                    "SELECT * FROM tabs WHERE device_id = ?", (row["id"],)
                ) as tab_cursor:
                    async for tab_row in tab_cursor:
                        device.tabs.append(Tab(
                            url=tab_row["url"] or "",
                            title=tab_row["title"] or "",
                            favicon_url=tab_row["favicon_url"],
                            last_active=datetime.fromisoformat(tab_row["last_active"])
                                if tab_row["last_active"] else None,
                        ))

                devices.append(device)

        return devices

    # History

    async def save_history(self, entries: list[HistoryEntry]):
        """Save history entries to cache."""
        if not self._conn:
            return

        await self._conn.execute("DELETE FROM history")

        for entry in entries:
            await self._conn.execute(
                """INSERT INTO history (url, title, visit_time, visit_count)
                   VALUES (?, ?, ?, ?)""",
                (
                    entry.url,
                    entry.title,
                    entry.visit_time.isoformat(),
                    entry.visit_count,
                ),
            )

        await self.set_last_sync_time()
        await self._conn.commit()

    async def get_history(
        self,
        query: str | None = None,
        limit: int = 100,
        days_back: int | None = None,
    ) -> list[HistoryEntry]:
        """Get history entries with optional search and filtering."""
        if not self._conn:
            return []

        conditions = []
        params: list[Any] = []

        if query:
            conditions.append("(title LIKE ? OR url LIKE ?)")
            search_pattern = f"%{query}%"
            params.extend([search_pattern, search_pattern])

        if days_back:
            cutoff = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            # Subtract days (simple approach)
            from datetime import timedelta
            cutoff = cutoff - timedelta(days=days_back)
            conditions.append("visit_time >= ?")
            params.append(cutoff.isoformat())

        where_clause = " AND ".join(conditions) if conditions else "1=1"
        sql = f"""
            SELECT * FROM history
            WHERE {where_clause}
            ORDER BY visit_time DESC
            LIMIT ?
        """
        params.append(limit)

        entries = []
        async with self._conn.execute(sql, params) as cursor:
            async for row in cursor:
                entries.append(HistoryEntry(
                    url=row["url"] or "",
                    title=row["title"] or "",
                    visit_time=datetime.fromisoformat(row["visit_time"]),
                    visit_count=row["visit_count"] or 1,
                ))

        return entries
