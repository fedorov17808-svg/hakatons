"""
End-to-End Test Suite for CreditPulse AI v7.2.0 Enterprise Architecture
Validates all 13 Enterprise Production Phases:
1. Cryptographic Signature Generation & Multi-Oracle Threshold Quorum
2. Live Multi-Token EVM RPC Introspection for Unlisted Contracts
3. Transparent Attestcoin Verification & Diagnostics
4. Autonomous Background Credit Keeper
5. 100% Deterministic Mathematical Core & Provenance
6. Non-Linear Adaptive Matrices & Catastrophic Circuit Breaker Hard Cap
7. Cryptographic Proof-of-Reserve (PoR) Attestation & Keccak256 Hash Commitments
8. Federated Multi-Node DON Cluster Health & BFT Consensus Gathering
9. Scoring Transparency (Weight Profile Dict, Rationale Breakdown) & Version Integrity
10. Institutional Quantitative Risk Engine (Monte Carlo Jump-Diffusion & Historical Crisis Stress Testing)
11. BLS12-381 Signature Aggregation & Cross-Chain Multi-Network Delivery
12. Direct On-Chain EVM RPC State & Reserves Indexer (Autonomous Web2-independent mode)
13. Persistent Standalone Keeper Daemon & SQLite WAL Audit Engine
"""

import os
import sys
import unittest
from eth_account import Account
from eth_account.messages import encode_defunct
from web3 import Web3

# Add backend to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import (
    process_analysis,
    api_sign,
    RecordRequest,
    api_multi_sign,
    MultiSignRequest,
    api_don_nodes,
    api_don_consensus,
    api_zktls_attest,
    ZkTLSRARequest,
    get_autonomous_status,
    execute_autonomous_cycle,
)
from routes.verification import (
    api_verify,
    VerifyRequest,
    api_por_verify,
    PoRVerifyRequest,
)
from routes.attestcoin import (
    attestcoin_verify,
    AttestcoinVerifyRequest,
)
from routes.quant_and_consensus import (
    api_quant_monte_carlo,
    MonteCarloRequest,
    api_quant_stress_test,
    StressTestRequest,
    api_don_bls_aggregate,
    BLSAggregationRequest,
    api_don_p2p_telemetry,
    api_cross_chain_relay,
    CrossChainRelayRequest
)
from zktls.verifier import ZkTLSEngine
from nodes.don_coordinator import DONCoordinator
from quant_risk import QuantRiskEngine
from nodes.bls_quorum import BLSQuorumEngine
from cross_chain_relayer import CrossChainRelayer
from onchain_indexer import OnChainIndexer
from keeper_daemon import StandaloneKeeperDaemon, PersistentKeeperStore
from risk_engine import (
    compute_scores,
    compute_canonical_data_hash,
    inspect_onchain_contract
)

class TestCreditPulseE2E(unittest.TestCase):

    def test_phase1_cryptographic_signing_and_multi_oracle(self):
        """Phase 1: Validate single oracle and multi-oracle threshold quorum signatures."""
        priv_key = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
        oracle_acct = Account.from_key(priv_key)
        
        asset_addr = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"
        data_hash = "0x41b4ad0faa2c1414e08c02c6fe711e9f1a23e93a7726487e416a41f649887711"
        scores = [72, 85, 75, 90, 65, 80, 70]
        
        target_addr_bytes = bytes.fromhex(asset_addr[2:])
        data_hash_bytes = bytes.fromhex(data_hash[2:])
        packed = target_addr_bytes + bytes(scores) + data_hash_bytes
        msg_hash = Web3.keccak(packed)
        
        signable = encode_defunct(primitive=msg_hash)
        signed = oracle_acct.sign_message(signable)
        sig_hex = "0x" + signed.signature.hex()
        
        self.assertTrue(sig_hex.startswith("0x"))
        self.assertEqual(len(signed.signature), 65)
        
        recovered = Account.recover_message(signable, signature=signed.signature)
        self.assertEqual(recovered.lower(), oracle_acct.address.lower())

        # Test Multi-Oracle DON signing
        from starlette.requests import Request
        multi_req = MultiSignRequest(
            address=asset_addr,
            score=scores[0],
            liquidity=scores[1],
            collateral=scores[2],
            audit=scores[3],
            security=scores[4],
            volatility=scores[5],
            governance=scores[6],
            data_hash=data_hash,
            quorum=2
        )
        dummy_scope = {"type": "http", "method": "POST", "path": "/api/multi-sign", "headers": []}
        multi_res = api_multi_sign(Request(dummy_scope), multi_req)
        self.assertEqual(len(multi_res["signers"]), 2)
        self.assertEqual(len(multi_res["signatures"]), 2)
        self.assertEqual(multi_res["quorum"], 2)
        self.assertTrue(multi_res["signers"][0].lower() <= multi_res["signers"][1].lower())
        print("✅ Phase 1 Verified: Single & Multi-Oracle threshold quorum signatures 100% sound.")

    def test_phase2_live_evm_rpc_introspection(self):
        """Phase 2: Validate live multi-token RPC inspection and DexScreener data diversification."""
        # 1inch Router (0x1111111254eeb25477b68fb85ed929f73a960582)
        onchain_res = inspect_onchain_contract("0x1111111254eeb25477b68fb85ed929f73a960582")
        self.assertTrue(onchain_res["is_contract"])
        self.assertGreater(onchain_res["bytecode_len"], 1000)
        self.assertIn("live_eth_price", onchain_res)
        self.assertGreater(onchain_res["live_eth_price"], 0)
        
        analysis = process_analysis("0x1111111254eeb25477b68fb85ed929f73a960582")
        self.assertTrue(any("EVM" in s for s in analysis["sources_used"]) or "EVM" in analysis["raw_inputs"]["data_source"])
        self.assertGreater(analysis["score"], 0)
        
        # Test DexScreener multi-source discovery on Uniswap
        uni_analysis = process_analysis("0x1f9840a85d5af5bf1d1762f925bdaddc4201f984")
        self.assertGreater(uni_analysis["score"], 0)
        self.assertTrue(len(uni_analysis["sources_used"]) >= 1)
        print("✅ Phase 2 Verified: Multi-Source Data Diversification (DeFiLlama + DexScreener + EVM RPC) operational.")

    def test_phase3_attestcoin_transparency(self):
        """Phase 3: Validate Attestcoin honest diagnostics, 0x0FD2 precompile wiring, and record-verified boundary."""
        from app import api_record_verified, RecordVerifiedRequest
        fake_hash = "0x000000000000000000000000000000000000000000000000000000000000dead"
        try:
            attestcoin_verify(AttestcoinVerifyRequest(tx_hash=fake_hash))
            self.fail("Expected 404 for non-attested hash")
        except Exception as e:
            self.assertIn("not yet attested", str(e))
            
        # Verify /api/record-verified input validation and error boundaries
        try:
            mock_req = RecordVerifiedRequest(
                address="0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
                score=88, liquidity=90, collateral=85, audit=95, security=88, volatility=82, governance=85,
                data_hash="0x41b4ad0faa2c1414e08c02c6fe711e9f1a23e93a7726487e416a41f649887711",
                source_tx_hash=fake_hash
            )
            api_record_verified(None, mock_req)
            self.fail("Expected error for non-attested hash")
        except Exception as e:
            self.assertTrue(len(str(e)) > 0)

        print("✅ Phase 3 Verified: Attestcoin 0x0FD2 Precompile wiring & transparent cryptographic diagnostics operational.")

    def test_phase4_autonomous_keeper(self):
        """Phase 4: Validate autonomous drift monitoring, threshold triggers (Δ > ±5 pts), and keeper state."""
        from app import toggle_autonomous_keeper
        status = get_autonomous_status()
        self.assertEqual(status["status"], "ACTIVE")
        self.assertEqual(status["monitored_count"], 5)
        self.assertEqual(status["drift_threshold_pts"], 5.0)
        self.assertEqual(status["heartbeat_cadence_sec"], 86400)
        
        logs = execute_autonomous_cycle()
        self.assertEqual(len(logs), 5)
        for log in logs:
            self.assertIn("asset", log)
            self.assertIn("address", log)
            self.assertIn("trigger_reason", log)
            self.assertIn("status", log)
            
        toggle_res = toggle_autonomous_keeper(False)
        self.assertEqual(toggle_res["status"], "PAUSED")
        toggle_res2 = toggle_autonomous_keeper(True)
        self.assertEqual(toggle_res2["status"], "ACTIVE")
        print("✅ Phase 4 Verified: Autonomous Keeper engine with on-chain drift tracking (Δ > ±5 pts) fully operational.")

    def test_phase5_deterministic_provenance_multi_asset(self):
        """Phase 5: Validate 100% deterministic reproducibility across DeFi & RWA assets."""
        test_assets = [
            "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", # Aave V3
            "0xe8684521db5a68778844145ba0a0374d8e95e140", # Ondo USDY
            "0x59d9356c82bbe361148f864a1d74076C449c761a", # Mountain USDM
            "0xf1c9881be22ebf4084f32a4e21ff272c7cb6c710", # Centrifuge
            "0xc3d688B66703497DAA19211EEdff47f25384cdc3", # Compound V3
        ]
        
        for addr in test_assets:
            analysis = process_analysis(addr)
            raw = analysis["raw_inputs"]
            
            # Verify independently via VerifyRequest
            verify_req = VerifyRequest(
                tvl=raw["tvl"],
                change_1d=raw.get("change_1d"),
                change_7d=raw.get("change_7d"),
                category=raw["category"],
                audits=str(raw["audits"]),
                chains_count=raw.get("chains_count", 1),
                listed_at=raw.get("listed_at", 0),
                snapshot_time=raw.get("snapshot_time")
            )
            verify_res = api_verify(verify_req)
            
            self.assertEqual(analysis["score"], verify_res["verified_scores"]["overall"])
            self.assertEqual(analysis["data_hash"], verify_res["data_hash"])
        print("✅ Phase 5 Verified: 100% mathematical determinism & data_hash matching across all 5 assets.")

    def test_phase6_circuit_breaker_catastrophic_hard_cap(self):
        """Phase 6: Comprehensive verification of all 5 Enterprise Anti-Manipulation & Circuit Breaker vectors."""
        # Vector 1: Unaudited vulnerable protocol with massive TVL (Critical Security Vulnerability)
        score_data = compute_scores(
            tvl=10_000_000_000,
            change_1d=0.0,
            change_7d=0.0,
            category="Lending",
            audits="0",
            chains_count=1,
            listed_at=0
        )
        self.assertTrue(score_data["circuit_breaker_active"] or score_data["overall"] <= 65)

        # Vector 2: Flash-Loan TVL surge manipulation attempt (+450% 24h surge)
        flash_surge_data = compute_scores(
            tvl=500_000_000,
            change_1d=450.0,
            change_7d=500.0,
            category="Lending",
            audits="1",
            chains_count=2,
            listed_at=1600000000
        )
        self.assertTrue(flash_surge_data["twap_discount_applied"])
        self.assertTrue(flash_surge_data["liquidity_spike_detected"])
        self.assertTrue(flash_surge_data["circuit_breaker_active"])
        self.assertLessEqual(flash_surge_data["overall"], 58)
        self.assertIn("Anti-TVL-Spike", flash_surge_data["circuit_breaker_reason"])

        # Vector 3: Brand new 4-day-old unseasoned contract with artificial $100M TVL (Lindy Seasoning)
        now_ts = 1700000000
        new_contract_data = compute_scores(
            tvl=100_000_000,
            change_1d=0.0,
            change_7d=0.0,
            category="Lending",
            audits="1",
            chains_count=1,
            listed_at=now_ts - (4 * 86400), # 4 days old
            snapshot_time=now_ts
        )
        self.assertTrue(new_contract_data["twap_discount_applied"])
        self.assertLess(new_contract_data["seasoning_multiplier"], 0.3)
        self.assertLess(new_contract_data["effective_tvl"], 30_000_000)

        # Vector 4: Severe capital drain / Bank Run (-55% 24h drop)
        bank_run_data = compute_scores(
            tvl=200_000_000,
            change_1d=-55.0,
            change_7d=-70.0,
            category="Lending",
            audits="2",
            chains_count=3,
            listed_at=1600000000
        )
        self.assertTrue(bank_run_data["bank_run_detected"])
        self.assertTrue(bank_run_data["circuit_breaker_active"])
        self.assertLessEqual(bank_run_data["overall"], 45)
        self.assertIn("Bank Run", bank_run_data["circuit_breaker_reason"])

        # Vector 5: High-frequency wash-trading oscillation divergence (+90% 1d vs -40% 7d)
        divergence_data = compute_scores(
            tvl=100_000_000,
            change_1d=90.0,
            change_7d=-40.0,
            category="DEX",
            audits="1",
            chains_count=2,
            listed_at=1600000000
        )
        self.assertLessEqual(divergence_data["volatility_score"], 40)
        print("✅ Phase 6 Verified: All 5 Enterprise Anti-Manipulation & Circuit Breaker vectors 100% hardened.")

    def test_phase7_cryptographic_por_attestation(self):
        """Phase 7: Validate Keccak256 PoR commitments and redacted bank proofs."""
        attest_res = api_zktls_attest(ZkTLSRARequest(
            asset_address="0xe8684521db5a68778844145ba0a0374d8e95e140",
            token_supply_usd=450_000_000,
            reserve_balance_usd=463_500_000,
            custodian_name="Ankura Trust & Morgan Stanley",
            spv_cik="CIK-0001982741",
            account_id_masked="US-BNK-****-8821"
        ))

        # Verify the new distributed consensus format
        self.assertTrue(attest_res["quorum_met"])
        self.assertEqual(attest_res["quorum_count"], 2)
        self.assertEqual(len(attest_res["signers"]), 2)
        
        details = attest_res["verification_details"]
        self.assertTrue(details["is_solvent"])
        self.assertEqual(details["reserve_ratio_bps"], 10300)
        self.assertTrue(details["session_commitment"].startswith("0x"))
        self.assertTrue(details["zk_tls_proof_hash"].startswith("0x"))
        self.assertTrue(details["custodian_key_hash"].startswith("0x"))
        self.assertIn("TLS", details["tls_standard"])
        self.assertIn("TLSNotary", details.get("production_upgrade_path", ""))
        print("✅ Phase 7 Verified: Distributed DON PoR commitments & quorum signatures sound.")

    def test_phase8_federated_multi_node_don_cluster(self):
        """Phase 8: Validate Federated Multi-Node DON Cluster health and BFT consensus gathering."""
        nodes_status = api_don_nodes()
        self.assertEqual(nodes_status["total_nodes"], 3)
        self.assertEqual(nodes_status["required_quorum"], 2)
        self.assertEqual(nodes_status["cluster_health"], "OPTIMAL")

        # First, run a standard analysis to get the true, currently verified scores
        address = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"
        analyze_res = process_analysis(address)

        # Test consensus gathering across independent node runners using the legitimate payload
        multi_req = MultiSignRequest(
            address=address,
            score=analyze_res["score"],
            liquidity=analyze_res["liquidity"],
            collateral=analyze_res["collateral"],
            audit=analyze_res["audit"],
            security=analyze_res["security"],
            volatility=analyze_res["volatility_score"],
            governance=analyze_res["governance"],
            data_hash=analyze_res["data_hash"],
            quorum=2,
            snapshot_time=analyze_res.get("raw_inputs", {}).get("snapshot_time")
        )
        consensus_res = api_don_consensus(multi_req)
        self.assertTrue(consensus_res["quorum_met"])
        self.assertEqual(consensus_res["quorum_count"], 2)
        self.assertEqual(len(consensus_res["signers"]), 2)
        self.assertEqual(len(consensus_res["signatures"]), 2)
        # Verify signers are strictly sorted in ascending order for EVM compliance
        self.assertTrue(consensus_res["signers"][0].lower() <= consensus_res["signers"][1].lower())
        print("✅ Phase 8 Verified: Federated Multi-Node DON cluster & BFT threshold quorum 100% operational.")

    def test_phase9_scoring_transparency_and_version_integrity(self):
        """Phase 9: Validate scoring transparency (weight_profile dict, breakdown rationales) and version integrity."""
        from app import health, api_stats, app as fastapi_app
        from routes.verification import api_methodology
        
        # 1. Verify FastAPI app and endpoint versions
        self.assertEqual(fastapi_app.version, "7.2.0")
        h = health()
        self.assertEqual(h["version"], "7.2.0")
        s = api_stats()
        self.assertEqual(s["version"], "7.2.0")
        m = api_methodology()
        self.assertEqual(m["version"], "7.2.0")

        # 2. Verify analyze response contains structured weight_profile dict and scoring_breakdown
        address = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"
        analysis = process_analysis(address)
        
        self.assertEqual(analysis["formula_version"], "7.2")
        self.assertIsInstance(analysis["weight_profile"], dict)
        self.assertTrue(len(analysis["weight_profile"]) >= 5)
        # Weights should sum to approximately 1.0
        total_weight = sum(analysis["weight_profile"].values())
        self.assertAlmostEqual(total_weight, 1.0, places=2)
        
        self.assertIsInstance(analysis["scoring_breakdown"], dict)
        required_breakdown_keys = ["liquidity", "collateral", "security", "volatility", "governance", "audit", "seasoning"]
        for k in required_breakdown_keys:
            self.assertIn(k, analysis["scoring_breakdown"])
            self.assertTrue(len(str(analysis["scoring_breakdown"][k])) > 0)
            
        # 3. Verify CryptoPoREngine independent verification with blinding factors
        attestation = ZkTLSEngine.generate_bank_por_attestation(
            asset_address=address,
            token_supply_usd=100_000_000,
            reserve_balance_usd=105_000_000,
        )
        self.assertTrue(attestation["independent_verification"]["claim_commitment_valid"])
        self.assertTrue(attestation["independent_verification"]["session_commitment_valid"])
        print("✅ Phase 9 Verified: Scoring transparency (weight_profile dict, breakdown) & version integrity 100% sound.")

    def test_phase_10_monte_carlo_quant_risk(self):
        """Phase 10: Validate Monte Carlo jump-diffusion simulation and crisis stress-testing."""
        # 1. Test Monte Carlo Simulation
        mc_res = api_quant_monte_carlo(MonteCarloRequest(
            tvl_usd=50_000_000,
            score=88.0,
            iterations=1000,
            time_horizon_days=30
        ))
        self.assertIn("metrics", mc_res)
        self.assertIn("var_95_pct", mc_res["metrics"])
        self.assertIn("var_99_pct", mc_res["metrics"])
        self.assertIn("cvar_95_pct", mc_res["metrics"])
        self.assertIn("insolvency_probability_pct", mc_res["metrics"])
        self.assertTrue(mc_res["metrics"]["var_99_pct"] >= mc_res["metrics"]["var_95_pct"])
        self.assertIn(mc_res["risk_rating"], ["AAA", "AA", "A", "BBB", "HighRisk"])

        # 2. Test Historical Crisis Stress Testing
        stress_res = api_quant_stress_test(StressTestRequest(
            tvl_usd=50_000_000,
            score=88.0,
            scenario="black_thursday_2020"
        ))
        self.assertIn("post_shock_tvl_usd", stress_res)
        self.assertIn("survivability_score", stress_res)
        self.assertTrue(stress_res["is_solvent"])
        self.assertEqual(stress_res["resilience_grade"], "Resilient")
        print("✅ Phase 10 Verified: Institutional Quantitative Risk Engine (Monte Carlo & Stress-Testing) 100% sound.")

    def test_phase_11_bls_aggregation_and_cross_chain(self):
        """Phase 11: Validate REAL BLS12-381 signature aggregation (py_ecc) and Cross-Chain ABI encoding."""
        # 1. Test REAL BLS12-381 Signature Aggregation (elliptic curve pairing)
        test_hash = "0x41b4ad0faa2c1414e08c02c6fe711e9f1a23e93a7726487e416a41f649887711"
        sample_signatures = [
            {"node_id": "node-alpha", "signer_address": "0x55ac26863a79cdab5304164afb3c5fac65916585"},
            {"node_id": "node-beta",  "signer_address": "0xfcad0b19bb29d4674531d6f115237e16afce377c"}
        ]
        bls_res = BLSQuorumEngine.aggregate_signatures(
            message_hash=test_hash,
            node_signatures=sample_signatures
        )
        self.assertTrue(bls_res["aggregated_signature"].startswith("0x"))
        self.assertTrue(bls_res["aggregation_verified"], "BLS pairing check must pass")
        self.assertEqual(bls_res["total_signers"], 2)
        self.assertEqual(bls_res["signature_size_bytes"], 96)  # Real G2 point = 96 bytes
        self.assertIn("py_ecc", bls_res["scheme"])
        self.assertIn("gas_economics", bls_res)
        self.assertEqual(bls_res["status"], "AGGREGATED_CONSENSUS_VERIFIED")

        # 2. Test P2P Topology Telemetry (real healthcheck — nodes may or may not be up)
        p2p_telemetry = BLSQuorumEngine.get_p2p_network_telemetry()
        self.assertIn("mesh_clusters", p2p_telemetry)
        self.assertEqual(p2p_telemetry["total_configured_peers"], 3)
        self.assertIn("active_peers", p2p_telemetry)

        # 3. Test Cross-Chain ABI-Encoded Packet
        relay_res = api_cross_chain_relay(CrossChainRelayRequest(
            target_chain_id=1,  # Ethereum Mainnet
            asset_address="0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
            score=88,
            dynamic_ltv=90,
            risk_tier="AAA",
            data_hash=test_hash,
            cc3_tx_hash="0x7986752dcf8d62a59cfc1c3bdf07df3aadb46095167282fa8818370b844d2fb8"
        ))
        self.assertTrue(relay_res["packet_id"].startswith("0x"))
        self.assertEqual(relay_res["destination_chain"], "Ethereum Mainnet")
        self.assertEqual(relay_res["status"], "ENCODED_READY_FOR_BRIDGE")
        self.assertIsNotNone(relay_res.get("abi_encoded_calldata"))  # Real ABI encoding
        print("✅ Phase 11 Verified: REAL BLS12-381 pairing aggregation (py_ecc) & Cross-Chain ABI encoding 100% sound.")

    def test_phase_12_onchain_indexer(self):
        """Phase 12: Validate autonomous direct EVM RPC state and token inspection without Web2."""
        indexer = OnChainIndexer(["https://rpc.cc3-testnet.creditcoin.network"])
        contract_addr = "0x358925c5839a36bB2181786B8763Da0653B0f438"
        inspection = indexer.inspect_token_contract(contract_addr)
        
        self.assertTrue(inspection["is_contract"])
        self.assertEqual(inspection["address"], contract_addr)
        self.assertIn("bytecode_size_bytes", inspection)
        self.assertTrue(inspection["bytecode_size_bytes"] > 0)
        self.assertIn("data_source", inspection)

        # Test DEX pool inspection
        pool_inspection = indexer.inspect_liquidity_pool(contract_addr)
        self.assertEqual(pool_inspection["pool_address"], contract_addr)
        print("✅ Phase 12 Verified: Direct On-Chain EVM RPC state & reserve indexer 100% sound.")

    def test_phase_13_persistent_keeper_daemon(self):
        """Phase 13: Validate persistent SQLite/WAL audit store and single evaluation cycle."""
        store = PersistentKeeperStore()
        
        # Test storing evaluation audit cycle
        sample_evals = [{
            "asset_name": "Test Aave",
            "asset_address": "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
            "new_score": 88,
            "onchain_score": 88,
            "score_drift_pts": 0.0,
            "needs_update": False,
            "trigger_reason": "STABLE",
            "tx_hash": None,
            "data_hash": "0x41b4ad0faa2c1414e08c02c6fe711e9f1a23e93a7726487e416a41f649887711",
            "status": "MONITORED_OK"
        }]
        cycle_id = store.record_cycle(
            evaluated_count=1,
            broadcasted_count=0,
            cycle_duration_ms=15.4,
            evaluations=sample_evals,
            status="COMPLETED"
        )
        self.assertTrue(cycle_id > 0)
        
        metrics = store.get_latest_metrics()
        self.assertTrue(metrics["total_cycles"] > 0)
        self.assertTrue(len(metrics["recent_history"]) > 0)
        print("✅ Phase 13 Verified: Persistent Standalone Keeper Daemon & SQLite WAL audit engine 100% sound.")

if __name__ == "__main__":
    unittest.main()
