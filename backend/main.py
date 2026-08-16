import os
import re
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
import hashlib, time, urllib.request, json, math
import logging
from web3 import Web3

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="CreditPulse AI Engine")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware, 
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","), 
    allow_credentials=True, 
    allow_methods=["*"], 
    allow_headers=["*"]
)

class AnalyzeRequest(BaseModel):
    address: str

    @validator('address')
    def validate_address(cls, v):
        if not re.match(r"^0x[a-fA-F0-9]{40}$", v):
            raise ValueError('Invalid Ethereum address')
        return v

def fetch_defillama_data():
    url = "https://api.llama.fi/protocols"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            return data
    except Exception as e:
        logger.error(f"Error fetching DeFiLlama data: {e}")
        return None

def find_protocol(protocols, address):
    if not protocols:
        return None
    addr_lower = address.lower()
    for p in protocols:
        if addr_lower in p.get("slug", "").lower() or \
           addr_lower in p.get("name", "").lower() or \
           addr_lower == str(p.get("address", "")).lower():
            return p
    return None

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/api/health")
def api_health():
    return {"status": "ok"}

@app.post("/analyze")
@limiter.limit("5/minute")
def analyze(request: Request, req: AnalyzeRequest):
    return process_analysis(req.address)

@app.post("/api/analyze")
@limiter.limit("5/minute")
def api_analyze(request: Request, req: AnalyzeRequest):
    return process_analysis(req.address)

def process_analysis(address: str):
    addr_hash = int(hashlib.sha256(address.lower().encode()).hexdigest(), 16)
    
    protocols = fetch_defillama_data()
    protocol = find_protocol(protocols, address)
    
    market_benchmark = 0
    protocol_name = "Unknown"
    
    if protocol:
        protocol_name = protocol.get("name", "Unknown")
        tvl = protocol.get("tvl", 0)
        market_benchmark = tvl
        
        # 1. Liquidity based on TVL compared to market
        if tvl > 0:
            liquidity = min(100, max(0, int(math.log10(tvl) * 10)))
        else:
            liquidity = 10
            
        # 2. Collateral based on category and TVL stability
        category = protocol.get("category", "")
        change_1d = protocol.get("change_1d")
        change_7d = protocol.get("change_7d")
        
        collateral_base = 50
        if category.lower() in ["lending", "cdp", "rwa"]:
            collateral_base = 85
        elif category.lower() in ["dex", "bridge"]:
            collateral_base = 65
            
        collateral = collateral_base
        if change_7d is not None:
            collateral -= min(40, int(abs(change_7d)))
            
        collateral = min(100, max(0, collateral))
        
        # 3. Security based on audits, chains
        audits = protocol.get("audits", "0")
        chains = protocol.get("chains", [])
        
        security_base = 40
        if audits not in ["0", "2", None, False, ""]:
            security_base += 30
        security_base += min(30, len(chains) * 5)
        security = min(100, max(0, security_base))
        
        # 4. Volatility based on TVL change percentages
        volatility_score = 100
        if change_1d is not None:
            volatility_score -= int(abs(change_1d) * 3)
        if change_7d is not None:
            volatility_score -= int(abs(change_7d) * 1.5)
        volatility_score = min(100, max(0, volatility_score))
        
        # 5. Governance based on category
        gov_base = 40
        if category.lower() in ["lending", "dex", "yield farming"]:
            gov_base = 75
        governance = min(100, max(0, gov_base))
        
        # 6. Audit based on whether protocol is established
        audit = 85 if audits not in ["0", "2", None, False, ""] else 30
        
    else:
        # Unknown protocol - penalize score significantly
        liquidity = 15
        collateral = 20
        security = 10
        volatility_score = 30
        governance = 10
        audit = 10

    overall = round((liquidity + collateral + security + volatility_score + governance + audit) / 6)
    
    if overall >= 80:
        verdict = 'LOW RISK — Institutional grade'
    elif overall >= 60:
        verdict = 'MODERATE RISK — Due diligence recommended'
    elif overall >= 40:
        verdict = 'HIGH RISK — Significant concerns identified'
    else:
        verdict = 'CRITICAL RISK — Not recommended'
        
    return {
        "score": overall,
        "liquidity": liquidity,
        "collateral": collateral,
        "security": security,
        "volatility_score": volatility_score,
        "governance": governance,
        "audit": audit,
        "rwa_type": "Digital Asset" if protocol else "Unknown/Unverified",
        "verdict": verdict,
        "market_benchmark": market_benchmark,
        "protocol_name": protocol_name,
        "unverified": not bool(protocol)
    }

# --- Blockchain recording ---
RPC_URL = os.getenv("RPC_URL", "https://rpc.cc3-testnet.creditcoin.network")
PRIVATE_KEY = os.getenv("PRIVATE_KEY")
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS", "0xa3AD1879Af301B7c158ff9844541BA0Ca8Eb353b")
CONTRACT_ABI = json.loads('[{"inputs":[{"internalType":"string","name":"_assetAddress","type":"string"},{"internalType":"uint256","name":"_overallScore","type":"uint256"},{"internalType":"uint256","name":"_liquidity","type":"uint256"},{"internalType":"uint256","name":"_collateral","type":"uint256"},{"internalType":"uint256","name":"_auditScore","type":"uint256"}],"name":"saveRiskReport","outputs":[],"stateMutability":"nonpayable","type":"function"}]')

class RecordRequest(BaseModel):
    address: str
    score: int
    liquidity: int
    collateral: int
    audit: int

    @validator('address')
    def validate_address(cls, v):
        if not re.match(r"^0x[a-fA-F0-9]{40}$", v):
            raise ValueError('Invalid Ethereum address')
        return v

@app.post("/record")
@limiter.limit("2/minute")
def record(request: Request, req: RecordRequest):
    return process_record(req)

@app.post("/api/record")
@limiter.limit("2/minute")
def api_record(request: Request, req: RecordRequest):
    return process_record(req)

def process_record(req: RecordRequest):
    if not PRIVATE_KEY:
        raise HTTPException(status_code=500, detail="Server misconfiguration: missing private key")
    try:
        w3 = Web3(Web3.HTTPProvider(RPC_URL))
        account = w3.eth.account.from_key(PRIVATE_KEY)
        contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=CONTRACT_ABI)
        
        nonce = w3.eth.get_transaction_count(account.address, 'pending')
        tx = contract.functions.saveRiskReport(
            req.address, req.score, req.liquidity, req.collateral, req.audit
        ).build_transaction({
            'from': account.address,
            'nonce': nonce,
            'gas': 300000,
            'gasPrice': w3.to_wei('20', 'gwei'),
            'chainId': 102031,
        })
        
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        
        return {
            "success": True,
            "txHash": "0x" + tx_hash.hex() if not tx_hash.hex().startswith("0x") else tx_hash.hex(),
            "status": "pending",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tx-status/{tx_hash}")
@app.get("/api/tx-status/{tx_hash}")
def get_tx_status(tx_hash: str):
    try:
        w3 = Web3(Web3.HTTPProvider(RPC_URL))
        try:
            receipt = w3.eth.get_transaction_receipt(tx_hash)
            if receipt is not None:
                return {"status": "confirmed", "blockNumber": receipt.blockNumber}
            return {"status": "pending"}
        except Exception:
            return {"status": "pending"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
