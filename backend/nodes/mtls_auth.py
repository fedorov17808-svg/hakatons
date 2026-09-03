import os
import ssl
import subprocess
import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

CERTS_DIR = os.getenv("DON_CERTS_DIR", os.path.join(os.path.dirname(__file__), "certs"))

def ensure_certificates(node_id: str, node_ip: str = "127.0.0.1") -> Tuple[str, str, str]:
    """
    Ensure CA, Node Certificate, and Private Key exist.
    Generates Root CA and Node mTLS certificates using standard OpenSSL tools.
    Returns (ca_cert_path, node_cert_path, node_key_path).
    """
    os.makedirs(CERTS_DIR, exist_ok=True)
    
    ca_key_path = os.path.join(CERTS_DIR, "ca_key.pem")
    ca_cert_path = os.path.join(CERTS_DIR, "ca_cert.pem")
    node_key_path = os.path.join(CERTS_DIR, f"{node_id}_key.pem")
    node_cert_path = os.path.join(CERTS_DIR, f"{node_id}_cert.pem")
    node_csr_path = os.path.join(CERTS_DIR, f"{node_id}_csr.pem")

    # 1. Generate Root CA if not present
    if not (os.path.exists(ca_key_path) and os.path.exists(ca_cert_path)):
        logger.info("Generating CreditPulse Root CA for mTLS mesh...")
        subprocess.run([
            "openssl", "req", "-x509", "-newkey", "rsa:3072", "-days", "1825", "-nodes",
            "-keyout", ca_key_path,
            "-out", ca_cert_path,
            "-subj", "/C=US/O=CreditPulse DON Network/CN=CreditPulse Root CA"
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # 2. Generate Node Certificate signed by Root CA
    if not (os.path.exists(node_key_path) and os.path.exists(node_cert_path)):
        logger.info(f"Generating mTLS certificate for DON node: {node_id} ({node_ip})...")
        subprocess.run([
            "openssl", "req", "-newkey", "rsa:2048", "-nodes",
            "-keyout", node_key_path,
            "-out", node_csr_path,
            "-subj", f"/C=US/O=CreditPulse DON Network/CN=don-node-{node_id}"
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        subprocess.run([
            "openssl", "x509", "-req", "-in", node_csr_path,
            "-CA", ca_cert_path,
            "-CAkey", ca_key_path,
            "-CAcreateserial",
            "-out", node_cert_path,
            "-days", "730"
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        if os.path.exists(node_csr_path):
            os.remove(node_csr_path)

    return ca_cert_path, node_cert_path, node_key_path

def create_mtls_client_context(node_id: str) -> ssl.SSLContext:
    """Create an SSL client context configured for mutual TLS authentication."""
    ca_cert, node_cert, node_key = ensure_certificates(node_id)
    ctx = ssl.create_default_context(ssl.Purpose.SERVER_AUTH, cafile=ca_cert)
    ctx.load_cert_chain(certfile=node_cert, keyfile=node_key)
    ctx.check_hostname = False
    return ctx
