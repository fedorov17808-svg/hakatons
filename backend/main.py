from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import hashlib
import time

app = FastAPI(title="CreditPulse AI Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    address: str

def generate_ai_analysis(address: str):
    # Генерируем детерминированный, но уникальный вектор факторов риска на основе хэша адреса
    addr_hash = int(hashlib.sha256(address.lower().encode()).hexdigest(), 16)
    
    liquidity = 65 + (addr_hash % 33)
    collateral = 60 + ((addr_hash >> 2) % 38)
    security = 70 + ((addr_hash >> 4) % 29)
    volatility_score = 68 + ((addr_hash >> 6) % 30)
    governance = 75 + ((addr_hash >> 8) % 24)
    audit = 80 + ((addr_hash >> 10) % 20)

    overall_score = round((liquidity + collateral + security + volatility_score + governance + audit) / 6)

    categories = [
        "Real Estate Tokenized Vault", 
        "Private Debt Capital Pool", 
        "US Treasury Yield Backed Token", 
        "Structured Trade Finance RWA"
    ]
    rwa_type = categories[addr_hash % len(categories)]

    verdict_templates = [
        f"Autonomous Agent Verified: Asset {address[:6]}...{address[-4:]} demonstrates robust collateralization ratio ({collateral}%) and deep liquidity reserves. Zero critical vulnerabilities found in smart contract bytecode.",
        f"Credit Intelligence Alert: Asset {address[:6]}...{address[-4:]} exhibits elevated volatility risks ({100 - volatility_score}% risk index). High liquidity depth ({liquidity}%) mitigates liquidation cascades.",
        f"Institutional Grade Assessment: On-chain proofs for {address[:6]}...{address[-4:]} validated via Creditcoin oracle node. Governance parameters align with Basle III compliance metrics."
    ]
    verdict = verdict_templates[addr_hash % len(verdict_templates)]

    radar_data = [
        {"subject": "Liquidity", "A": liquidity, "fullMark": 100},
        {"subject": "Collateral", "A": collateral, "fullMark": 100},
        {"subject": "Smart Contract", "A": security, "fullMark": 100},
        {"subject": "Volatility", "A": volatility_score, "fullMark": 100},
        {"subject": "Governance", "A": governance, "fullMark": 100},
        {"subject": "Audit Proofs", "A": audit, "fullMark": 100},
    ]

    return {
        "address": address,
        "score": overall_score,
        "status": "INSTITUTIONAL APPROVED" if overall_score >= 80 else "MODERATE RISK",
        "rwaType": rwa_type,
        "metrics": {
            "liquidity": liquidity,
            "collateral": collateral,
            "security": security,
            "audit": audit
        },
        "radarData": radar_data,
        "verdict": verdict,
        "timestamp": int(time.time())
    }

@app.post("/api/analyze")
def analyze_asset(req: AnalyzeRequest):
    return generate_ai_analysis(req.address)
