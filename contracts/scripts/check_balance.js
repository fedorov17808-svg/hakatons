const { ethers } = require('ethers');

const RPC_URL = 'https://rpc.cc3-testnet.creditcoin.network';
const ADDRESS = '0x500Bc61c239a6957474a1dd074aE4FBa8BAa48e4';

async function checkBalance() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  try {
    const balance = await provider.getBalance(ADDRESS);
    const formatted = ethers.formatEther(balance);
    console.log(`Current balance: ${formatted} CTC`);
    if (balance > 0n) {
      console.log('TOKENS_RECEIVED');
      process.exit(0);
    }
  } catch (err) {
    console.error('Error checking balance:', err.message);
  }
}

// Check every 5 seconds
setInterval(checkBalance, 5000);
checkBalance();
