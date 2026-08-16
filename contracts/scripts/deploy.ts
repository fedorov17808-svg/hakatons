import { ethers } from "hardhat";

async function main() {
  const CreditPulseScore = await ethers.getContractFactory("CreditPulseScore");
  const contract = await CreditPulseScore.deploy();

  await contract.waitForDeployment();

  console.log(`CreditPulseScore deployed to: ${await contract.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
