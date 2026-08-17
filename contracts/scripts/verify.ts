import { run } from 'hardhat';

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS || '0xa643984b1e111B41644671E74dc1A2B93E6F2ff1';
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
