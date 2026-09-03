"""
CreditPulse AI — BLS12-381 Node Key Management v7.3.0

Generates, stores, and loads cryptographically secure BLS12-381 private keys
for oracle validator nodes. Keys are derived from os.urandom(32) — the system
CSPRNG — and stored in a local JSON keyfile with restricted permissions.

Usage:
    # Generate a new key for a node
    python keygen.py --node-id node-alpha --output ~/.creditpulse/node_key.json

    # Generate and print pubkey only (for registration)
    python keygen.py --node-id node-alpha --output ~/.creditpulse/node_key.json --print-pubkey

    # Programmatic usage
    from nodes.keygen import NodeKeyManager
    manager = NodeKeyManager()
    sk, pk = manager.load_or_generate("node-alpha")
"""

import os
import sys
import json
import stat
import hashlib
import argparse
import logging
from pathlib import Path
from typing import Tuple, Optional, Dict

from py_ecc.bls import G2ProofOfPossession as bls
from py_ecc.optimized_bls12_381 import curve_order

logger = logging.getLogger("NodeKeyManager")


class NodeKeyManager:
    """
    Manages BLS12-381 private keys for oracle validator nodes.

    Security model:
    - Keys are generated from os.urandom(32) — system CSPRNG
    - Stored in a JSON file with 0600 permissions (owner read/write only)
    - Each node has a unique, independently generated key
    - Testnet mode is available but explicitly flagged in all outputs

    In production, this would be replaced by HSM/KMS integration
    (e.g., AWS CloudHSM, Google Cloud KMS, Azure Dedicated HSM).
    """

    DEFAULT_KEY_DIR = os.path.expanduser("~/.creditpulse/keys")
    TESTNET_MODE_FLAG = "TESTNET_KEYS_ACTIVE"

    def __init__(self, key_dir: Optional[str] = None):
        self.key_dir = Path(key_dir or os.getenv("CREDITPULSE_KEY_DIR", self.DEFAULT_KEY_DIR))

    def _keyfile_path(self, node_id: str) -> Path:
        """Get the path to a node's keyfile."""
        safe_id = node_id.replace("/", "_").replace("..", "_")
        return self.key_dir / f"{safe_id}.key.json"

    @staticmethod
    def generate_private_key() -> int:
        """
        Generate a cryptographically secure BLS12-381 private key.

        Uses os.urandom(32) — the system's CSPRNG (Cryptographically Secure
        Pseudo-Random Number Generator). On Linux this reads from /dev/urandom,
        on macOS from SecRandomCopyBytes, on Windows from CryptGenRandom.

        The key is reduced modulo (curve_order - 1) + 1 to ensure it's in
        the valid range [1, curve_order - 1].
        """
        random_bytes = os.urandom(32)
        raw = int.from_bytes(random_bytes, "big")
        private_key = (raw % (curve_order - 1)) + 1
        return private_key

    @staticmethod
    def derive_public_key(private_key: int) -> bytes:
        """Derive BLS12-381 public key (G2 point, 48 bytes) from private scalar."""
        return bls.SkToPk(private_key)

    def save_key(self, node_id: str, private_key: int, overwrite: bool = False) -> Path:
        """
        Save a private key to a JSON keyfile with restricted permissions.

        The keyfile contains:
        - node_id: identifier for the node
        - private_key_hex: hex-encoded private key
        - public_key_hex: hex-encoded public key (for registration)
        - generated_at: ISO timestamp
        - entropy_source: "os.urandom(32)"
        """
        keyfile = self._keyfile_path(node_id)

        if keyfile.exists() and not overwrite:
            raise FileExistsError(
                f"Keyfile already exists: {keyfile}. "
                f"Use --overwrite to replace it."
            )

        # Ensure directory exists with restricted permissions
        self.key_dir.mkdir(parents=True, exist_ok=True)
        os.chmod(str(self.key_dir), stat.S_IRWXU)  # 0700

        public_key = self.derive_public_key(private_key)

        import datetime
        keydata = {
            "node_id": node_id,
            "private_key_hex": hex(private_key),
            "public_key_hex": "0x" + public_key.hex(),
            "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
            "entropy_source": "os.urandom(32)",
            "curve": "BLS12-381",
            "key_format": "raw_scalar",
            "warning": "KEEP THIS FILE SECRET. Do not commit to version control.",
        }

        with open(str(keyfile), "w") as f:
            json.dump(keydata, f, indent=2)

        # Restrict permissions: owner read/write only (0600)
        os.chmod(str(keyfile), stat.S_IRUSR | stat.S_IWUSR)

        logger.info(f"Key saved for {node_id} at {keyfile} (permissions: 0600)")
        return keyfile

    def load_key(self, node_id: str) -> Optional[Tuple[int, bytes]]:
        """
        Load a private key from a JSON keyfile.

        Returns:
            Tuple of (private_key: int, public_key: bytes) or None if not found.
        """
        keyfile = self._keyfile_path(node_id)
        if not keyfile.exists():
            return None

        with open(str(keyfile), "r") as f:
            keydata = json.load(f)

        private_key = int(keydata["private_key_hex"], 16)
        public_key = self.derive_public_key(private_key)

        # Verify pubkey matches stored value
        stored_pubkey = keydata.get("public_key_hex", "")
        if stored_pubkey and stored_pubkey != "0x" + public_key.hex():
            raise ValueError(
                f"Public key mismatch for {node_id}! "
                f"Keyfile may be corrupted."
            )

        return private_key, public_key

    def load_or_generate(self, node_id: str) -> Tuple[int, bytes]:
        """
        Load existing key or generate a new one.
        This is the primary entry point for node startup.
        """
        existing = self.load_key(node_id)
        if existing:
            logger.info(f"Loaded existing key for {node_id}")
            return existing

        logger.info(f"No key found for {node_id}, generating new key...")
        private_key = self.generate_private_key()
        self.save_key(node_id, private_key)
        public_key = self.derive_public_key(private_key)
        return private_key, public_key

    def get_all_public_keys(self) -> Dict[str, str]:
        """List all node IDs and their public keys."""
        result = {}
        if not self.key_dir.exists():
            return result
        for keyfile in self.key_dir.glob("*.key.json"):
            with open(str(keyfile), "r") as f:
                keydata = json.load(f)
            result[keydata["node_id"]] = keydata.get("public_key_hex", "unknown")
        return result

    @staticmethod
    def make_testnet_key(seed_bytes: bytes) -> int:
        """
        Generate a Testnet key from a deterministic seed.

        WARNING: Testnet keys are derived from public strings and provide
        NO cryptographic security. They exist solely for local testing.
        All API responses will be flagged with TESTNET_KEYS_ACTIVE when
        testnet keys are in use.
        """
        raw = int.from_bytes(hashlib.sha256(seed_bytes).digest(), "big")
        return (raw % (curve_order - 1)) + 1

    @classmethod
    def get_testnet_keys(cls) -> Dict[str, int]:
        """
        Return hardcoded testnet keys. ONLY for --testnet-keys mode.
        These are derived from public strings and are NOT secure.
        """
        return {
            "node-alpha": cls.make_testnet_key(b"creditpulse-node-alpha-v7.2"),
            "node-beta":  cls.make_testnet_key(b"creditpulse-node-beta-v7.2"),
            "node-gamma": cls.make_testnet_key(b"creditpulse-node-gamma-v7.2"),
        }


def main():
    parser = argparse.ArgumentParser(
        description="CreditPulse BLS12-381 Node Key Generator"
    )
    parser.add_argument(
        "--node-id", required=True,
        help="Node identifier (e.g., node-alpha, node-beta, node-gamma)"
    )
    parser.add_argument(
        "--key-dir", default=None,
        help=f"Directory for key storage (default: ~/.creditpulse/keys)"
    )
    parser.add_argument(
        "--overwrite", action="store_true",
        help="Overwrite existing keyfile"
    )
    parser.add_argument(
        "--print-pubkey", action="store_true",
        help="Print public key in hex format (for oracle registration)"
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)

    manager = NodeKeyManager(key_dir=args.key_dir)
    sk = manager.generate_private_key()
    keyfile = manager.save_key(args.node_id, sk, overwrite=args.overwrite)

    pk = manager.derive_public_key(sk)
    print(f"\n✅ Key generated for: {args.node_id}")
    print(f"📁 Keyfile: {keyfile}")
    print(f"🔑 Public Key: 0x{pk.hex()}")

    if args.print_pubkey:
        print(f"\nRegister this public key on-chain:")
        print(f"  0x{pk.hex()}")


if __name__ == "__main__":
    main()
