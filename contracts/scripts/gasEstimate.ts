import { ethers } from "hardhat";

async function main() {
  const [owner, oracle] = await ethers.getSigners();
  
  const Factory = await ethers.getContractFactory("CreditPulseASC");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();
  
  // Authorize oracle
  await contract.authorizeOracle(oracle.address);
  
  // Create a signed risk report
  const assetAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
  const scores = [75, 80, 70, 65, 85, 60, 78]; // 7 dimensions
  const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test-data"));
  
  // Sign EIP-712 style
  const messageHash = ethers.solidityPackedKeccak256(
    ["address", "uint8", "uint8", "uint8", "uint8", "uint8", "uint8", "uint8", "bytes32"],
    [assetAddress, ...scores, dataHash]
  );
  const signature = await oracle.signMessage(ethers.getBytes(messageHash));
  
  // Estimate gas
  const gasEstimate = await contract.connect(oracle).saveRiskReportSigned.estimateGas(
    assetAddress, scores[0], scores[1], scores[2], scores[3], scores[4], scores[5], scores[6],
    dataHash, signature
  );
  
  console.log("saveRiskReportSigned gas:", gasEstimate.toString());
  
  // Simple saveRiskReport
  const gasSimple = await contract.connect(oracle).saveRiskReport.estimateGas(
    assetAddress, scores[0], scores[1], scores[2], scores[3], scores[4], scores[5], scores[6]
  );
  console.log("saveRiskReport gas:", gasSimple.toString());
  
  // Get current gas price from CC3
  console.log("\n=== CC3 Testnet Gas Price ===");
}

main().catch(console.error);
