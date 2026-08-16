import { run } from 'hardhat';

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS || '0xa3AD1879Af301B7c158ff9844541BA0Ca8Eb353b';
  console.log('Verifying contract at:', contractAddress);
  
  try {
    await run('verify:verify', {
      address: contractAddress,
      constructorArguments: [],
    });
    console.log('Contract verified successfully!');
  } catch (error: any) {
    if (error.message.includes('Already Verified')) {
      console.log('Contract is already verified.');
    } else {
      console.error('Verification failed:', error);
    }
  }
}

main().catch(console.error);
