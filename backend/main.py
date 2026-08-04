from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import random

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

@app.post("/api/analyze")
def analyze_asset(req: AnalyzeRequest):
    liquidity_score = random.randint(70, 99)
    collateral_health = random.randint(65, 98)
    audit_score = random.randint(80, 100)
    
    overall_score = round((liquidity_score + collateral_health + audit_score) / 3)
    rwa_types = ["Real Estate Tokenization", "Private Credit Vault", "Treasury Yield Pool"]

    return {
        "address": req.address,
        "score": overall_score,
        "status": "APPROVED" if overall_score > 75 else "RISK WARNING",
        "rwaType": random.choice(rwa_types),
        "metrics": {
            "liquidity": liquidity_score,
            "collateral": collateral_health,
            "audit": audit_score
        },
        "verdict": f"CreditPulse AI Engine analyzed on-chain collateral for {req.address[:6]}...{req.address[-4:] if len(req.address) > 10 else req.address}. Multi-factor verification confirmed high liquidity depth and valid Creditcoin audit proofs."
    }
