"""
CreditPulse AI — Services Package v8.0.0

Clean service layer separating business logic from HTTP routing.
"""

from services.state import app_state, AppStateManager
from services.ai_narrative import generate_risk_narrative

__all__ = ["app_state", "AppStateManager", "generate_risk_narrative"]
