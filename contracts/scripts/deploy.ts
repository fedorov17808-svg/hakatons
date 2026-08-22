import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying CreditPulseASC v7.0.0 with deployer: ${deployer.address}`);

  const blockProver = "0x0000000000000000000000000000000000000FD2";
  const oracleSigner = deployer.address;

  const CreditPulseASC = await ethers.getContractFactory("CreditPulseASC");
  const contract = await CreditPulseASC.deploy(blockProver, oracleSigner);

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  console.log(`✅ CreditPulseASC v7.0.0 deployed to: ${contractAddress}`);

  // Register and authorize the 3 DON validator nodes
  const donNodes = [
    "0x55ac26863a79cdab5304164afb3c5fac65916585",
    "0xfcad0b19bb29d4674531d6f115237e16afce377c",
    "0xb4b6059dbe03c873eb2d4b971a82ffd04368565a"
  ];

  for (const nodeAddr of donNodes) {
    console.log(`Authorizing DON Validator Node: ${nodeAddr}...`);
    const tx = await contract.setOracleAuthorization(nodeAddr, true);
    await tx.wait();
  }

  console.log(`🎉 All DON Validator Nodes authorized on-chain!`);
  console.log(`\nTo update frontend and backend:`);
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`CONTRACT_ADDRESS=${contractAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
