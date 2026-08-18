#!/usr/bin/env python3
"""Call the Creditcoin precompile 0x0FD2 directly with a real proof."""
import json, os, sys

# Add backend to path for web3
sys.path.insert(0, '/Users/stepchik/.gemini/antigravity/scratch/hakatons/backend')

from web3 import Web3

# Load proof data
proof = json.load(open('/Users/stepchik/.gemini/antigravity/scratch/hakatons/proof_data.json'))

# Connect to CC3 testnet
RPC = "https://rpc.cc3-testnet.creditcoin.network"
w3 = Web3(Web3.HTTPProvider(RPC))
print(f"Connected to CC3: {w3.is_connected()}, block: {w3.eth.block_number}")

# Load private key
for line in open('/Users/stepchik/.gemini/antigravity/scratch/hakatons/backend/.env'):
    if line.startswith('PRIVATE_KEY='):
        PK = line.strip().split('=',1)[1].strip('"').strip("'")
        break

account = w3.eth.account.from_key(PK)
print(f"Account: {account.address}")
print(f"Balance: {w3.eth.get_balance(account.address) / 1e18:.4f} CTC")

# Precompile address
PRECOMPILE = "0x0000000000000000000000000000000000000FD2"

# Extract proof components
chain_key = proof['chainKey']  # 1
block_num = proof['fromHeader']  # 8812893
merkle_data = proof['merkleProofs'][str(block_num)]
tx_key = list(merkle_data.keys())[0]
tx_proof = merkle_data[tx_key]

tx_bytes = bytes.fromhex(tx_proof['txBytes'][2:])
merkle_root = bytes.fromhex(tx_proof['merkleProof']['root'][2:])
siblings = [(bytes.fromhex(s['hash'][2:]), s['isLeft']) for s in tx_proof['merkleProof']['siblings']]
lower_endpoint = bytes.fromhex(proof['continuityProof']['lowerEndpointDigest'][2:])
continuity_roots = [bytes.fromhex(r[2:]) for r in proof['continuityProof']['roots']]

print(f"\n=== PROOF DATA ===")
print(f"Chain key: {chain_key}")
print(f"Block: {block_num}")
print(f"TX bytes: {len(tx_bytes)} bytes")
print(f"Merkle root: {merkle_root.hex()[:40]}...")
print(f"Siblings: {len(siblings)}")
print(f"Continuity roots: {len(continuity_roots)}")
print(f"Lower endpoint: {lower_endpoint.hex()[:40]}...")

# ABI for the precompile: verifyAndEmit(uint64, uint64[], bytes[], MerkleProof[], ContinuityProof)
# MerkleProof = (bytes32 root, (bytes32 hash, bool isLeft)[] siblings)
# ContinuityProof = (bytes32 lowerEndpointDigest, bytes32[] roots)
PRECOMPILE_ABI = [
    {
        "type": "function",
        "name": "verifyAndEmit",
        "inputs": [
            {"name": "chainKey", "type": "uint64"},
            {"name": "headerNumbers", "type": "uint64[]"},
            {"name": "encodedTransactions", "type": "bytes[]"},
            {
                "name": "merkleProofs",
                "type": "tuple[]",
                "components": [
                    {"name": "root", "type": "bytes32"},
                    {
                        "name": "siblings",
                        "type": "tuple[]",
                        "components": [
                            {"name": "hash", "type": "bytes32"},
                            {"name": "isLeft", "type": "bool"}
                        ]
                    }
                ]
            },
            {
                "name": "continuityProof",
                "type": "tuple",
                "components": [
                    {"name": "lowerEndpointDigest", "type": "bytes32"},
                    {"name": "roots", "type": "bytes32[]"}
                ]
            }
        ],
        "outputs": [{"name": "", "type": "bytes32"}],
        "stateMutability": "nonpayable"
    }
]

precompile = w3.eth.contract(address=PRECOMPILE, abi=PRECOMPILE_ABI)

# Build the call
merkle_proof_tuple = (merkle_root, siblings)
continuity_proof_tuple = (lower_endpoint, continuity_roots)

print(f"\n=== CALLING PRECOMPILE 0x0FD2 ===")

try:
    # First try eth_call (read-only) to check if proof verifies
    result = precompile.functions.verifyAndEmit(
        chain_key,
        [block_num],
        [tx_bytes],
        [merkle_proof_tuple],
        continuity_proof_tuple
    ).call({'from': account.address})
    
    print(f"✅ PROOF VERIFIED! Query ID: 0x{result.hex()}")
    
    # Now send the actual transaction
    print(f"\nSending on-chain verification transaction...")
    tx = precompile.functions.verifyAndEmit(
        chain_key,
        [block_num],
        [tx_bytes],
        [merkle_proof_tuple],
        continuity_proof_tuple
    ).build_transaction({
        'from': account.address,
        'nonce': w3.eth.get_transaction_count(account.address),
        'gas': 800000,
        'gasPrice': w3.eth.gas_price,
        'chainId': 102031,
    })
    
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"TX sent: {tx_hash.hex()}")
    
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)
    print(f"TX mined! Block: {receipt.blockNumber}, Status: {receipt.status}")
    print(f"Gas used: {receipt.gasUsed}")
    print(f"Explorer: https://creditcoin-testnet.blockscout.com/tx/{tx_hash.hex()}")
    
except Exception as e:
    print(f"Error: {e}")
    # Try with higher gas or different approach
    import traceback
    traceback.print_exc()
