import { CreditPulseSDK } from "./index";
import assert from "assert";

async function runSDKTests() {
  console.log("🧪 Running @creditpulse/sdk test suite...");

  const sdk = new CreditPulseSDK();

  // Test 1: AAA Tier
  const aaaTerms = sdk.calculateLoanTerms(90);
  assert.strictEqual(aaaTerms.tier, "AAA");
  assert.strictEqual(aaaTerms.ltvPercent, 90);
  assert.strictEqual(aaaTerms.aprPercent, 4.5);
  assert.strictEqual(aaaTerms.isEligible, true);
  console.log("  ✔ AAA loan terms correctly evaluated (90% LTV, 4.5% APR)");

  // Test 2: AA Tier
  const aaTerms = sdk.calculateLoanTerms(78);
  assert.strictEqual(aaTerms.tier, "AA");
  assert.strictEqual(aaTerms.ltvPercent, 80);
  assert.strictEqual(aaTerms.aprPercent, 6.5);
  assert.strictEqual(aaTerms.isEligible, true);
  console.log("  ✔ AA loan terms correctly evaluated (80% LTV, 6.5% APR)");

  // Test 3: A Tier
  const aTerms = sdk.calculateLoanTerms(65);
  assert.strictEqual(aTerms.tier, "A");
  assert.strictEqual(aTerms.ltvPercent, 65);
  assert.strictEqual(aTerms.aprPercent, 9.5);
  assert.strictEqual(aTerms.isEligible, true);
  console.log("  ✔ A loan terms correctly evaluated (65% LTV, 9.5% APR)");

  // Test 4: BBB Tier
  const bbbTerms = sdk.calculateLoanTerms(52);
  assert.strictEqual(bbbTerms.tier, "BBB");
  assert.strictEqual(bbbTerms.ltvPercent, 50);
  assert.strictEqual(bbbTerms.aprPercent, 14.0);
  assert.strictEqual(bbbTerms.isEligible, true);
  console.log("  ✔ BBB loan terms correctly evaluated (50% LTV, 14.0% APR)");

  // Test 5: High Risk Tier
  const hrTerms = sdk.calculateLoanTerms(45);
  assert.strictEqual(hrTerms.tier, "HighRisk");
  assert.strictEqual(hrTerms.ltvPercent, 0);
  assert.strictEqual(hrTerms.isEligible, false);
  console.log("  ✔ Sub-50 score correctly gates and rejects loan origination");

  // Test 6: Custom config initialization
  const customSdk = new CreditPulseSDK({
    rpcUrl: "https://rpc.cc3-testnet.creditcoin.network",
    contractAddress: "0x358925c5839a36bB2181786B8763Da0653B0f438",
    maxRetries: 5,
    retryDelayMs: 500,
  });
  assert.ok(customSdk);
  console.log("  ✔ Custom SDK instance successfully initialized");

  console.log("\n🎉 All 6 SDK unit tests passed successfully!\n");
}

runSDKTests().catch((err) => {
  console.error("SDK Test failure:", err);
  process.exit(1);
});
