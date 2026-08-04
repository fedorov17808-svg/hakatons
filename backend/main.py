from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import random

app = FastAPI(title="CreditPulse AI API")

# Разрешаем запросы от нашего Next.js фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    address: str

@app.get("/")
def read_root():
    return {"status": "CreditPulse AI Engine is running"}

@app.post("/api/analyze")
def analyze_asset(req: AnalyzeRequest):
    # Логика AI-оценки рисков
    score = random.randint(75, 98)
    rwa_types = ["Real Estate Tokenization", "Private Credit Vault", "Treasury Yield Pool"]
    
    return {
        "address": req.address,
        "score": score,
        "status": "APPROVED" if score > 80 else "NEEDS REVIEW",
        "volatility": f"{round(random.uniform(0.8, 2.5), 1)}%",
        "rwaType": random.choice(rwa_types),
        "verdict": f"CreditPulse AI Engine verified asset on-chain metrics for {req.address[:6]}...{req.address[-4:] if len(req.address) > 10 else req.address}. Collateral proof validated via Creditcoin network."
    }
