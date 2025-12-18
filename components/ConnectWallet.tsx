import { useWallet } from '@/hooks/useWallet';
import { AlertCircle } from 'lucide-react';

export function ConnectWallet() {
    const { address, isConnected, connect, error } = useWallet();

    if (isConnected && address) {
        return (
            <div className="flex items-center space-x-2 bg-green-100 p-3 rounded-lg border border-green-200">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="font-mono text-sm text-green-800">
                    {address.slice(0, 6)}...{address.slice(-4)}
                </span>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center space-y-3">
            <button
                onClick={connect}
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition active:scale-95"
            >
                Connect Wallet
            </button>
            {error && (
                <div className="flex items-center space-x-2 text-red-600 text-sm bg-red-50 p-2 rounded max-w-xs">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
