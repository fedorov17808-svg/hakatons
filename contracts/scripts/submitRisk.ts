import { ethers } from 'hardhat';

async function main() {
  const address = process.env.ASSET_ADDRESS || '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2';
  const score = parseInt(process.env.SCORE || '75');
  
  const contractAddress = '0xa3AD1879Af301B7c158ff9844541BA0Ca8Eb353b';
  const contract = await ethers.getContractAt('CreditPulseScore', contractAddress);
  
  console.log(`Submitting risk report for ${address} with score ${score}...`);
  const tx = await contract.saveRiskReport(address, score, 80, 85, 70);
  console.log('Transaction hash:', tx.hash);
  const receipt = await tx.wait();
  console.log('Confirmed in block:', receipt?.blockNumber);
}

main().catch(console.error);
