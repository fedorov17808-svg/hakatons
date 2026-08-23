# @creditpulse/sdk

Official Developer SDK for integrating **CreditPulse AI** real-time institutional credit ratings and dynamic risk-adjusted LTV into your DeFi and RWA protocols on **Creditcoin (CC3)**.

---

## 📦 Installation

```bash
npm install @creditpulse/sdk ethers
```

---

## ⚡ Quickstart (TypeScript / JavaScript)

```typescript
import { CreditPulseSDK } from "@creditpulse/sdk";

const sdk = new CreditPulseSDK();

async function checkBorrower() {
  const assetAddress = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"; // Aave V3
  
  // 1. Fetch live on-chain credit report
  const report = await sdk.getRiskReport(assetAddress);
  console.log(`Credit Rating: ${report.overall}/100`);
  console.log(`Liquidity Depth: ${report.liquidity}/100 | Security: ${report.security}/100`);

  // 2. Compute dynamic loan terms
  const terms = sdk.calculateLoanTerms(report.overall);
  console.log(`Tier: ${terms.tier} | Max LTV: ${terms.ltvPercent}% | APR: ${terms.aprPercent}%`);
}

checkBorrower();
```

---

## 📜 Solidity Integration (1-Line Protocol Integration)

```solidity
import "@creditpulse/contracts/interfaces/ICreditPulse.sol";

contract MyLendingPool {
    ICreditPulse public immutable creditPulse = ICreditPulse(0x358925c5839a36bB2181786B8763Da0653B0f438);

    function borrow(address collateralAsset, uint256 amount) external {
        ICreditPulse.RiskReport memory report = creditPulse.getRiskReport(collateralAsset);
        require(report.overallScore >= 75, "Collateral asset credit rating below institutional threshold");
        // Proceed with dynamic loan origination
    }
}
```
