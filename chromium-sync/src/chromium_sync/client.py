"""Brave Sync v2 client implementation.

Handles communication with the Brave Sync server, including:
- GetUpdates requests for fetching sync data
- Commit requests for writing data (bookmarks)
- Entity parsing and decryption
"""

import base64
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

import httpx

from .auth import SyncCredentials
from .crypto import NigoriKeys, decrypt_encrypted_data, derive_keys_scrypt
from .proto import (
    ClientToServerMessage,
    ClientToServerResponse,
    GetUpdatesMessage,
    DataTypeProgressMarker,
    SyncEntity,
    EntitySpecifics,
    NigoriSpecifics,
    BookmarkSpecifics,
    SessionSpecifics,
    TypedUrlSpecifics,
    HistorySpecifics,
    SyncEnums,
)


# Data type IDs from Chromium (sync_enums.proto and entity_specifics.proto)
class DataType:
    BOOKMARK = 32904
    SESSION = 50119
    TYPED_URL = 40781
    HISTORY = 963985
    NIGORI = 47745
    DEVICE_INFO = 154522


@dataclass
class Bookmark:
    """Parsed bookmark entity."""

    id: str
    url: str
    title: str
    parent_id: str | None
    creation_time: datetime | None
    is_folder: bool
    position: int = 0


@dataclass
class Tab:
    """Parsed tab from a session."""

    url: str
    title: str
    favicon_url: str | None
    last_active: datetime | None


@dataclass
class Device:
    """Device with open tabs."""

    name: str
    device_type: str
    tabs: list[Tab] = field(default_factory=list)


@dataclass
class HistoryEntry:
    """Parsed history entry."""

    url: str
    title: str
    visit_time: datetime
    visit_count: int = 1


class SyncClient:
    """Client for Brave Sync v2 protocol."""

    def __init__(
        self,
        credentials: SyncCredentials,
        server_url: str = "https://sync-v2.brave.com/v2",
    ):
        self.credentials = credentials
        self.server_url = server_url.rstrip("/")
        self.http = httpx.AsyncClient(timeout=30.0)

        # State
        self.store_birthday: str | None = None
        self.cache_guid = str(uuid.uuid4())
        self.progress_markers: dict[int, bytes] = {}
        self.nigori_keys: NigoriKeys | None = None
        self.nigori_salt: bytes | None = None

    async def close(self):
        """Close the HTTP client."""
        await self.http.aclose()

    async def _request(self, message: ClientToServerMessage) -> ClientToServerResponse:
        """Send a request to the sync server."""
        token = self.credentials.generate_token()

        # Serialize the protobuf message
        data = message.SerializeToString()

        response = await self.http.post(
            f"{self.server_url}/command/",
            content=data,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/x-protobuf",
            },
        )

        if response.status_code != 200:
            raise SyncError(f"Sync request failed: {response.status_code} {response.text}")

        result = ClientToServerResponse()
        result.ParseFromString(response.content)

        # Check for errors
        if result.error_code != SyncEnums.ErrorType.SUCCESS:
            raise SyncError(f"Sync error: {result.error_message} (code {result.error_code})")

        # Update store birthday
        if result.store_birthday:
            self.store_birthday = result.store_birthday

        return result

    def _create_get_updates_message(
        self,
        data_types: list[int],
        origin: int = SyncEnums.GetUpdatesOrigin.PERIODIC,
    ) -> ClientToServerMessage:
        """Create a GetUpdates request message."""
        msg = ClientToServerMessage()
        msg.share = ""  # Not used by Brave
        msg.protocol_version = 99
        msg.message_contents = ClientToServerMessage.Contents.GET_UPDATES

        if self.store_birthday:
            msg.store_birthday = self.store_birthday

        get_updates = msg.get_updates
        get_updates.get_updates_origin = origin

        for data_type in data_types:
            marker = get_updates.from_progress_marker.add()
            marker.data_type_id = data_type

            # Include existing progress token if we have one
            if data_type in self.progress_markers:
                marker.token = self.progress_markers[data_type]

        return msg

    async def get_updates(self, data_types: list[int]) -> list[SyncEntity]:
        """Fetch updates for the specified data types.

        Args:
            data_types: List of data type IDs to fetch.

        Returns:
            List of SyncEntity objects.
        """
        message = self._create_get_updates_message(data_types)
        response = await self._request(message)

        get_updates_response = response.get_updates

        # Update progress markers
        for marker in get_updates_response.new_progress_marker:
            self.progress_markers[marker.data_type_id] = marker.token

        return list(get_updates_response.entries)

    async def fetch_nigori(self) -> NigoriSpecifics | None:
        """Fetch the Nigori entity to get encryption keys and salt."""
        entities = await self.get_updates([DataType.NIGORI])

        for entity in entities:
            if entity.specifics.HasField("nigori"):
                return entity.specifics.nigori

        return None

    async def initialize_encryption(self, passphrase: str) -> bool:
        """Initialize encryption by fetching Nigori and deriving keys.

        Args:
            passphrase: The sync passphrase (BIP39 phrase for Brave).

        Returns:
            True if encryption was initialized successfully.
        """
        nigori = await self.fetch_nigori()
        if not nigori:
            raise SyncError("No Nigori entity found - sync chain may not exist")

        # Get the key derivation method and salt
        key_derivation_method = nigori.custom_passphrase_key_derivation_method

        if key_derivation_method == NigoriSpecifics.KeyDerivationMethod.SCRYPT_8192_8_11:
            salt_b64 = nigori.custom_passphrase_key_derivation_salt
            if not salt_b64:
                raise SyncError("Nigori uses scrypt but no salt provided")
            self.nigori_salt = base64.b64decode(salt_b64)
            self.nigori_keys = derive_keys_scrypt(passphrase, self.nigori_salt)
        else:
            # Fall back to PBKDF2 for older sync chains
            from .crypto import derive_keys_pbkdf2
            self.nigori_keys = derive_keys_pbkdf2(passphrase)

        return True

    def _decrypt_entity(self, entity: SyncEntity) -> EntitySpecifics | None:
        """Decrypt an encrypted entity's specifics.

        Args:
            entity: SyncEntity that may have encrypted data.

        Returns:
            Decrypted EntitySpecifics, or None if not encrypted or decryption fails.
        """
        if not self.nigori_keys:
            return None

        specifics = entity.specifics
        if not specifics.HasField("encrypted"):
            return specifics

        try:
            decrypted_bytes = decrypt_encrypted_data(
                specifics.encrypted.blob,
                self.nigori_keys,
            )

            decrypted_specifics = EntitySpecifics()
            decrypted_specifics.ParseFromString(decrypted_bytes)
            return decrypted_specifics
        except Exception:
            return None

    async def fetch_bookmarks(self) -> list[Bookmark]:
        """Fetch all bookmarks from sync."""
        entities = await self.get_updates([DataType.BOOKMARK])
        bookmarks = []

        for entity in entities:
            specifics = self._decrypt_entity(entity)
            if not specifics or not specifics.HasField("bookmark"):
                continue

            bookmark_data = specifics.bookmark
            bookmarks.append(Bookmark(
                id=entity.id_string,
                url=bookmark_data.url if bookmark_data.url else "",
                title=bookmark_data.title if bookmark_data.title else "",
                parent_id=entity.parent_id_string if entity.parent_id_string else None,
                creation_time=datetime.fromtimestamp(bookmark_data.creation_time_us / 1_000_000)
                    if bookmark_data.creation_time_us else None,
                is_folder=bookmark_data.type == BookmarkSpecifics.Type.FOLDER,
            ))

        return bookmarks

    async def fetch_sessions(self) -> list[Device]:
        """Fetch all session data (open tabs) from sync."""
        entities = await self.get_updates([DataType.SESSION])
        devices: dict[str, Device] = {}

        for entity in entities:
            specifics = self._decrypt_entity(entity)
            if not specifics or not specifics.HasField("session"):
                continue

            session = specifics.session

            # Session entities can be headers (device info) or tabs
            if session.HasField("header"):
                header = session.header
                device_name = header.client_name if header.client_name else "Unknown Device"
                device_type = "unknown"

                if session.session_tag not in devices:
                    devices[session.session_tag] = Device(
                        name=device_name,
                        device_type=device_type,
                    )

            elif session.HasField("tab"):
                tab_data = session.tab
                if session.session_tag not in devices:
                    devices[session.session_tag] = Device(
                        name="Unknown Device",
                        device_type="unknown",
                    )

                # Get the current navigation
                if tab_data.navigation:
                    current_nav = tab_data.navigation[-1] if tab_data.navigation else None
                    if current_nav:
                        devices[session.session_tag].tabs.append(Tab(
                            url=current_nav.virtual_url if current_nav.virtual_url else "",
                            title=current_nav.title if current_nav.title else "",
                            favicon_url=current_nav.favicon_url if current_nav.HasField("favicon_url") else None,
                            last_active=datetime.fromtimestamp(tab_data.timestamp_usec / 1_000_000)
                                if tab_data.timestamp_usec else None,
                        ))

        return list(devices.values())

    async def fetch_history(self) -> list[HistoryEntry]:
        """Fetch browsing history from sync."""
        # Try both TYPED_URL and HISTORY types
        entities = await self.get_updates([DataType.TYPED_URL, DataType.HISTORY])
        history = []

        for entity in entities:
            specifics = self._decrypt_entity(entity)
            if not specifics:
                continue

            if specifics.HasField("typed_url"):
                typed_url = specifics.typed_url
                # typed_url has visits as timestamps
                visit_times = list(typed_url.visits) if typed_url.visits else []
                latest_visit = max(visit_times) if visit_times else 0

                history.append(HistoryEntry(
                    url=typed_url.url if typed_url.url else "",
                    title=typed_url.title if typed_url.title else "",
                    visit_time=datetime.fromtimestamp(latest_visit / 1_000_000)
                        if latest_visit else datetime.now(),
                    visit_count=len(visit_times),
                ))

            elif specifics.HasField("history"):
                hist = specifics.history
                history.append(HistoryEntry(
                    url=hist.url if hist.HasField("url") else "",
                    title=hist.title if hist.HasField("title") else "",
                    visit_time=datetime.fromtimestamp(hist.last_visit_time_usec / 1_000_000)
                        if hist.last_visit_time_usec else datetime.now(),
                    visit_count=hist.visit_count if hist.HasField("visit_count") else 1,
                ))

        return history


class SyncError(Exception):
    """Error during sync operations."""

    pass
