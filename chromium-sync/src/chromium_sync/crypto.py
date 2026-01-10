"""Encryption/decryption for Brave Sync v2.

Implements the Nigori encryption scheme used by Chromium Sync.
Based on: https://github.com/nickel-org/nickel.rs encryption and Chromium source.

For custom passphrase (which Brave enforces via BIP39):
- Key derivation: scrypt(N=8192, r=8, p=11) with salt from server
- Encryption: AES128-CTR with HMAC-SHA256 authentication
"""

import base64
import hashlib
import hmac
import os
from dataclasses import dataclass

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt


SCRYPT_N = 8192  # 2^13
SCRYPT_R = 8
SCRYPT_P = 11
SCRYPT_KEY_LENGTH = 128  # 128 bytes, then split into user/encryption/mac keys


@dataclass
class NigoriKeys:
    """Derived encryption keys for Nigori."""

    user_key: bytes  # Not used in modern Chromium
    encryption_key: bytes  # 16 bytes for AES-128
    mac_key: bytes  # 32 bytes for HMAC-SHA256

    @property
    def key_name(self) -> str:
        """Compute the key name (hash of encrypting a constant string)."""
        # Key name is base64 of the encrypted form of "nigori-key"
        encrypted = self.encrypt(b"nigori-key")
        return base64.b64encode(encrypted).decode("utf-8")

    def encrypt(self, plaintext: bytes) -> bytes:
        """Encrypt data using AES-128-CTR with HMAC-SHA256.

        Format: IV (16 bytes) || ciphertext || HMAC (32 bytes)
        """
        iv = os.urandom(16)

        cipher = Cipher(algorithms.AES(self.encryption_key), modes.CTR(iv))
        encryptor = cipher.encryptor()
        ciphertext = encryptor.update(plaintext) + encryptor.finalize()

        # HMAC over IV + ciphertext
        mac = hmac.new(self.mac_key, iv + ciphertext, hashlib.sha256).digest()

        return iv + ciphertext + mac

    def decrypt(self, encrypted: bytes) -> bytes:
        """Decrypt data encrypted with AES-128-CTR + HMAC-SHA256.

        Args:
            encrypted: IV (16 bytes) || ciphertext || HMAC (32 bytes)

        Returns:
            Decrypted plaintext.

        Raises:
            ValueError: If HMAC verification fails or data is malformed.
        """
        if len(encrypted) < 48:  # 16 (IV) + 0 (min ciphertext) + 32 (HMAC)
            raise ValueError("Encrypted data too short")

        iv = encrypted[:16]
        mac = encrypted[-32:]
        ciphertext = encrypted[16:-32]

        # Verify HMAC
        expected_mac = hmac.new(self.mac_key, iv + ciphertext, hashlib.sha256).digest()
        if not hmac.compare_digest(mac, expected_mac):
            raise ValueError("HMAC verification failed")

        cipher = Cipher(algorithms.AES(self.encryption_key), modes.CTR(iv))
        decryptor = cipher.decryptor()
        return decryptor.update(ciphertext) + decryptor.finalize()


def derive_keys_scrypt(passphrase: str, salt: bytes) -> NigoriKeys:
    """Derive Nigori keys from passphrase using scrypt.

    This is the modern key derivation method (SCRYPT_8192_8_11) used by
    Chromium for custom passphrases since M70.

    Args:
        passphrase: The user's passphrase (for Brave, this is the BIP39 phrase).
        salt: Random salt from the server (retrieved via Nigori entity).

    Returns:
        NigoriKeys with derived encryption and MAC keys.
    """
    kdf = Scrypt(
        salt=salt,
        length=SCRYPT_KEY_LENGTH,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
    )
    derived = kdf.derive(passphrase.encode("utf-8"))

    # Split into three keys: user (unused), encryption (16 bytes), mac (remaining)
    # Based on Chromium's Nigori::CreateByDerivation
    user_key = derived[:16]
    encryption_key = derived[16:32]
    mac_key = derived[32:64]

    return NigoriKeys(
        user_key=user_key,
        encryption_key=encryption_key,
        mac_key=mac_key,
    )


def derive_keys_pbkdf2(passphrase: str) -> NigoriKeys:
    """Derive Nigori keys using legacy PBKDF2 (pre-M70).

    Uses PBKDF2-HMAC-SHA1 with 1003 iterations and a constant salt.
    This is the fallback for older sync data.
    """
    # Chromium uses a constant salt for PBKDF2
    salt = b"saltsalt"
    iterations = 1003

    derived = hashlib.pbkdf2_hmac(
        "sha1",
        passphrase.encode("utf-8"),
        salt,
        iterations,
        dklen=SCRYPT_KEY_LENGTH,
    )

    user_key = derived[:16]
    encryption_key = derived[16:32]
    mac_key = derived[32:64]

    return NigoriKeys(
        user_key=user_key,
        encryption_key=encryption_key,
        mac_key=mac_key,
    )


def decrypt_encrypted_data(
    encrypted_data_blob: str,
    keys: NigoriKeys,
) -> bytes:
    """Decrypt an EncryptedData blob.

    Args:
        encrypted_data_blob: Base64-encoded encrypted data from EncryptedData.blob.
        keys: NigoriKeys for decryption.

    Returns:
        Decrypted bytes.
    """
    encrypted = base64.b64decode(encrypted_data_blob)
    return keys.decrypt(encrypted)
