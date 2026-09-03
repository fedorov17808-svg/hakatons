import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "CTC");

  console.log("\n🚀 Deploying CreditPulseScore...");
  const Factory = await ethers.getContractFactory("CreditPulseScore");
  
  // Deploy as upgradeable proxy
  const contract = await upgrades.deployProxy(Factory, [], { 
    initializer: "initialize",
    kind: "uups"
  });
  await contract.waitForDeployment();
  
  const addr = await contract.getAddress();
  console.log("✅ CreditPulseScore deployed to:", addr);
  
  // Authorize deployer as oracle
  const tx = await contract.authorizeOracle(deployer.address);
  await tx.wait();
  console.log("✅ Deployer authorized as oracle");
  
  // Verify ownership
  const owner = await contract.owner();
  console.log("Owner:", owner);
  
  console.log("\n📋 Update CONTRACT_ADDRESS in .env to:", addr);
}

main().catch(console.error);
