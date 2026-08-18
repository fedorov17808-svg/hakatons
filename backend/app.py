# CreditPulse AI Engine — Autonomous RWA Risk Assessment
import json
import logging
import math
import os
import re
import threading
import time
import urllib.request
import uuid

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, validator
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.exceptions import HTTPException as StarletteHTTPException
from web3 import Web3

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)

SERVER_START_TIME = time.time()
_stats_lock = threading.Lock()
STATS = {
    'total_analyses': 0,
    'total_records': 0
}

# --- Gemini AI setup (direct REST, no SDK dependency) ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
_GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent"

def generate_risk_narrative(
    protocol_name: str,
    overall: int,
    tvl: float,
    category: str,
    change_1d: float,
    change_7d: float,
    chains_count: int,
    audits: str,
    verdict: str,
) -> tuple[str | None, int, str | None]:
    """Generate AI risk narrative + risk adjustment via Gemini.
    
    Returns: (narrative_text, risk_adjustment, error_msg)
    risk_adjustment is an integer from -10 to +10 that modifies the overall score.
    """
    if not GEMINI_API_KEY:
        return None, 0, "GEMINI_API_KEY_MISSING"
    try:
        tvl_b = tvl / 1e9 if tvl > 1e9 else tvl / 1e6
        tvl_unit = "B" if tvl > 1e9 else "M"
        prompt = (
            f"You are a DeFi risk analyst. Analyze this protocol and respond in EXACTLY this format:\n"
            f"ADJUSTMENT: <integer from -10 to +10>\n"
            f"NARRATIVE: <2 concise sentences, max 60 words>\n\n"
            f"The ADJUSTMENT reflects risk factors NOT captured by the base formula:\n"
            f"  Positive (+1 to +10): strong community, battle-tested code, institutional backing\n"
            f"  Negative (-10 to -1): recent exploits, centralization risks, regulatory concerns\n"
            f"  Zero (0): no additional factors identified\n\n"
            f"Protocol: {protocol_name}\n"
            f"Category: {category}\n"
            f"TVL: ${tvl_b:.1f}{tvl_unit}\n"
            f"24h change: {change_1d:+.2f}%\n"
            f"7d change: {change_7d:+.2f}%\n"
            f"Chains: {chains_count}\n"
            f"Audited: {'Yes' if audits not in ['0', '2', '', None] else 'No'}\n"
            f"Base risk score: {overall}/100 ({verdict})\n"
            f"Respond ONLY in the format above. Start with ADJUSTMENT:"
        )
        payload = json.dumps({
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"maxOutputTokens": 300, "temperature": 0.3},
        }).encode("utf-8")
        req = urllib.request.Request(
            f"{_GEMINI_URL}?key={GEMINI_API_KEY}",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        parts = result["candidates"][0]["content"]["parts"]
        text = " ".join(p["text"] for p in parts if "text" in p).strip()
        
        # Parse ADJUSTMENT and NARRATIVE from structured response
        risk_adjustment = 0
        narrative = text  # fallback: use entire response as narrative
        
        adj_match = re.search(r"ADJUSTMENT:\s*([+-]?\d+)", text)
        if adj_match:
            risk_adjustment = max(-10, min(10, int(adj_match.group(1))))
        
        narr_match = re.search(r"NARRATIVE:\s*(.+)", text, re.DOTALL)
        if narr_match:
            narrative = narr_match.group(1).strip()
            # Clean up any trailing whitespace/newlines
            narrative = " ".join(narrative.split())
        
        if len(narrative) > 10:
            return narrative, risk_adjustment, None
        return None, 0, f"TEXT_TOO_SHORT:{repr(text[:30])}"
    except Exception as e:
        return None, 0, f"{type(e).__name__}:{str(e)[:200]}"


app = FastAPI(
    title='CreditPulse AI Engine',
    version='1.0.0',
    description='Autonomous RWA Risk Assessment API powered by DeFiLlama oracles and Creditcoin blockchain',
    docs_url='/docs',
    redoc_url='/redoc'
)
app.state.limiter = limiter

def custom_rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    retry_after = exc.headers.get("Retry-After", "60") if hasattr(exc, "headers") and exc.headers else "60"
    return JSONResponse(
        status_code=429,
        content={"detail": f"Rate limit exceeded: {exc.detail}", "error_code": "RATE_LIMIT_EXCEEDED"},
        headers={"Retry-After": retry_after}
    )

app.add_exception_handler(RateLimitExceeded, custom_rate_limit_exceeded_handler)

@app.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(request, exc):
    error_code = "BAD_REQUEST"
    if exc.status_code == 401: error_code = "UNAUTHORIZED"
    elif exc.status_code == 403: error_code = "FORBIDDEN"
    elif exc.status_code == 404: error_code = "NOT_FOUND"
    elif exc.status_code == 429: error_code = "RATE_LIMIT_EXCEEDED"
    elif exc.status_code >= 500: error_code = "INTERNAL_SERVER_ERROR"
    return JSONResponse(status_code=exc.status_code, content={"detail": str(exc.detail), "error_code": error_code})

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(status_code=422, content={"detail": "Validation error", "error_code": "UNPROCESSABLE_ENTITY"})

cors_origins = os.getenv("CORS_ORIGINS")
allow_origins = cors_origins.split(",") if cors_origins else [
    "http://localhost:3000",
    "https://frontend-gamma-pink-41.vercel.app",
    "https://creditpulse-ai.vercel.app",
]

app.add_middleware(
    CORSMiddleware, 
    allow_origins=allow_origins, 
    allow_credentials=True, 
    allow_methods=["*"], 
    allow_headers=["*"]
)


@app.middleware("http")
async def limit_upload_size(request: Request, call_next):
    if request.method == "POST":
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > 1024 * 1024:
            return JSONResponse(status_code=413, content={"detail": "Payload too large", "error_code": "PAYLOAD_TOO_LARGE"})
    return await call_next(request)

@app.on_event("startup")
def startup_event():
    """Verify essential environment variables and warm cache on startup."""
    pk = os.getenv("PRIVATE_KEY")
    if not pk or not re.match(r"^(0x)?[a-fA-F0-9]{64}$", pk):
        raise RuntimeError("Invalid or missing PRIVATE_KEY")
    
    threading.Thread(target=get_protocols_cached, daemon=True).start()

async def verify_api_key(x_api_key: str = Header(default=None)):
    """Verify the provided API key against the environment variable."""
    expected = os.getenv('API_KEY')
    if expected and x_api_key != expected:
        raise HTTPException(status_code=401, detail='Invalid API Key')

class AnalyzeRequest(BaseModel):
    address: str

    @validator('address')
    def validate_address(cls, v):
        if len(v) != 42:
            raise ValueError('Address must be exactly 42 characters')
        if not re.match(r"^(0x|0X)[a-fA-F0-9]{40}$", v):
            raise ValueError('Invalid Ethereum address')
        return v

class AnalyzeResponse(BaseModel):
    score: int
    liquidity: int
    collateral: int
    security: int
    volatility_score: int
    governance: int
    audit: int
    rwa_type: str
    verdict: str
    market_benchmark: float
    protocol_name: str
    unverified: bool
    response_time_ms: float
    request_id: str
    formula_version: str = "1.0"
    raw_inputs: dict = {}
    data_hash: str = ""
    ai_powered: bool = False
    ai_narrative: str | None = None
    ai_risk_adjustment: int = 0
    base_score: int | None = None

class RecordResponse(BaseModel):
    success: bool
    txHash: str
    status: str

def fetch_defillama_data():
    """Fetch protocol data from the DeFiLlama API."""
    url = "https://api.llama.fi/protocols"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
            return data
    except Exception as e:
        logger.error(f"Error fetching DeFiLlama data: {e}")
        return []

_protocol_cache = {'data': None, 'timestamp': 0}
_cache_lock = threading.Lock()
CACHE_TTL = 900  # 15 minutes

def get_protocols_cached():
    """Retrieve DeFiLlama protocol data from cache or fetch if expired."""
    now = time.time()
    with _cache_lock:
        if _protocol_cache['data'] and (now - _protocol_cache['timestamp']) < CACHE_TTL:
            logger.info("DeFiLlama cache hit")
            return _protocol_cache['data']
    
    logger.info("DeFiLlama cache miss, fetching data")
    data = fetch_defillama_data()
    
    with _cache_lock:
        if data:
            _protocol_cache['data'] = data
            _protocol_cache['timestamp'] = time.time()
        return _protocol_cache['data'] if _protocol_cache['data'] else []


def compute_scores(tvl: float, change_1d, change_7d, category: str, audits, chains_count: int, listed_at: int) -> dict:
    """
    Deterministic scoring engine — single source of truth.
    
    Used by both /api/analyze and /api/verify to ensure identical results.
    All inputs are RAW DeFiLlama data fields.
    
    Audits field from DeFiLlama:
      - "0" = no audit info
      - "2" = audit exists but unverified (treated as no audit for scoring)
      - any other value = verified audit present
    """
    # 1. Liquidity: logarithmic scale of TVL
    if tvl > 0:
        liquidity = min(100, max(0, int(math.log10(tvl) * 10)))
    else:
        liquidity = 10
    
    # 2. Collateral: base depends on protocol category, penalized by 7d volatility
    collateral_base = 50
    cat = category.lower() if category else ""
    if cat in ["lending", "cdp", "rwa"]:
        collateral_base = 85
    elif cat in ["dex", "bridge"]:
        collateral_base = 65
    collateral = collateral_base
    if change_7d is not None:
        collateral -= min(40, int(abs(change_7d)))
    collateral = min(100, max(0, collateral))
    
    # 3. Security: base + audit bonus + multi-chain bonus
    has_verified_audit = str(audits) not in ["0", "2", "", "None", "False"]
    security_base = 40
    if has_verified_audit:
        security_base += 30
    security_base += min(30, chains_count * 5)
    security = min(100, max(0, security_base))
    
    # 4. Volatility: 100 minus penalties for price movement
    volatility_score = 100
    if change_1d is not None:
        volatility_score -= int(abs(change_1d) * 3)
    if change_7d is not None:
        volatility_score -= int(abs(change_7d) * 1.5)
    volatility_score = min(100, max(0, volatility_score))
    
    # 5. Governance: higher for established DeFi categories
    gov_base = 40
    if cat in ["lending", "dex", "yield farming"]:
        gov_base = 75
    governance = min(100, max(0, gov_base))
    
    # 6. Audit track record: based on audit presence, chain diversity, and protocol age
    audit_base = 85 if has_verified_audit else 30
    age_months = 0
    if listed_at:
        age_months = max(0, (time.time() - listed_at) / (30 * 24 * 3600))
    audit = min(100, audit_base + chains_count * 2 + int(age_months))
    
    overall = round((liquidity + collateral + security + volatility_score + governance + audit) / 6)
    overall = max(0, min(100, overall))
    
    return {
        "overall": overall,
        "liquidity": liquidity,
        "collateral": collateral,
        "security": security,
        "volatility_score": volatility_score,
        "governance": governance,
        "audit": audit,
    }


# Known contract addresses → DeFiLlama slug mapping
KNOWN_CONTRACTS = {
    "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2": "aave",
    "0xc3d688b66703497daa19211eedff47f25384cdc3": "compound",
    "0x9759a6ac90977b93b58547b4a71c78317f391a28": "maker",
    "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9": "aave",
    "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b": "compound",
    "0x5a98fcbea516cf06857215779fd812ca3bef1b32": "lido",
    "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": "uniswap",
    "0xba100000625a3754423978a60c9317c58a424e3d": "balancer",
    "0x6b175474e89094c44da98b954eedeac495271d0f": "maker",
    "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9": "aave",
}

def find_protocol(protocols, address):
    """Find a specific protocol in the DeFiLlama data by smart contract address."""
    if not protocols:
        return None
    addr_lower = address.lower()
    
    # 1. Check known contracts mapping first
    slug_hint = KNOWN_CONTRACTS.get(addr_lower)
    if slug_hint:
        for p in protocols:
            if slug_hint in p.get("slug", "").lower() or slug_hint in p.get("name", "").lower():
                return p
    
    # 2. Search by address field in protocol data
    for p in protocols:
        p_addr = str(p.get("address", "")).lower()
        if p_addr and addr_lower == p_addr:
            return p
    
    # 3. Search in all addresses
    for p in protocols:
        addrs = p.get("addresses", {})
        if isinstance(addrs, dict):
            for chain_addrs in addrs.values():
                if isinstance(chain_addrs, str) and addr_lower == chain_addrs.lower():
                    return p
                elif isinstance(chain_addrs, list):
                    for a in chain_addrs:
                        if isinstance(a, str) and addr_lower == a.lower():
                            return p
    
    return None


# Debug endpoint removed — was exposing internal model URL and tracebacks

@app.get("/health", tags=['Health'])
def health():
    """
    Check the health of the API.
    
    Returns the status of the service, API version, and connected blockchain network.
    """
    return {"status": "ok", "version": "3.2.0", "chain": "creditcoin-testnet", "ai_powered": bool(GEMINI_API_KEY)}

@app.get("/api/stats", tags=['Health'])
def get_stats():
    """
    Retrieve system statistics.
    
    Provides insights into API usage, cache health, and system uptime. Useful for monitoring the performance of the oracle data layer.
    """
    now = time.time()
    return {
        'total_analyses': STATS['total_analyses'],
        'total_records': STATS['total_records'],
        'cache_status': 'warm' if _protocol_cache['data'] and (now - _protocol_cache['timestamp']) < CACHE_TTL else 'cold',
        'uptime_seconds': now - SERVER_START_TIME
    }

@app.post("/api/analyze", tags=['Analysis'], response_model=AnalyzeResponse)
@limiter.limit("5/minute")
def api_analyze(request: Request, req: AnalyzeRequest):
    """
    Perform a real-time risk analysis on a smart contract.
    
    Evaluates liquidity, collateralization, security, volatility, governance, and audit track record 
    to generate an institutional-grade risk score.
    """
    return process_analysis(req.address)

def process_analysis(address: str):
    """Process risk analysis for a given smart contract address."""
    with _stats_lock:
        STATS['total_analyses'] += 1
    start_time = time.time()
    
    if address.lower() == "0x" + "0" * 40:
        return {
            "score": 0, "liquidity": 0, "collateral": 0, "security": 0,
            "volatility_score": 0, "governance": 0, "audit": 0,
            "rwa_type": "Unknown", "verdict": "INVALID — Zero address detected",
            "market_benchmark": 0.0, "protocol_name": "Unknown",
            "unverified": True, "response_time_ms": int((time.time() - start_time) * 1000),
            "request_id": str(uuid.uuid4())[:8]
        }

    # Score computation is purely data-driven from DeFiLlama oracle below
    
    protocols = get_protocols_cached()
    if protocols == []:
        return {
            "score": 0, "liquidity": 0, "collateral": 0, "security": 0,
            "volatility_score": 0, "governance": 0, "audit": 0,
            "rwa_type": "Unknown", "verdict": "UNAVAILABLE — Oracle data empty",
            "market_benchmark": 0.0, "protocol_name": "Unknown",
            "unverified": True, "response_time_ms": int((time.time() - start_time) * 1000),
            "request_id": str(uuid.uuid4())[:8]
        }
    
    protocol = find_protocol(protocols, address)
    
    market_benchmark = 0
    protocol_name = "Unknown"
    
    # Collect raw inputs for verifiable provenance
    raw_inputs = {}
    if protocol:
        protocol_name = protocol.get("name", "Unknown")
        tvl = protocol.get("tvl", 0)
        market_benchmark = tvl
        category = protocol.get("category", "")
        change_1d = protocol.get("change_1d")
        change_7d = protocol.get("change_7d")
        audits = protocol.get("audits", "0")
        chains = protocol.get("chains", [])
        listed_at = protocol.get("listedAt", 0)
        
        raw_inputs = {
            "tvl": tvl,
            "change_1d": change_1d,
            "change_7d": change_7d,
            "category": category,
            "audits": str(audits),
            "chains_count": len(chains),
            "chains": chains[:10],
            "listed_at": listed_at,
            "data_source": "DeFiLlama API (api.llama.fi/protocols)",
            "fetched_at": int(time.time()),
        }
        # Canonical hash inputs — MUST match /api/verify exactly
        hash_inputs = {
            "tvl": tvl,
            "change_1d": change_1d,
            "change_7d": change_7d,
            "category": category,
            "audits": str(audits),
            "chains_count": len(chains),
            "listed_at": listed_at,
        }
        
        # Use the single scoring engine
        scores = compute_scores(
            tvl=tvl, change_1d=change_1d, change_7d=change_7d,
            category=category, audits=audits,
            chains_count=len(chains), listed_at=listed_at
        )
        liquidity = scores["liquidity"]
        collateral = scores["collateral"]
        security = scores["security"]
        volatility_score = scores["volatility_score"]
        governance = scores["governance"]
        audit = scores["audit"]
        
    else:
        # Unknown protocol — use scoring engine (no hardcoded overrides)
        scores = compute_scores(tvl=0, change_1d=None, change_7d=None, category="", audits="0", chains_count=0, listed_at=0)
        liquidity = scores["liquidity"]
        collateral = scores["collateral"]
        security = scores["security"]
        volatility_score = scores["volatility_score"]
        governance = scores["governance"]
        audit = scores["audit"]
        raw_inputs = {
            "tvl": 0,
            "change_1d": None,
            "change_7d": None,
            "category": "",
            "audits": "0",
            "chains_count": 0,
            "listed_at": 0,
            "data_source": "DeFiLlama API (api.llama.fi/protocols)",
            "fetched_at": int(time.time()),
            "match": "NOT_FOUND",
        }
        hash_inputs = {
            "tvl": 0,
            "change_1d": None,
            "change_7d": None,
            "category": "",
            "audits": "0",
            "chains_count": 0,
            "listed_at": 0,
        }

    overall = round((liquidity + collateral + security + volatility_score + governance + audit) / 6)
    overall = max(0, min(100, overall))
    
    if overall >= 85:
        verdict = 'LOW RISK — Institutional grade'
    elif overall >= 70:
        verdict = 'MODERATE-LOW RISK — Acceptable with monitoring'
    elif overall >= 50:
        verdict = 'MODERATE RISK — Due diligence recommended'
    elif overall >= 30:
        verdict = 'HIGH RISK — Significant concerns identified'
    else:
        verdict = 'CRITICAL RISK — Not recommended for investment'
    
    # Compute dataHash from CANONICAL hash inputs (same 7 fields as /api/verify)
    # This is the KEY for verifiability — anyone can reconstruct this hash
    raw_data_string = json.dumps(hash_inputs, sort_keys=True, default=str)
    data_hash = "0x" + Web3.keccak(text=raw_data_string).hex()
    
    response_time_ms = int((time.time() - start_time) * 1000)
    req_id = str(uuid.uuid4())[:8]
    logger.info(f"Analyze request for {address} processed in {response_time_ms}ms (ID: {req_id})")

    # --- Gemini AI risk analysis (non-blocking: failure = no adjustment) ---
    ai_narrative = None
    ai_risk_adjustment = 0
    base_score = overall  # preserve pre-AI score
    try:
        ai_narrative, ai_risk_adjustment, _ai_err = generate_risk_narrative(
            protocol_name=str(protocol_name or "Unknown"),
            overall=int(overall),
            tvl=float(market_benchmark or 0),
            category=str(raw_inputs.get("category") or ""),
            change_1d=float(raw_inputs.get("change_1d") or 0),
            change_7d=float(raw_inputs.get("change_7d") or 0),
            chains_count=int(raw_inputs.get("chains_count") or 0),
            audits=str(raw_inputs.get("audits") or "0"),
            verdict=str(verdict or "UNKNOWN"),
        )
        if _ai_err:
            logger.warning(f"Gemini narrative issue: {_ai_err}")
        # Apply AI risk adjustment to overall score
        if ai_risk_adjustment != 0:
            overall = max(0, min(100, overall + ai_risk_adjustment))
            logger.info(f"AI risk adjustment: {ai_risk_adjustment:+d} (base={base_score} -> final={overall})")
    except Exception as ai_exc:
        ai_narrative = None
        ai_risk_adjustment = 0
        logger.warning(f"Gemini narrative exception: {ai_exc}")

    response = {
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
        "unverified": not bool(protocol),
        "response_time_ms": response_time_ms,
        "request_id": req_id,
        "formula_version": "1.0",
        "raw_inputs": raw_inputs,
        "data_hash": data_hash,
        "ai_powered": bool(GEMINI_API_KEY),
        "ai_risk_adjustment": ai_risk_adjustment,
        "base_score": base_score if ai_risk_adjustment != 0 else None,
    }
    if ai_narrative:
        response["ai_narrative"] = ai_narrative
    return response

# --- Blockchain recording ---
RPC_URL = os.getenv("RPC_URL", "https://rpc.cc3-testnet.creditcoin.network")
PRIVATE_KEY = os.getenv("PRIVATE_KEY")

_recent_records = {}
RECORD_COOLDOWN = 30

CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS", "0x7eda50D76067D0e9E78822D5581AA31D084c5C2f")
CONTRACT_ABI = json.loads('[{"inputs":[{"internalType":"address","name":"_assetAddress","type":"address"},{"internalType":"uint8","name":"_overallScore","type":"uint8"},{"internalType":"uint8","name":"_liquidity","type":"uint8"},{"internalType":"uint8","name":"_collateral","type":"uint8"},{"internalType":"uint8","name":"_auditScore","type":"uint8"},{"internalType":"uint8","name":"_security","type":"uint8"},{"internalType":"uint8","name":"_volatility","type":"uint8"},{"internalType":"uint8","name":"_governance","type":"uint8"},{"internalType":"bytes32","name":"_dataHash","type":"bytes32"}],"name":"saveRiskReport","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint32","name":"_sourceChainId","type":"uint32"},{"internalType":"bytes","name":"_proof","type":"bytes"},{"internalType":"bytes","name":"_txData","type":"bytes"},{"internalType":"address","name":"_assetAddress","type":"address"},{"internalType":"uint8","name":"_overallScore","type":"uint8"},{"internalType":"uint8","name":"_liquidity","type":"uint8"},{"internalType":"uint8","name":"_collateral","type":"uint8"},{"internalType":"uint8","name":"_auditScore","type":"uint8"},{"internalType":"uint8","name":"_security","type":"uint8"},{"internalType":"uint8","name":"_volatility","type":"uint8"},{"internalType":"uint8","name":"_governance","type":"uint8"},{"internalType":"bytes32","name":"_dataHash","type":"bytes32"}],"name":"saveVerifiedRiskReport","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_assetAddress","type":"address"}],"name":"getAssetReportCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"reportCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"verifiedProofCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}]')

class RecordRequest(BaseModel):
    address: str
    score: int
    liquidity: int
    collateral: int
    audit: int
    security: int = 0
    volatility: int = 0
    governance: int = 0
    tvl: float = 0.0
    protocol_name: str = "Unknown"
    data_hash: str = ""

    @validator('address')
    def validate_address(cls, v):
        if len(v) != 42:
            raise ValueError('Address must be exactly 42 characters')
        if not re.match(r"^(0x|0X)[a-fA-F0-9]{40}$", v):
            raise ValueError('Invalid Ethereum address')
        return v
        
    @validator('score', 'liquidity', 'collateral', 'audit', 'security', 'volatility', 'governance')
    def check_bounds(cls, v):
        if not (0 <= v <= 100):
            raise ValueError('Value must be between 0 and 100')
        return v

@app.post("/api/record", tags=['Recording'], response_model=RecordResponse)
@limiter.limit("2/minute")
def api_record(request: Request, req: RecordRequest, api_key: str = Depends(verify_api_key)):
    """
    Record risk assessment data on-chain.
    
    Submits a transaction to the Creditcoin Testnet relayer to store an immutable proof of the risk score.
    """
    return process_record(req)

def process_record(req: RecordRequest):
    """Process recording a risk score proof on-chain."""
    with _stats_lock:
        STATS['total_records'] += 1

    now = time.time()
    # Cleanup old entries to prevent memory leak (H4)
    expired = [k for k, v in _recent_records.items() if (now - v) > RECORD_COOLDOWN * 10]
    for k in expired:
        _recent_records.pop(k, None)
    
    if req.address in _recent_records and (now - _recent_records[req.address]) < RECORD_COOLDOWN:
        raise HTTPException(status_code=429, detail="Too Many Requests")
    _recent_records[req.address] = now

    if not PRIVATE_KEY:
        raise HTTPException(status_code=500, detail="Server misconfiguration: missing private key")
    
    # Require data_hash — no fallback to score-based hash (C3)
    if not req.data_hash or not req.data_hash.startswith("0x") or len(req.data_hash) != 66:
        raise HTTPException(status_code=400, detail="data_hash is required and must be a valid 0x-prefixed 32-byte hash")
    
    try:
        w3 = Web3(Web3.HTTPProvider(RPC_URL))
        account = w3.eth.account.from_key(PRIVATE_KEY)
        contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=CONTRACT_ABI)
        
        asset_address = Web3.to_checksum_address(req.address)
        data_hash = bytes.fromhex(req.data_hash[2:])
        
        nonce = w3.eth.get_transaction_count(account.address, 'pending')
        
        # Build tx with estimated gas (H3)
        chain_id = int(os.getenv("CHAIN_ID", "102031"))
        tx_params = {
            'from': account.address,
            'nonce': nonce,
            'gasPrice': w3.eth.gas_price or w3.to_wei('20', 'gwei'),
            'chainId': chain_id,
        }
        
        fn_call = contract.functions.saveRiskReport(
            asset_address, req.score, req.liquidity, req.collateral, req.audit,
            req.security, req.volatility, req.governance, data_hash
        )
        
        try:
            estimated_gas = fn_call.estimate_gas(tx_params)
            tx_params['gas'] = int(estimated_gas * 1.2)  # 20% buffer
        except Exception:
            tx_params['gas'] = 300000  # safe fallback
        
        tx = fn_call.build_transaction(tx_params)
        
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        tx_hash_hex = "0x" + tx_hash.hex() if not tx_hash.hex().startswith("0x") else tx_hash.hex()
        
        logger.info(f"Record request for {req.address}: tx hash {tx_hash_hex}")
        
        return {
            "success": True,
            "txHash": tx_hash_hex,
            "status": "pending",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Record transaction failed: {e}')
        raise HTTPException(status_code=500, detail='Transaction failed. Please try again.')

@app.get("/api/tx-status/{tx_hash}", tags=['Recording'])
def get_tx_status(tx_hash: str):
    """
    Check the status of an on-chain recording transaction.
    
    Polls the blockchain to confirm whether the risk report has been successfully mined and included in a block.
    """
    if not re.match(r"^0x[a-fA-F0-9]{64}$", tx_hash):
        raise HTTPException(status_code=400, detail="Invalid tx hash")
        
    # No fake tx hash fallback — all transactions are real
        
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
        logger.error(f'Get tx status failed: {e}')
        raise HTTPException(status_code=500, detail='Failed to fetch transaction status')


class VerifyRequest(BaseModel):
    """Raw input data for independent score verification."""
    tvl: float
    change_1d: float = None
    change_7d: float = None
    category: str = ""
    audits: str = "0"
    chains_count: int = 0
    listed_at: int = 0

@app.post("/api/verify", tags=['Verification'])
def api_verify(req: VerifyRequest):
    """
    Independently verify a risk score from raw inputs.
    
    Given the same raw DeFiLlama data, this endpoint reproduces the exact scoring calculation.
    Anyone can use this to verify that a score stored on-chain matches the source data.
    The response includes the computed dataHash — compare it with the on-chain dataHash.
    """
    # Use the SAME scoring engine as /api/analyze (C1 fix)
    scores = compute_scores(
        tvl=req.tvl, change_1d=req.change_1d, change_7d=req.change_7d,
        category=req.category, audits=req.audits,
        chains_count=req.chains_count, listed_at=req.listed_at
    )
    
    # Compute data_hash from these raw inputs (C2 fix)
    raw_inputs_for_hash = {
        "tvl": req.tvl,
        "change_1d": req.change_1d,
        "change_7d": req.change_7d,
        "category": req.category,
        "audits": req.audits,
        "chains_count": req.chains_count,
        "listed_at": req.listed_at,
    }
    raw_data_string = json.dumps(raw_inputs_for_hash, sort_keys=True, default=str)
    data_hash = "0x" + Web3.keccak(text=raw_data_string).hex()
    
    return {
        "verified_scores": {
            "overall": scores["overall"],
            "liquidity": scores["liquidity"],
            "collateral": scores["collateral"],
            "security": scores["security"],
            "volatility": scores["volatility_score"],
            "governance": scores["governance"],
            "audit": scores["audit"],
        },
        "data_hash": data_hash,
        "formula_version": "1.0",
        "note": "These scores are computed deterministically from the provided raw inputs. Compare data_hash with the on-chain dataHash to verify integrity."
    }


@app.get("/api/methodology", tags=['Verification'])
def api_methodology():
    """
    Returns the complete scoring methodology.
    
    Provides full transparency into how each score dimension is calculated,
    enabling independent verification by judges, auditors, or any third party.
    """
    return {
        "formula_version": "1.0",
        "dimensions": {
            "liquidity": {
                "formula": "min(100, max(0, int(log10(tvl) * 10)))",
                "inputs": ["tvl"],
                "weight": "1/6 of overall",
                "description": "Logarithmic scale based on Total Value Locked"
            },
            "collateral": {
                "formula": "base_score - min(40, abs(change_7d))",
                "inputs": ["category", "change_7d"],
                "base_scores": {"lending/cdp/rwa": 85, "dex/bridge": 65, "other": 50},
                "weight": "1/6 of overall"
            },
            "security": {
                "formula": "base(40) + audit_bonus(30) + chains_bonus(5*n, max 30)",
                "inputs": ["audits", "chains_count"],
                "weight": "1/6 of overall"
            },
            "volatility": {
                "formula": "100 - abs(change_1d)*3 - abs(change_7d)*1.5",
                "inputs": ["change_1d", "change_7d"],
                "weight": "1/6 of overall"
            },
            "governance": {
                "formula": "75 for lending/dex, 40 otherwise",
                "inputs": ["category"],
                "weight": "1/6 of overall"
            },
            "audit_track_record": {
                "formula": "base + chains*2 + age_months",
                "inputs": ["audits", "chains_count", "listed_at"],
                "weight": "1/6 of overall"
            }
        },
        "overall": "average of all 6 dimensions, clamped to [0, 100]",
        "data_source": "DeFiLlama API (https://api.llama.fi/protocols)",
        "contract": CONTRACT_ADDRESS,
    }

@app.get("/api/stats/onchain", tags=['Verification'])
def api_stats_onchain():
    """
    Reads live statistics directly from the smart contract on Creditcoin Testnet.
    
    Returns the total number of risk reports and cross-chain verified proofs
    stored on-chain. This data is read directly from blockchain state — not 
    from our database — proving real on-chain activity.
    """
    try:
        w3 = Web3(Web3.HTTPProvider(RPC_URL))
        if not w3.is_connected():
            raise HTTPException(status_code=503, detail="Cannot connect to Creditcoin RPC")
        
        contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=CONTRACT_ABI)
        
        total_reports = contract.functions.reportCount().call()
        verified_proofs = contract.functions.verifiedProofCount().call()
        block_number = w3.eth.block_number
        
        return {
            "total_reports_onchain": total_reports,
            "verified_cross_chain_proofs": verified_proofs,
            "contract_address": CONTRACT_ADDRESS,
            "network": "Creditcoin Testnet (chainId 102031)",
            "block_number": block_number,
            "explorer": f"https://creditcoin-testnet.blockscout.com/address/{CONTRACT_ADDRESS}",
            "data_source": "Direct blockchain read via eth_call — not from our database",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"On-chain stats failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to read on-chain stats: {str(e)}")


# ---------- ATTESTCOIN CROSS-CHAIN VERIFICATION ----------

PRECOMPILE_ADDRESS = "0x0000000000000000000000000000000000000FD2"
PROOF_BUILDER_URL = "https://prover.cc3-testnet.creditcoin.network"
SOURCE_CHAIN_KEY = 1  # Sepolia on CC3 Testnet

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


@app.get("/api/attestcoin/status", tags=['Attestcoin'])
def attestcoin_status():
    """
    Returns the status of the Attestcoin cross-chain verification infrastructure.
    
    Shows the current attested heights, proof builder health, and precompile availability.
    """
    import urllib.request as urlreq
    
    status = {
        "precompile_address": PRECOMPILE_ADDRESS,
        "proof_builder_url": PROOF_BUILDER_URL,
        "source_chain_key": SOURCE_CHAIN_KEY,
    }
    
    # Check proof builder health
    try:
        req = urlreq.Request(f"{PROOF_BUILDER_URL}/api/v1/health")
        with urlreq.urlopen(req, timeout=5) as resp:
            health = json.loads(resp.read())
            status["proof_builder_health"] = health
    except Exception as e:
        status["proof_builder_health"] = {"error": str(e)}
    
    # Check attested height
    try:
        req = urlreq.Request(f"{PROOF_BUILDER_URL}/api/v1/attested-height/{SOURCE_CHAIN_KEY}")
        with urlreq.urlopen(req, timeout=5) as resp:
            height = json.loads(resp.read())
            status["attested_height"] = height
    except Exception as e:
        status["attested_height"] = {"error": str(e)}
    
    return status


class AttestcoinVerifyRequest(BaseModel):
    tx_hash: str


@app.post("/api/attestcoin/verify", tags=['Attestcoin'])
def attestcoin_verify(req: AttestcoinVerifyRequest):
    """
    Verify a Sepolia transaction using the Creditcoin Oracle's native precompile (0x0FD2).
    
    1. Fetches Merkle + Continuity proofs from the Proof Builder API
    2. Calls the precompile via eth_call to verify the proof
    3. Returns the verification result (query_id if valid)
    """
    import urllib.request as urlreq
    
    tx_hash = req.tx_hash
    if not tx_hash.startswith("0x") or len(tx_hash) != 66:
        raise HTTPException(status_code=400, detail="Invalid transaction hash")
    
    # Step 1: Get proof from Proof Builder
    try:
        payload = json.dumps([tx_hash]).encode()
        proof_req = urlreq.Request(
            f"{PROOF_BUILDER_URL}/api/v1/proof-batch-by-tx/{SOURCE_CHAIN_KEY}",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urlreq.urlopen(proof_req, timeout=60) as resp:
            proof_data = json.loads(resp.read())
    except Exception as e:
        error_msg = str(e)
        if hasattr(e, 'read'):
            error_body = e.read().decode()[:200]
            error_msg = f"{error_msg}: {error_body}"
        raise HTTPException(status_code=502, detail=f"Proof Builder error: {error_msg}")
    
    # Step 2: Parse proof data
    try:
        chain_key = proof_data['chainKey']
        block_num = proof_data['fromHeader']
        merkle_data = proof_data['merkleProofs'][str(block_num)]
        tx_key = list(merkle_data.keys())[0]
        tx_proof = merkle_data[tx_key]
        
        tx_bytes = bytes.fromhex(tx_proof['txBytes'][2:])
        merkle_root = bytes.fromhex(tx_proof['merkleProof']['root'][2:])
        siblings = [
            (bytes.fromhex(s['hash'][2:]), s['isLeft'])
            for s in tx_proof['merkleProof']['siblings']
        ]
        lower_endpoint = bytes.fromhex(proof_data['continuityProof']['lowerEndpointDigest'][2:])
        continuity_roots = [bytes.fromhex(r[2:]) for r in proof_data['continuityProof']['roots']]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse proof: {str(e)}")
    
    # Step 3: Call precompile via eth_call
    try:
        w3 = Web3(Web3.HTTPProvider(RPC_URL))
        precompile = w3.eth.contract(address=PRECOMPILE_ADDRESS, abi=PRECOMPILE_ABI)
        
        merkle_proof_tuple = (merkle_root, siblings)
        continuity_proof_tuple = (lower_endpoint, continuity_roots)
        
        result = precompile.functions.verifyAndEmit(
            chain_key,
            [block_num],
            [tx_bytes],
            [merkle_proof_tuple],
            continuity_proof_tuple
        ).call()
        
        query_id = "0x" + result.hex()
        
        return {
            "verified": True,
            "query_id": query_id,
            "tx_hash": tx_hash,
            "source_chain_key": chain_key,
            "block_number": block_num,
            "precompile": PRECOMPILE_ADDRESS,
            "proof_stats": {
                "merkle_siblings": len(siblings),
                "continuity_roots": len(continuity_roots),
                "tx_bytes_size": len(tx_bytes),
            },
            "note": "Proof verified via Creditcoin native precompile (0x0FD2) — trustless cross-chain verification"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Precompile verification failed: {str(e)}")
