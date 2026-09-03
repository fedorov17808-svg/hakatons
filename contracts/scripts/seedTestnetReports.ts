import { ethers } from "hardhat";

/**
 * Generates real on-chain risk report transactions on CC3 Testnet.
 * This populates the contract with real attestation data for demo/presentation.
 */
async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);
  
  const balance = await ethers.provider.getBalance(signer.address);
  console.log("Balance:", ethers.formatEther(balance), "CTC");
  
  if (balance === 0n) {
    console.log("❌ No CTC balance. Get testnet tokens from faucet first.");
    return;
  }

  const CONTRACT = process.env.CONTRACT_ADDRESS || "0x358925c5839a36bB2181786B8763Da0653B0f438";
  
  const abi = [
    "function saveRiskReport(address _assetAddress, uint8 _overallScore, uint8 _liquidity, uint8 _collateral, uint8 _auditScore, uint8 _security, uint8 _volatility, uint8 _governance) external",
    "function reportCount() external view returns (uint256)",
    "function authorizeOracle(address _oracle) external",
    "function authorizedOracles(address) external view returns (bool)"
  ];

  const contract = new ethers.Contract(CONTRACT, abi, signer);

  // Check if signer is authorized oracle
  try {
    const isOracle = await contract.authorizedOracles(signer.address);
    if (!isOracle) {
      console.log("Authorizing signer as oracle...");
      const authTx = await contract.authorizeOracle(signer.address);
      await authTx.wait();
      console.log("✅ Oracle authorized:", authTx.hash);
    }
  } catch (e) {
    console.log("⚠️ Could not check/set oracle status (may already be set):", (e as Error).message.slice(0, 80));
  }

  // Real-world inspired risk reports for major DeFi protocols
  const reports = [
    { name: "Aave V3", addr: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", scores: [82, 88, 85, 90, 87, 72, 80] },
    { name: "Compound V3", addr: "0xc3d688B66703497DAA19211EEdff47f25384cdc3", scores: [78, 82, 80, 85, 83, 70, 75] },
    { name: "MakerDAO (DAI)", addr: "0x6b175474e89094c44da98b954eedeac495271d0f", scores: [80, 85, 82, 88, 85, 68, 82] },
    { name: "Lido (stETH)", addr: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84", scores: [75, 90, 78, 82, 80, 65, 70] },
    { name: "Ondo Finance (OUSG)", addr: "0xe8684521db5a68778844145ba0a0374d8e95e140", scores: [85, 80, 90, 78, 82, 75, 88] },
    { name: "Centrifuge (Tinlake)", addr: "0x0412db7b4618e47f9be5e4277b0dfcaeef4534a1", scores: [68, 72, 75, 70, 65, 60, 72] },
    { name: "Morpho Blue", addr: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb", scores: [77, 80, 78, 75, 82, 68, 73] },
    { name: "Uniswap V3 (ETH/USDC)", addr: "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640", scores: [72, 92, 70, 80, 78, 55, 65] },
  ];

  console.log(`\n📡 Sending ${reports.length} risk reports to CC3 Testnet...\n`);

  let successCount = 0;
  for (const report of reports) {
    try {
      console.log(`  ⏳ ${report.name}...`);
      const tx = await contract.saveRiskReport(
        report.addr,
        ...report.scores,
        { gasLimit: 300000 }
      );
      const receipt = await tx.wait();
      console.log(`  ✅ ${report.name}: TX ${tx.hash} (gas: ${receipt?.gasUsed})`);
      successCount++;
    } catch (e) {
      console.log(`  ❌ ${report.name}: ${(e as Error).message.slice(0, 100)}`);
    }
  }

  // Final count
  try {
    const totalReports = await contract.reportCount();
    console.log(`\n📊 Total on-chain reports: ${totalReports}`);
  } catch {}

  console.log(`\n✅ Done: ${successCount}/${reports.length} reports saved on-chain`);
}

main().catch(console.error);
