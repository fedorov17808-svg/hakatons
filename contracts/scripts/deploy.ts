import { ethers } from "hardhat";

async function main() {
  const CreditPulseASC = await ethers.getContractFactory("CreditPulseASC");
  const contract = await CreditPulseASC.deploy();

  await contract.waitForDeployment();

  console.log(`CreditPulseASC deployed to: ${await contract.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
