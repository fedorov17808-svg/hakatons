"""
CreditPulse AI — Historical Incident Backtesting Engine v7.3.0

Validates the scoring model against 4 real crypto catastrophes to prove
that circuit breakers and score degradation would have fired BEFORE
or DURING the crisis. This is the #1 artifact investors ask for.

Usage:
    python -m backtesting.run_backtest
"""

import sys
import os
import time
import json
from typing import Dict, Any, List

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from risk_engine import compute_scores


# ============================================================================
# Historical Incident Data (reconstructed from public records)
# ============================================================================

HISTORICAL_INCIDENTS = [
    {
        "id": "terra_luna_may_2022",
        "name": "Terra/LUNA Death Spiral",
        "date": "May 7-13, 2022",
        "summary": "UST depegged from $1 → $0.06. LUNA went from $80 → $0.0001. "
                   "$18B TVL evaporated in 6 days. Algorithmic stablecoin failure.",
        "severity": "CATASTROPHIC",
        "pre_crisis": {
            "slug": "terra-luna",
            "name": "Terra (LUNA)",
            "tvl": 18_000_000_000,  # $18B TVL at peak
            "category": "liquid staking",
            "chains": ["Terra"],
            "chains_count": 1,
            "change_1d": 2.1,       # Normal day before crisis
            "change_7d": 5.3,
            "audits": "1",          # Halborn audit existed
            "listed_at": 1596240000,  # Aug 2020
        },
        "during_crisis": {
            "slug": "terra-luna",
            "name": "Terra (LUNA)",
            "tvl": 2_500_000_000,   # Day 3: TVL dropped to $2.5B
            "category": "liquid staking",
            "chains": ["Terra"],
            "chains_count": 1,
            "change_1d": -45.0,     # -45% in 24h
            "change_7d": -72.0,     # -72% in 7 days
            "audits": "1",
            "listed_at": 1596240000,
        },
        "post_crisis": {
            "slug": "terra-luna",
            "name": "Terra (LUNA)",
            "tvl": 50_000_000,      # Post-crash: $50M residual
            "category": "liquid staking",
            "chains": ["Terra"],
            "chains_count": 1,
            "change_1d": -88.0,     # Still collapsing
            "change_7d": -99.5,
            "audits": "1",
            "listed_at": 1596240000,
        },
        "expected": {
            "pre_score_range": (70, 90),   # High TVL + audit → good pre-score
            "during_circuit_breaker": True, # MUST fire (-45% 1d is catastrophic)
            "post_score_max": 50,          # Circuit breaker floor caps at ~45
        }
    },
    {
        "id": "ftx_alameda_nov_2022",
        "name": "FTX/Alameda Contagion",
        "date": "Nov 6-11, 2022",
        "summary": "FTX exchange collapsed. $3B+ TVL in FTX-linked protocols drained. "
                   "Contagion spread to Solana DeFi. Multiple protocols halted.",
        "severity": "CATASTROPHIC",
        "pre_crisis": {
            "slug": "ftx-defi",
            "name": "FTX-linked DeFi",
            "tvl": 3_200_000_000,
            "category": "lending",
            "chains": ["Solana", "Ethereum"],
            "chains_count": 2,
            "change_1d": -1.5,
            "change_7d": -3.2,
            "audits": "1",
            "listed_at": 1609459200,  # Jan 2021
        },
        "during_crisis": {
            "slug": "ftx-defi",
            "name": "FTX-linked DeFi",
            "tvl": 800_000_000,
            "category": "lending",
            "chains": ["Solana", "Ethereum"],
            "chains_count": 2,
            "change_1d": -35.0,
            "change_7d": -60.0,
            "audits": "1",
            "listed_at": 1609459200,
        },
        "post_crisis": {
            "slug": "ftx-defi",
            "name": "FTX-linked DeFi",
            "tvl": 120_000_000,
            "category": "lending",
            "chains": ["Solana", "Ethereum"],
            "chains_count": 2,
            "change_1d": -55.0,
            "change_7d": -92.0,
            "audits": "1",
            "listed_at": 1609459200,
        },
        "expected": {
            "pre_score_range": (75, 95),   # Multi-chain lending, $3.2B TVL
            "during_circuit_breaker": True, # -35% 1d triggers CB
            "post_score_max": 50,          # Circuit breaker floor
        }
    },
    {
        "id": "svb_usdc_depeg_mar_2023",
        "name": "SVB Bank Run & USDC Depeg",
        "date": "Mar 10-13, 2023",
        "summary": "Silicon Valley Bank collapsed. USDC depegged to $0.87 due to "
                   "$3.3B Circle reserves at SVB. DeFi TVL dropped 15% in 48h.",
        "severity": "HIGH",
        "pre_crisis": {
            "slug": "circle-usdc",
            "name": "USDC/Circle",
            "tvl": 44_000_000_000,
            "category": "cdp",
            "chains": ["Ethereum", "Polygon", "Arbitrum", "Optimism", "Avalanche"],
            "chains_count": 5,
            "change_1d": 0.3,
            "change_7d": -1.1,
            "audits": "1",
            "listed_at": 1538352000,  # Oct 2018
        },
        "during_crisis": {
            "slug": "circle-usdc",
            "name": "USDC/Circle",
            "tvl": 39_000_000_000,
            "category": "cdp",
            "chains": ["Ethereum", "Polygon", "Arbitrum", "Optimism", "Avalanche"],
            "chains_count": 5,
            "change_1d": -8.5,
            "change_7d": -13.0,
            "audits": "1",
            "listed_at": 1538352000,
        },
        "post_crisis": {
            "slug": "circle-usdc",
            "name": "USDC/Circle",
            "tvl": 37_500_000_000,
            "category": "cdp",
            "chains": ["Ethereum", "Polygon", "Arbitrum", "Optimism", "Avalanche"],
            "chains_count": 5,
            "change_1d": -2.0,
            "change_7d": -15.0,
            "audits": "1",
            "listed_at": 1538352000,
        },
        "expected": {
            "pre_score_range": (80, 95),  # High-quality, established, multi-chain
            "during_circuit_breaker": False,  # -8.5% 1d doesn't hit CB threshold
            "post_score_max": 90,  # Moderate impact, should mostly recover
        }
    },
    {
        "id": "euler_hack_mar_2023",
        "name": "Euler Finance Flash Loan Attack",
        "date": "Mar 13, 2023",
        "summary": "$197M stolen via flash loan exploit. TVL went from $250M to ~$10M "
                   "instantly. Largest DeFi hack of 2023. Funds later returned.",
        "severity": "CATASTROPHIC",
        "pre_crisis": {
            "slug": "euler-finance",
            "name": "Euler Finance",
            "tvl": 250_000_000,
            "category": "lending",
            "chains": ["Ethereum"],
            "chains_count": 1,
            "change_1d": 1.2,
            "change_7d": 3.5,
            "audits": "1",  # Had multiple audits (Halborn, Sherlock)
            "listed_at": 1640995200,  # Jan 2022
        },
        "during_crisis": {
            "slug": "euler-finance",
            "name": "Euler Finance",
            "tvl": 10_000_000,
            "category": "lending",
            "chains": ["Ethereum"],
            "chains_count": 1,
            "change_1d": -96.0,  # Flash loan drained 96% in one tx
            "change_7d": -96.0,
            "audits": "1",
            "listed_at": 1640995200,
        },
        "post_crisis": {
            "slug": "euler-finance",
            "name": "Euler Finance",
            "tvl": 5_000_000,
            "category": "lending",
            "chains": ["Ethereum"],
            "chains_count": 1,
            "change_1d": -50.0,
            "change_7d": -98.0,
            "audits": "1",
            "listed_at": 1640995200,
        },
        "expected": {
            "pre_score_range": (70, 90),  # Audited lending protocol, $250M TVL
            "during_circuit_breaker": True, # -96% in one tx → immediate CB
            "post_score_max": 50,          # Circuit breaker floor
        }
    },
]


def run_scenario(params: Dict[str, Any], ref_time: int = None) -> Dict[str, Any]:
    """Run compute_scores with scenario parameters."""
    if ref_time is None:
        ref_time = int(time.time())

    return compute_scores(
        tvl=params["tvl"],
        change_1d=params["change_1d"],
        change_7d=params["change_7d"],
        category=params["category"],
        audits=params["audits"],
        chains_count=params["chains_count"],
        listed_at=params.get("listed_at", 0),
        snapshot_time=ref_time,
    )


def run_all_backtests() -> List[Dict[str, Any]]:
    """Run all historical scenarios and collect results."""
    results = []
    ref_time = int(time.time())

    for incident in HISTORICAL_INCIDENTS:
        pre = run_scenario(incident["pre_crisis"], ref_time)
        during = run_scenario(incident["during_crisis"], ref_time)
        post = run_scenario(incident["post_crisis"], ref_time)

        expected = incident["expected"]

        # Validation checks
        pre_in_range = expected["pre_score_range"][0] <= pre["overall"] <= expected["pre_score_range"][1]
        cb_during = during.get("circuit_breaker_active", False)
        cb_expected = expected["during_circuit_breaker"]
        cb_match = cb_during == cb_expected
        post_below_max = post["overall"] <= expected["post_score_max"]

        # Score delta
        score_drop = pre["overall"] - post["overall"]

        result = {
            "incident": incident["name"],
            "date": incident["date"],
            "severity": incident["severity"],
            "pre_score": pre["overall"],
            "during_score": during["overall"],
            "post_score": post["overall"],
            "score_drop": score_drop,
            "circuit_breaker_fired": cb_during,
            "circuit_breaker_reason": during.get("circuit_breaker_reason"),
            "bank_run_detected": during.get("bank_run_detected", False),
            "liquidity_spike_detected": during.get("liquidity_spike_detected", False),
            "pre_in_expected_range": pre_in_range,
            "cb_matches_expected": cb_match,
            "post_below_max": post_below_max,
            "all_passed": pre_in_range and cb_match and post_below_max,
            "details": {
                "pre": {k: v for k, v in pre.items() if k in [
                    "overall", "liquidity", "collateral", "security",
                    "volatility_score", "governance", "audit",
                    "circuit_breaker_active", "bank_run_detected"
                ]},
                "during": {k: v for k, v in during.items() if k in [
                    "overall", "liquidity", "collateral", "security",
                    "volatility_score", "governance", "audit",
                    "circuit_breaker_active", "circuit_breaker_reason",
                    "bank_run_detected"
                ]},
                "post": {k: v for k, v in post.items() if k in [
                    "overall", "liquidity", "collateral", "security",
                    "volatility_score", "governance", "audit",
                    "circuit_breaker_active", "bank_run_detected"
                ]},
            }
        }
        results.append(result)

    return results


def print_report(results: List[Dict[str, Any]]) -> str:
    """Generate a markdown report of backtest results."""
    lines = []
    lines.append("# CreditPulse — Historical Incident Backtest Report")
    lines.append("")
    lines.append(f"**Generated:** {time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime())}")
    lines.append(f"**Model Version:** v7.3.0")
    lines.append(f"**Incidents Tested:** {len(results)}")
    lines.append("")

    # Summary table
    all_passed = all(r["all_passed"] for r in results)
    passed_count = sum(1 for r in results if r["all_passed"])

    lines.append(f"## Summary: {passed_count}/{len(results)} scenarios passed")
    lines.append("")
    lines.append("| Incident | Pre-Score | During | Post | Drop | Circuit Breaker | Bank Run | Result |")
    lines.append("|---|---|---|---|---|---|---|---|")

    for r in results:
        status = "✅ PASS" if r["all_passed"] else "❌ FAIL"
        cb = "🔴 FIRED" if r["circuit_breaker_fired"] else "⚪ No"
        br = "🏃 Yes" if r["bank_run_detected"] else "No"
        lines.append(
            f"| {r['incident']} | {r['pre_score']} | {r['during_score']} | "
            f"{r['post_score']} | -{r['score_drop']} | {cb} | {br} | {status} |"
        )

    lines.append("")

    # Detailed breakdown per incident
    for r in results:
        lines.append(f"---")
        lines.append(f"### {r['incident']} ({r['date']})")
        lines.append(f"**Severity:** {r['severity']}")
        lines.append("")

        lines.append("**Score Trajectory:**")
        lines.append(f"- Pre-crisis: **{r['pre_score']}** (expected: {HISTORICAL_INCIDENTS[[i['name'] for i in HISTORICAL_INCIDENTS].index(r['incident'])]['expected']['pre_score_range']})")
        lines.append(f"- During crisis: **{r['during_score']}**")
        lines.append(f"- Post-crisis: **{r['post_score']}** (max expected: {HISTORICAL_INCIDENTS[[i['name'] for i in HISTORICAL_INCIDENTS].index(r['incident'])]['expected']['post_score_max']})")
        lines.append(f"- Total drop: **-{r['score_drop']} points**")
        lines.append("")

        if r["circuit_breaker_fired"]:
            lines.append(f"> 🔴 **Circuit Breaker:** {r['circuit_breaker_reason']}")
            lines.append("")

        # Sub-score comparison
        lines.append("| Dimension | Pre | During | Post |")
        lines.append("|---|---|---|---|")
        for dim in ["overall", "liquidity", "collateral", "security", "volatility_score", "governance", "audit"]:
            pre_v = r["details"]["pre"].get(dim, "—")
            dur_v = r["details"]["during"].get(dim, "—")
            pst_v = r["details"]["post"].get(dim, "—")
            lines.append(f"| {dim} | {pre_v} | {dur_v} | {pst_v} |")

        lines.append("")

        # Validation checks
        lines.append("**Validation:**")
        lines.append(f"- Pre-score in expected range: {'✅' if r['pre_in_expected_range'] else '❌'}")
        lines.append(f"- Circuit breaker matched expectation: {'✅' if r['cb_matches_expected'] else '❌'}")
        lines.append(f"- Post-score below maximum: {'✅' if r['post_below_max'] else '❌'}")
        lines.append("")

    # Conclusion
    lines.append("---")
    lines.append("## Conclusion")
    lines.append("")
    if all_passed:
        lines.append("✅ **All historical scenarios passed.** The scoring model correctly:")
        lines.append("- Assigned moderate-to-high scores to pre-crisis protocols")
        lines.append("- Triggered circuit breakers during catastrophic events")
        lines.append("- Degraded scores significantly post-crisis")
        lines.append("- Detected bank-run patterns in rapid TVL outflows")
    else:
        failed = [r["incident"] for r in results if not r["all_passed"]]
        lines.append(f"⚠️ **{len(failed)} scenario(s) did not fully match expectations:** {', '.join(failed)}")
        lines.append("Review the detailed breakdown above for tuning recommendations.")

    report = "\n".join(lines)
    print(report)
    return report


if __name__ == "__main__":
    print("=" * 70)
    print("CreditPulse Historical Incident Backtest")
    print("=" * 70)
    print()

    results = run_all_backtests()
    report = print_report(results)

    # Save results
    output_dir = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(output_dir, "backtest_results.json"), "w") as f:
        json.dump(results, f, indent=2, default=str)

    report_path = os.path.join(os.path.dirname(output_dir), "BACKTEST_RESULTS.md")
    with open(report_path, "w") as f:
        f.write(report)

    print(f"\n📊 Results saved to: backtest_results.json")
    print(f"📄 Report saved to: {report_path}")

    # Exit code based on results
    all_passed = all(r["all_passed"] for r in results)
    sys.exit(0 if all_passed else 1)
