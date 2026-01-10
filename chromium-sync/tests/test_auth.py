"""Tests for the auth module."""

import base64
import pytest

from chromium_sync.auth import create_credentials, decode_seed_phrase, derive_keypair


# Standard BIP39 test vector - 12 word "abandon" phrase
TEST_PHRASE = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"


class TestDecodeSeedPhrase:
    def test_valid_12_word_phrase(self):
        """Test decoding a valid 12-word BIP39 phrase."""
        seed = decode_seed_phrase(TEST_PHRASE)
        assert len(seed) == 16  # 12 words = 128 bits = 16 bytes

    def test_invalid_word_count(self):
        """Test that invalid word counts raise ValueError."""
        with pytest.raises(ValueError, match="Expected 12 or 24 words"):
            decode_seed_phrase("abandon abandon abandon")

    def test_invalid_checksum(self):
        """Test that invalid checksums raise ValueError."""
        # Replace last word to break checksum
        bad_phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon"
        with pytest.raises(ValueError, match="Invalid mnemonic phrase"):
            decode_seed_phrase(bad_phrase)


class TestDeriveKeypair:
    def test_derives_ed25519_keypair(self):
        """Test that we get a valid Ed25519 keypair."""
        seed = decode_seed_phrase(TEST_PHRASE)
        private_key, public_key = derive_keypair(seed)

        assert len(public_key) == 32  # Ed25519 public key is 32 bytes

    def test_deterministic(self):
        """Test that same seed produces same keys."""
        seed = decode_seed_phrase(TEST_PHRASE)

        _, pub1 = derive_keypair(seed)
        _, pub2 = derive_keypair(seed)

        assert pub1 == pub2


class TestCreateCredentials:
    def test_creates_valid_credentials(self):
        """Test that create_credentials produces valid credentials."""
        creds = create_credentials(TEST_PHRASE)

        assert len(creds.seed) == 16
        assert len(creds.public_key) == 32
        assert creds.private_key is not None

    def test_generates_token(self):
        """Test that we can generate an access token."""
        creds = create_credentials(TEST_PHRASE)
        token = creds.generate_token()

        # Token is base64 encoded
        decoded = base64.b64decode(token).decode("utf-8")
        parts = decoded.split("|")

        assert len(parts) == 3  # timestamp|signature|public_key
        assert len(parts[1]) == 128  # Ed25519 signature is 64 bytes = 128 hex chars
        assert len(parts[2]) == 64  # Ed25519 public key is 32 bytes = 64 hex chars

    def test_token_with_timestamp(self):
        """Test token generation with explicit timestamp."""
        creds = create_credentials(TEST_PHRASE)
        timestamp = 1704067200000  # 2024-01-01 00:00:00 UTC

        token = creds.generate_token(timestamp_ms=timestamp)
        decoded = base64.b64decode(token).decode("utf-8")
        parts = decoded.split("|")

        # First part should be hex timestamp
        assert parts[0] == format(timestamp, "x")
