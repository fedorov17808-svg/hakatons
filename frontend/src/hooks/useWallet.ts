"use client";

import { useState, useCallback } from "react";
import { ethers } from "ethers";

interface UseWalletReturn {
  account: string | null;
  connectWallet: () => Promise<void>;
  walletError: string | null;
}

const CREDITCOIN_CHAIN_ID = '0x18E8F'; // 102031

/**
 * useWallet — manages MetaMask / EIP-1193 wallet connection
 * and Creditcoin CC3 chain switching.
 */
export function useWallet(): UseWalletReturn {
  const [account, setAccount] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);

  const switchToCreditcoin = useCallback(async () => {
    const ethWindow = window as unknown as { ethereum: { request: (args: unknown) => Promise<unknown> } };
    try {
      await ethWindow.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CREDITCOIN_CHAIN_ID }],
      });
    } catch (switchErr: unknown) {
      const err = switchErr as { code?: number };
      if (err.code === 4902 || err.code === -32603 || typeof err.code === 'undefined') {
        try {
          await ethWindow.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: CREDITCOIN_CHAIN_ID,
              chainName: 'Creditcoin Testnet CC3',
              nativeCurrency: { name: 'CTC', symbol: 'CTC', decimals: 18 },
              rpcUrls: ['https://rpc.cc3-testnet.creditcoin.network'],
              blockExplorerUrls: ['https://creditcoin-testnet.blockscout.com']
            }]
          });
        } catch {
          setWalletError('Failed to add Creditcoin network to wallet');
        }
      }
    }
  }, []);

  const connectWallet = useCallback(async () => {
    setWalletError(null);
    const ethWindow = window as unknown as { ethereum: ethers.Eip1193Provider };
    if (typeof window !== "undefined" && ethWindow.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(ethWindow.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        setAccount(accounts[0]);
        try {
          await switchToCreditcoin();
        } catch {}
      } catch (err: unknown) {
        const errorObj = err as { code?: number };
        if (errorObj?.code === 4001) {
          setWalletError("Wallet connection was rejected. Please try again.");
        } else {
          setWalletError("Failed to connect wallet. Please make sure your Web3 wallet is unlocked.");
        }
      }
    } else {
      setWalletError('INFO: No Web3 wallet detected. You can still use all features without a wallet.');
    }
  }, [switchToCreditcoin]);

  return { account, connectWallet, walletError };
}
