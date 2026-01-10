"""Authentication for Brave Sync v2.

Implements the BIP39 seed phrase → Ed25519 keypair → access token flow
as documented in https://github.com/brave/brave-browser/wiki/Brave-Sync-v2
"""

import base64
import time
from dataclasses import dataclass

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from mnemonic import Mnemonic


@dataclass
class SyncCredentials:
    """Holds the derived sync credentials."""

    seed: bytes
    private_key: Ed25519PrivateKey
    public_key: bytes

    def generate_token(self, timestamp_ms: int | None = None) -> str:
        """Generate an access token for sync requests.

        Token format: base64(timestamp_hex|signed_timestamp_hex|public_key_hex)

        Args:
            timestamp_ms: Timestamp in milliseconds. If None, uses current time.

        Returns:
            Base64-encoded access token.
        """
        if timestamp_ms is None:
            timestamp_ms = int(time.time() * 1000)

        timestamp_hex = format(timestamp_ms, "x")
        timestamp_bytes = timestamp_hex.encode("utf-8")

        signature = self.private_key.sign(timestamp_bytes)
        signature_hex = signature.hex()

        public_key_hex = self.public_key.hex()

        token_string = f"{timestamp_hex}|{signature_hex}|{public_key_hex}"
        return base64.b64encode(token_string.encode("utf-8")).decode("utf-8")


def decode_seed_phrase(phrase: str) -> bytes:
    """Decode a BIP39 mnemonic phrase to its seed bytes.

    Args:
        phrase: Space-separated BIP39 mnemonic words (12 or 24 words).

    Returns:
        32-byte seed.

    Raises:
        ValueError: If the phrase is invalid.
    """
    mnemo = Mnemonic("english")

    words = phrase.strip().split()
    if len(words) not in (12, 24):
        raise ValueError(f"Expected 12 or 24 words, got {len(words)}")

    if not mnemo.check(phrase):
        raise ValueError("Invalid mnemonic phrase")

    entropy = mnemo.to_entropy(phrase)
    return bytes(entropy)


def derive_keypair(seed: bytes) -> tuple[Ed25519PrivateKey, bytes]:
    """Derive Ed25519 keypair from seed using HKDF-SHA512.

    Args:
        seed: 32-byte seed from BIP39 phrase.

    Returns:
        Tuple of (private_key, public_key_bytes).
    """
    hkdf = HKDF(
        algorithm=hashes.SHA512(),
        length=32,
        salt=None,
        info=b"user-secret",
    )
    derived_key = hkdf.derive(seed)

    private_key = Ed25519PrivateKey.from_private_bytes(derived_key)
    public_key = private_key.public_key()
    public_key_bytes = public_key.public_bytes_raw()

    return private_key, public_key_bytes


def create_credentials(seed_phrase: str) -> SyncCredentials:
    """Create sync credentials from a BIP39 seed phrase.

    Args:
        seed_phrase: Space-separated BIP39 mnemonic words.

    Returns:
        SyncCredentials with derived keys.
    """
    seed = decode_seed_phrase(seed_phrase)
    private_key, public_key = derive_keypair(seed)

    return SyncCredentials(
        seed=seed,
        private_key=private_key,
        public_key=public_key,
    )
