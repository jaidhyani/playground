# Spec: Chromium Sync MCP Server

## Overview

An MCP server that connects to Chromium-based browser sync services (starting with Brave Sync v2) as a sync client, enabling Claude Code to read open tabs, search browsing history, and manage bookmarks across all devices in a user's sync chain. This treats Claude Code as another "device" in the sync ecosystem, allowing natural queries like "find that article I read last week about X" or "show me what tabs are open on my phone."

## Goals

- **Read open tabs** from all synced devices
- **Search browsing history** with full-text queries across all available history
- **Full bookmark CRUD** - create, read, update, delete bookmarks and folders
- **MCP interface** for natural Claude Code integration
- **Cache with fallback** - local cache for offline/error scenarios
- **Brave-first** - target Brave Sync v2 protocol; Chrome/Google sync is out of scope

## Non-Goals

- Chrome/Google account sync (different protocol, future work)
- Password sync access (security boundary)
- Extension sync
- Closing remote tabs (Brave Sync doesn't support this server-side)
- Filtering/redacting sensitive URLs before Claude sees them

## Requirements

### Authentication
- Accept sync chain seed (BIP39 phrase) via environment variable
- Derive Ed25519 keypair using HKDF-SHA512 from seed
- Generate access tokens: `base64(timestamp_hex|signed_timestamp_hex|public_key_hex)`
- Handle timestamp expiry (tokens valid for 1 day)

### Encryption
- Derive encryption key from BIP39 phrase using scrypt (N=2^13, r=8, p=11)
- Retrieve salt from server on first connect
- Decrypt `EntitySpecifics` using AES128-CTR-HMAC
- All bookmark/history/tab content is encrypted; only metadata is plaintext

### Data Types
- **Tabs**: Device name, tab title, URL, favicon, last active time
- **History**: URL, title, visit timestamps, visit count
- **Bookmarks**: URL, title, folder hierarchy, creation time, favicon

### MCP Tools
```
brave_sync_tabs()           -> List all open tabs across devices
brave_sync_history(query, limit, days_back)  -> Search history
brave_sync_bookmarks(folder?)  -> List bookmarks, optionally in folder
brave_sync_add_bookmark(url, title, folder?)  -> Create bookmark
brave_sync_move_bookmark(id, new_folder)  -> Move bookmark
brave_sync_delete_bookmark(id)  -> Delete bookmark
brave_sync_create_folder(name, parent?)  -> Create bookmark folder
```

### Caching
- Cache last-known sync state locally (SQLite or JSON)
- On sync server error: return cached data with staleness warning
- Cache TTL: configurable, default 5 minutes for fresh queries

## Technical Approach

### Architecture
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Claude Code   │────▶│  MCP Server      │────▶│ Brave Sync API  │
│                 │     │  (Python/stdio)  │     │ sync-v2.brave.com│
└─────────────────┘     └──────────────────┘     └─────────────────┘
                              │
                              ▼
                        ┌──────────────┐
                        │ Local Cache  │
                        │  (SQLite)    │
                        └──────────────┘
```

### Implementation Stack
- **Language**: Python (user preference, good protobuf support)
- **Protobuf**: Compile Chromium sync.proto schemas from brave/go-sync
- **Crypto**: `cryptography` library for Ed25519, scrypt, AES
- **BIP39**: `mnemonic` library for seed phrase handling
- **MCP**: `mcp` Python SDK for stdio server
- **HTTP**: `httpx` for async requests to sync server
- **Cache**: SQLite via `aiosqlite`

### Key Implementation Steps

1. **Proto compilation**: Download .proto files from brave/go-sync, compile to Python
2. **Auth module**: BIP39 decode → HKDF → Ed25519 keypair → token generation
3. **Crypto module**: scrypt key derivation, AES128-CTR-HMAC decrypt
4. **Sync client**: Implement GetUpdates request, parse SyncEntity responses
5. **Data layer**: SQLite cache with typed models for tabs/history/bookmarks
6. **MCP server**: Expose tools, handle queries, return structured data

### Incremental Delivery
Based on protocol complexity, likely order:
1. **Bookmarks** - simpler data model, good for testing encryption
2. **History** - similar structure, adds search
3. **Tabs** - requires understanding session data format

## Open Questions

1. **Protobuf availability**: Need to verify all required .proto files are in go-sync, or if some come from brave-core
2. **Salt retrieval**: How exactly does a new client fetch the encryption salt from the server?
3. **Commit for writes**: Bookmark CRUD requires implementing Commit request, not just GetUpdates
4. **Rate limits**: Does Brave's sync server have rate limits we need to respect?

## Acceptance Criteria

- [x] Can authenticate with BIP39 seed phrase from env var
- [x] Can fetch and decrypt bookmarks from sync chain
- [x] Can fetch and decrypt browsing history
- [x] Can fetch open tabs from all devices
- [ ] Can create/move/delete bookmarks via MCP tools (read-only implemented, writes pending)
- [x] Falls back to cached data when server unreachable
- [x] Works as MCP server in Claude Code config
- [ ] Tested against real Brave Sync chain (requires user's sync phrase)

## File Structure (Implemented)
```
~/Desktop/playground/chromium-sync/
├── spec.md                    # This spec
├── pyproject.toml             # Python package config
├── README.md                  # Quick start guide
├── proto_src/                 # Original .proto files from brave/go-sync
├── src/
│   └── chromium_sync/
│       ├── __init__.py
│       ├── server.py          # MCP server entry point
│       ├── auth.py            # BIP39 + HKDF + Ed25519 token generation
│       ├── crypto.py          # scrypt + AES128-CTR-HMAC encryption
│       ├── client.py          # Sync protocol client (GetUpdates)
│       ├── cache.py           # SQLite cache layer
│       └── proto/             # Compiled protobuf modules (65+ files)
└── tests/
    ├── test_auth.py           # Auth module tests
    └── test_crypto.py         # Crypto module tests
```

## Environment Variables
- `CHROMIUM_SYNC_SEED`: BIP39 seed phrase (required)
- `CHROMIUM_SYNC_CACHE_PATH`: Path to SQLite cache (default: ~/.cache/chromium-sync/cache.db)
- `CHROMIUM_SYNC_SERVER`: Sync server URL (default: https://sync-v2.brave.com/v2 for Brave)

## Implementation Status

**Completed:**
- Project structure and dependencies
- Protobuf compilation from brave/go-sync (65+ proto files)
- Auth module: BIP39 decoding, HKDF-SHA512 key derivation, Ed25519 signing, token generation
- Crypto module: scrypt key derivation, AES128-CTR-HMAC encryption/decryption
- Sync client: GetUpdates requests, entity parsing, decryption
- Cache layer: SQLite with search, TTL-based refresh
- MCP server: 4 read tools (tabs, history, bookmarks, bookmark search)
- Unit tests for auth and crypto modules

**Remaining:**
- Write operations (add/move/delete bookmarks) - requires implementing Commit requests
- Real-world testing with an actual Brave Sync chain
