"""Tests for the crypto module."""

import os
import pytest

from chromium_sync.crypto import (
    NigoriKeys,
    derive_keys_scrypt,
    derive_keys_pbkdf2,
    decrypt_encrypted_data,
)


class TestNigoriKeys:
    def test_encrypt_decrypt_roundtrip(self):
        """Test that encryption and decryption work correctly."""
        keys = NigoriKeys(
            user_key=os.urandom(16),
            encryption_key=os.urandom(16),
            mac_key=os.urandom(32),
        )

        plaintext = b"Hello, Brave Sync!"
        encrypted = keys.encrypt(plaintext)
        decrypted = keys.decrypt(encrypted)

        assert decrypted == plaintext

    def test_encrypted_format(self):
        """Test that encrypted data has correct format."""
        keys = NigoriKeys(
            user_key=os.urandom(16),
            encryption_key=os.urandom(16),
            mac_key=os.urandom(32),
        )

        plaintext = b"Test"
        encrypted = keys.encrypt(plaintext)

        # Format: IV (16) + ciphertext (len(plaintext)) + HMAC (32)
        assert len(encrypted) == 16 + len(plaintext) + 32

    def test_decrypt_fails_with_wrong_mac(self):
        """Test that tampered data fails HMAC verification."""
        keys = NigoriKeys(
            user_key=os.urandom(16),
            encryption_key=os.urandom(16),
            mac_key=os.urandom(32),
        )

        plaintext = b"Test"
        encrypted = keys.encrypt(plaintext)

        # Tamper with the ciphertext
        tampered = bytearray(encrypted)
        tampered[20] ^= 0xFF
        tampered = bytes(tampered)

        with pytest.raises(ValueError, match="HMAC verification failed"):
            keys.decrypt(tampered)

    def test_decrypt_fails_with_short_data(self):
        """Test that too-short data is rejected."""
        keys = NigoriKeys(
            user_key=os.urandom(16),
            encryption_key=os.urandom(16),
            mac_key=os.urandom(32),
        )

        with pytest.raises(ValueError, match="too short"):
            keys.decrypt(b"short")

    def test_key_name_is_string(self):
        """Test that key_name returns a valid base64 string."""
        keys = NigoriKeys(
            user_key=b"\x00" * 16,
            encryption_key=b"\x01" * 16,
            mac_key=b"\x02" * 32,
        )

        name = keys.key_name
        # Should be valid base64
        import base64
        decoded = base64.b64decode(name)
        assert len(decoded) > 0


class TestDeriveKeysScrypt:
    def test_derives_correct_key_lengths(self):
        """Test that derived keys have correct lengths."""
        salt = os.urandom(32)
        keys = derive_keys_scrypt("test passphrase", salt)

        assert len(keys.user_key) == 16
        assert len(keys.encryption_key) == 16
        assert len(keys.mac_key) == 32

    def test_deterministic_with_same_salt(self):
        """Test that same passphrase + salt produces same keys."""
        salt = b"\x00" * 32
        keys1 = derive_keys_scrypt("test", salt)
        keys2 = derive_keys_scrypt("test", salt)

        assert keys1.encryption_key == keys2.encryption_key
        assert keys1.mac_key == keys2.mac_key

    def test_different_with_different_salt(self):
        """Test that different salts produce different keys."""
        keys1 = derive_keys_scrypt("test", b"\x00" * 32)
        keys2 = derive_keys_scrypt("test", b"\x01" * 32)

        assert keys1.encryption_key != keys2.encryption_key


class TestDeriveKeysPbkdf2:
    def test_derives_correct_key_lengths(self):
        """Test that derived keys have correct lengths."""
        keys = derive_keys_pbkdf2("test passphrase")

        assert len(keys.user_key) == 16
        assert len(keys.encryption_key) == 16
        assert len(keys.mac_key) == 32

    def test_deterministic(self):
        """Test that same passphrase produces same keys."""
        keys1 = derive_keys_pbkdf2("test")
        keys2 = derive_keys_pbkdf2("test")

        assert keys1.encryption_key == keys2.encryption_key
        assert keys1.mac_key == keys2.mac_key
