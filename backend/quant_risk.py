"""
CreditPulse AI — Institutional Quantitative Risk Engine v7.2.0
Implements Monte Carlo Stress-Testing, Value at Risk (VaR 95/99), Expected Shortfall (CVaR),
and Institutional Debt Service Coverage Ratio (DSCR) for RWA & DeFi Protocols.
"""

import math
import random
from typing import Dict, Any, List, Optional

class QuantRiskEngine:
    """
    Institutional quantitative risk analysis engine.
    Simulates catastrophic liquidity shocks, borrower default cascades, and protocol depeg events.
    """

    HISTORICAL_SHOCKS = {
        "black_thursday_2020": {
            "name": "Black Thursday 2020 (ETH -50% in 24h)",
            "price_drop_pct": 50.0,
            "liquidity_drain_pct": 65.0,
            "volatility_multiplier": 3.8,
            "borrow_demand_shock": -40.0
        },
        "terra_luna_cascade_2022": {
            "name": "Terra/LUNA Bank Run 2022",
            "price_drop_pct": 92.0,
            "liquidity_drain_pct": 88.0,
            "volatility_multiplier": 5.2,
            "borrow_demand_shock": -85.0
        },
        "svb_usdc_depeg_2023": {
            "name": "SVB Run & Stablecoin Depeg 2023",
            "price_drop_pct": 13.0,
            "liquidity_drain_pct": 42.0,
            "volatility_multiplier": 2.4,
            "borrow_demand_shock": -25.0
        },
        "ftx_contagion_2022": {
            "name": "FTX Credit Contagion 2022",
            "price_drop_pct": 35.0,
            "liquidity_drain_pct": 55.0,
            "volatility_multiplier": 3.1,
            "borrow_demand_shock": -60.0
        }
    }

    @classmethod
    def run_monte_carlo(
        cls,
        tvl_usd: float,
        score: float,
        iterations: int = 10000,
        time_horizon_days: int = 30,
        daily_volatility: float = 0.04,
        seed: int = None
    ) -> Dict[str, Any]:
        """
        Execute a Monte Carlo simulation over stochastic geometric Brownian motion paths
        with jump diffusion to evaluate tail-risk insolvency probability.
        """
        if tvl_usd <= 0:
            tvl_usd = 10_000_000.0  # Fallback default $10M

        # Adjust baseline drift and jump parameters by fundamental credit score
        score_norm = max(10.0, min(100.0, score)) / 100.0
        drift_annual = (score_norm - 0.5) * 0.15
        dt = 1.0 / 365.0
        drift_daily = drift_annual * dt
        sigma_daily = daily_volatility * (1.8 - score_norm * 0.9)  # High score = lower volatility

        jump_intensity = (1.0 - score_norm) * 0.05  # Jump probability per day
        jump_mean = -0.15
        jump_std = 0.10

        # Seed only when explicitly requested (for reproducible testing)
        if seed is not None:
            random.seed(seed)

        final_tvl_ratios: List[float] = []
        insolvent_runs = 0
        liquidity_stress_threshold = 0.40  # 60% TVL loss considered extreme stress

        for _ in range(iterations):
            current_ratio = 1.0
            for _ in range(time_horizon_days):
                # Geometric Brownian Motion step
                z = random.gauss(0, 1)
                daily_return = drift_daily + sigma_daily * z

                # Poisson jump diffusion
                if random.random() < jump_intensity:
                    jump = random.gauss(jump_mean, jump_std)
                    daily_return += jump

                current_ratio *= max(0.01, (1.0 + daily_return))
                if current_ratio <= 0.15:  # Catastrophic liquidation threshold
                    break

            final_tvl_ratios.append(current_ratio)
            if current_ratio < liquidity_stress_threshold:
                insolvent_runs += 1

        final_tvl_ratios.sort()

        # Calculate Percentiles
        p1 = final_tvl_ratios[int(iterations * 0.01)]
        p5 = final_tvl_ratios[int(iterations * 0.05)]
        p50 = final_tvl_ratios[int(iterations * 0.50)]
        p95 = final_tvl_ratios[int(iterations * 0.95)]

        # Value at Risk (VaR)
        var_95_pct = max(0.0, round((1.0 - p5) * 100, 2))
        var_99_pct = max(0.0, round((1.0 - p1) * 100, 2))

        # Expected Shortfall (CVaR 95%) — Average loss beyond 95th percentile
        tail_95 = final_tvl_ratios[:int(iterations * 0.05)]
        cvar_95_ratio = sum(tail_95) / len(tail_95) if tail_95 else p5
        cvar_95_pct = max(0.0, round((1.0 - cvar_95_ratio) * 100, 2))

        insolvency_prob_pct = round((insolvent_runs / iterations) * 100, 2)

        return {
            "simulation_params": {
                "iterations": iterations,
                "time_horizon_days": time_horizon_days,
                "baseline_tvl_usd": tvl_usd,
                "base_score": score
            },
            "metrics": {
                "var_95_pct": var_95_pct,
                "var_99_pct": var_99_pct,
                "cvar_95_pct": cvar_95_pct,
                "insolvency_probability_pct": insolvency_prob_pct,
                "median_tvl_ratio": round(p50, 4),
                "expected_stressed_tvl_usd": round(tvl_usd * (1.0 - var_95_pct / 100.0), 2)
            },
            "risk_rating": "AAA" if insolvency_prob_pct < 1.0 and var_95_pct < 20.0 else
                           "AA" if insolvency_prob_pct < 3.0 and var_95_pct < 35.0 else
                           "A" if insolvency_prob_pct < 8.0 and var_95_pct < 50.0 else
                           "BBB" if insolvency_prob_pct < 15.0 else "HighRisk",
            "quant_model": "Jump-Diffusion Geometric Brownian Motion (Merton Model)"
        }

    @classmethod
    def run_historical_stress_test(
        cls,
        tvl_usd: float,
        score: float,
        scenario_key: str = "black_thursday_2020"
    ) -> Dict[str, Any]:
        """
        Simulate an explicit historical financial crisis scenario against the asset.
        """
        scenario = cls.HISTORICAL_SHOCKS.get(scenario_key, cls.HISTORICAL_SHOCKS["black_thursday_2020"])
        tvl = tvl_usd if tvl_usd > 0 else 10_000_000.0

        drain_pct = scenario["liquidity_drain_pct"]
        vol_multiplier = scenario["volatility_multiplier"]

        # Dampening factor based on credit score resilience
        resilience_factor = max(0.4, min(1.0, score / 100.0))
        effective_drain = drain_pct * (1.4 - 0.6 * resilience_factor)

        post_shock_tvl = max(0.0, tvl * (1.0 - effective_drain / 100.0))
        estimated_slippage_pct = round(min(80.0, (effective_drain / 100.0) ** 2 * 100.0 * vol_multiplier), 2)
        survivability_score = round(max(0.0, min(100.0, score * (1.0 - effective_drain / 200.0))), 1)

        return {
            "scenario": scenario["name"],
            "pre_shock_tvl_usd": tvl,
            "post_shock_tvl_usd": round(post_shock_tvl, 2),
            "effective_tvl_loss_pct": round(effective_drain, 2),
            "estimated_liquidation_slippage_pct": estimated_slippage_pct,
            "survivability_score": survivability_score,
            "is_solvent": post_shock_tvl > (tvl * 0.15),
            "resilience_grade": "Resilient" if survivability_score >= 50.0 else "Vulnerable" if survivability_score >= 30.0 else "Critical"
        }
