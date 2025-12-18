import { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { runPreflight } from '@/lib/preflight';
import { PreflightResults } from './PreflightResults';
import { PreflightResult } from '@/types';
import { parseUnits, encodeFunctionData, isAddress, type Address } from 'viem';
import { USDC_ADDRESS, ERC20_ABI } from '@/lib/constants';
import { incrementPrevented, incrementSuccessful } from '@/lib/stats';
import { Shield, ExternalLink, Loader2, User, FileCode, ArrowDown } from 'lucide-react';

export function TransactionBuilder() {
    const { address, publicClient, walletClient } = useWallet();
    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [result, setResult] = useState<PreflightResult | null>(null);
    const [recipientType, setRecipientType] = useState<'EOA' | 'Contract' | null>(null);

    const [txHash, setTxHash] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);

    // Validate recipient type when changed
    useEffect(() => {
        if (!publicClient || !isAddress(recipient)) {
            setRecipientType(null);
            return;
        }

        const checkCode = async () => {
            try {
                const code = await publicClient.getCode({ address: recipient as Address });
                if (code && code !== '0x') {
                    setRecipientType('Contract');
                } else {
                    setRecipientType('EOA');
                }
            } catch (e) {
                setRecipientType(null);
            }
        };
        checkCode();
    }, [recipient, publicClient]);

    const handleSendToMyself = () => {
        if (address) {
            setRecipient(address);
            // Clear previous results to force re-check if needed, or we could auto-run check
            setResult(null);
        }
    };

    const handleCheck = async () => {
        if (!address || !publicClient) return;
        setIsChecking(true);
        setResult(null);
        setTxHash(null);

        try {
            // Build Tx Data
            const val = parseUnits(amount || '0', 6);
            const data = encodeFunctionData({
                abi: ERC20_ABI,
                functionName: 'transfer',
                args: [recipient as Address, val], // Note: preflight checks address validity too
            });

            const tx = {
                to: USDC_ADDRESS as Address,
                data,
                value: 0n,
            };

            const res = await runPreflight({
                from: address,
                tx,
                extra: { recipient, amount },
                publicClient
            });

            setResult(res);
            if (!res.willSucceed) {
                incrementPrevented();
            }

        } catch (e) {
            console.error(e);
            alert('Error running preflight: ' + (e as any).message);
        } finally {
            setIsChecking(false);
        }
    };

    const handleSend = async () => {
        if (!walletClient || !address || !result || !result.willSucceed) return;
        setIsSending(true);
        try {
            const val = parseUnits(amount, 6);
            const data = encodeFunctionData({
                abi: ERC20_ABI,
                functionName: 'transfer',
                args: [recipient as Address, val],
            });

            const hash = await walletClient.sendTransaction({
                account: address,
                to: USDC_ADDRESS as Address,
                data,
                value: 0n,
                chain: undefined // Let wallet decide or already set in client
            });

            setTxHash(hash);
            incrementSuccessful();
            setResult(null); // Clear result to prevent double send
        } catch (e: any) {
            console.error(e);
            alert('Send failed: ' + e.message);
        } finally {
            setIsSending(false);
        }
    };

    const isValidHeader = recipient && !isAddress(recipient);

    return (
        <div className="w-full bg-white rounded-xl shadow-xl p-6 border border-gray-100">
            <div className="flex items-center space-x-2 mb-6">
                <Shield className="text-blue-600" size={24} />
                <h2 className="text-xl font-bold text-gray-800">Transfer Validator</h2>
            </div>

            <div className="space-y-6">
                {/* Recipient Input */}
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-gray-700">Recipient Address</label>
                        {isValidHeader && (
                            <span className="text-xs text-red-500 font-medium animate-pulse">
                                Only Base addresses (0x...) are supported right now
                            </span>
                        )}
                    </div>

                    <div className="relative">
                        <input
                            type="text"
                            placeholder="0x..."
                            value={recipient}
                            onChange={(e) => setRecipient(e.target.value)}
                            className={`w-full p-3 border rounded-lg outline-none transition font-mono text-sm ${isValidHeader ? 'border-red-300 focus:ring-2 focus:ring-red-200' : 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                                }`}
                        />

                        {/* Recipient Type Check */}
                        {isAddress(recipient) && recipientType && (
                            <div className="absolute right-3 top-3 px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-500 flex items-center space-x-1 border">
                                {recipientType === 'EOA' ? <User size={12} /> : <FileCode size={12} />}
                                <span>{recipientType === 'EOA' ? 'Externally Owned Account' : 'Smart Contract'}</span>
                            </div>
                        )}
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                            Paste a Base (0x…) address. We’ll verify it before you send.
                        </p>
                        <button
                            onClick={handleSendToMyself}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
                        >
                            [ Send to my own address ]
                        </button>
                    </div>
                </div>

                {/* Amount Input */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount (USDC)</label>
                    <input
                        type="text"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition font-mono"
                    />
                </div>

                <button
                    onClick={handleCheck}
                    disabled={isChecking || !recipient || !amount || !isAddress(recipient)}
                    className="w-full py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-black transition disabled:opacity-50 flex justify-center items-center space-x-2 shadow-lg"
                >
                    {isChecking ? <Loader2 className="animate-spin" size={18} /> : <Shield size={18} />}
                    <span>{isChecking ? 'Simulating...' : 'Check if this will succeed'}</span>
                </button>
            </div>

            {result && (
                <PreflightResults
                    result={result}
                    onSend={handleSend}
                    isSending={isSending}
                />
            )}

            {txHash && (
                <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-green-800 font-bold mb-2">Transaction Sent!</p>
                    <a
                        href={`https://basescan.org/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1 text-blue-600 hover:underline"
                    >
                        <span>View on Basescan</span>
                        <ExternalLink size={14} />
                    </a>
                </div>
            )}
        </div>
    );
}
