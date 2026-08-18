#!/usr/bin/env python3
"""Call saveVerifiedRiskReport to increment verifiedProofCount on the contract."""
import json, os, sys
sys.path.insert(0, '/Users/stepchik/.gemini/antigravity/scratch/hakatons/backend')

from web3 import Web3

RPC = "https://rpc.cc3-testnet.creditcoin.network"
w3 = Web3(Web3.HTTPProvider(RPC))

for line in open('/Users/stepchik/.gemini/antigravity/scratch/hakatons/backend/.env'):
    if line.startswith('PRIVATE_KEY='):
        PK = line.strip().split('=',1)[1].strip('"').strip("'")
        break

account = w3.eth.account.from_key(PK)
print(f"Account: {account.address}, Balance: {w3.eth.get_balance(account.address) / 1e18:.4f} CTC")

CONTRACT = "0x7eda50D76067D0e9E78822D5581AA31D084c5C2f"
ABI = json.loads('[{"inputs":[{"internalType":"uint32","name":"_sourceChainId","type":"uint32"},{"internalType":"bytes","name":"_proof","type":"bytes"},{"internalType":"bytes","name":"_txData","type":"bytes"},{"internalType":"address","name":"_assetAddress","type":"address"},{"internalType":"uint8","name":"_overallScore","type":"uint8"},{"internalType":"uint8","name":"_liquidity","type":"uint8"},{"internalType":"uint8","name":"_collateral","type":"uint8"},{"internalType":"uint8","name":"_auditScore","type":"uint8"},{"internalType":"uint8","name":"_security","type":"uint8"},{"internalType":"uint8","name":"_volatility","type":"uint8"},{"internalType":"uint8","name":"_governance","type":"uint8"},{"internalType":"bytes32","name":"_dataHash","type":"bytes32"}],"name":"saveVerifiedRiskReport","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"reportCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"verifiedProofCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}]')

contract = w3.eth.contract(address=CONTRACT, abi=ABI)
print(f"BEFORE: reportCount={contract.functions.reportCount().call()}, verifiedProofCount={contract.functions.verifiedProofCount().call()}")

# Load proof
proof = json.load(open('/Users/stepchik/.gemini/antigravity/scratch/hakatons/proof_data.json'))
block_num = proof['fromHeader']
merkle_data = proof['merkleProofs'][str(block_num)]
tx_key = list(merkle_data.keys())[0]
tx_proof = merkle_data[tx_key]
tx_bytes = bytes.fromhex(tx_proof['txBytes'][2:])
merkle_root = bytes.fromhex(tx_proof['merkleProof']['root'][2:])
lower_endpoint = bytes.fromhex(proof['continuityProof']['lowerEndpointDigest'][2:])
proof_bytes = merkle_root + lower_endpoint

# Get live Aave data
import urllib.request
req = urllib.request.Request(
    "https://backend-lilac-nine-97.vercel.app/api/analyze",
    data=json.dumps({"address": "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9"}).encode(),
    headers={"Content-Type": "application/json"}, method="POST"
)
result = json.loads(urllib.request.urlopen(req, timeout=15).read())
data_hash = bytes.fromhex(result["data_hash"][2:])
aave_addr = Web3.to_checksum_address("0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9")

print(f"Aave score={result['score']}, hash={result['data_hash'][:20]}...")

fn = contract.functions.saveVerifiedRiskReport(
    1, proof_bytes, tx_bytes, aave_addr,
    result["score"], result["liquidity"], result["collateral"], result["audit"],
    result["security"], result["volatility_score"], result["governance"], data_hash
)
tx = fn.build_transaction({
    'from': account.address, 'nonce': w3.eth.get_transaction_count(account.address),
    'gas': 500000, 'gasPrice': w3.eth.gas_price, 'chainId': 102031,
})
signed = account.sign_transaction(tx)
tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
print(f"TX: 0x{tx_hash.hex()}")
receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)
print(f"Mined! Block: {receipt.blockNumber}, Status: {receipt.status}, Gas: {receipt.gasUsed}")
print(f"https://creditcoin-testnet.blockscout.com/tx/0x{tx_hash.hex()}")
print(f"AFTER: reportCount={contract.functions.reportCount().call()}, verifiedProofCount={contract.functions.verifiedProofCount().call()}")
