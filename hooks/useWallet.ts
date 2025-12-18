import { useState, useEffect, useCallback } from 'react';
import { createPublicClient, createWalletClient, custom, http, type WalletClient, type Address } from 'viem';
import { base, mainnet } from 'viem/chains';
import { RPC_URL } from '@/lib/constants';

declare global {
    interface Window {
        ethereum: any;
    }
}

// Global public client
const publicClient = createPublicClient({
    chain: base,
    transport: http(RPC_URL),
});

// Global mainnet public client for ENS
export const mainnetPublicClient = createPublicClient({
    chain: mainnet,
    transport: http(process.env.NEXT_PUBLIC_MAINNET_RPC_URL || 'https://eth.merkle.io'),
});

interface UseWalletReturn {
    address: Address | null;
    isConnected: boolean;
    chainId: number | null;
    publicClient: typeof publicClient;
    mainnetPublicClient: typeof mainnetPublicClient;
    walletClient: WalletClient | null;
    error: string | null;
    connect: () => Promise<void>;
}

export function useWallet(): UseWalletReturn {
    const [address, setAddress] = useState<Address | null>(null);
    const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
    const [chainId, setChainId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const connect = useCallback(async () => {
        setError(null);
        if (typeof window === 'undefined' || !window.ethereum) {
            setError('Open in Coinbase Wallet');
            return;
        }

        try {
            const client = createWalletClient({
                chain: base,
                transport: custom(window.ethereum),
            });

            const [account] = await client.requestAddresses();
            const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
            const currentChainId = parseInt(chainIdHex as string, 16);

            if (currentChainId !== base.id) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: '0x2105' }], // 8453
                    });
                } catch (switchError) {
                    setError('Please switch to Base');
                    return;
                }
            }

            setAddress(account);
            setWalletClient(client);
            setChainId(base.id);
        } catch (err: unknown) {
            console.error(err);
            setError((err as Error).message || 'Failed to connect');
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.ethereum) return;

        const handleAccountsChanged = (accounts: string[]) => {
            if (accounts.length > 0) {
                setAddress(accounts[0] as Address);
            } else {
                setAddress(null);
                setWalletClient(null);
            }
        };

        const handleChainChanged = (_chainId: string) => {
            // Convert hex chainId to number and update state
            const newChainId = parseInt(_chainId, 16);
            setChainId(newChainId);

            // If chain is wrong, error might be needed, but for now just updating state is enough
            // The ConnectWallet component can show a "Wrong Network" UI if chainId != base.id
        };

        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        return () => {
            window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            window.ethereum.removeListener('chainChanged', handleChainChanged);
        };
    }, []);

    return {
        address,
        isConnected: !!address,
        chainId,
        publicClient,
        mainnetPublicClient,
        walletClient,
        error,
        connect,
    };
}
