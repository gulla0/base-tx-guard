import { useState, useEffect, useRef } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { runPreflight } from '@/lib/preflight';
import { PreflightResults } from './PreflightResults';
import { PreflightResult } from '@/types';
import { parseUnits, encodeFunctionData, isAddress, type Address } from 'viem';
import { normalize } from 'viem/ens';
import { USDC_ADDRESS, ERC20_ABI } from '@/lib/constants';
import { incrementPrevented, incrementSuccessful } from '@/lib/stats';
import { Shield, ExternalLink, Loader2, User, FileCode, History, CheckCircle2 } from 'lucide-react';

interface RecentRecipient {
    display: string;
    address: Address;
    timestamp: number;
}

export function TransactionBuilder() {
    const { address, publicClient, mainnetPublicClient, walletClient } = useWallet();

    // State
    const [inputValue, setInputValue] = useState(''); // What the user types
    const [amount, setAmount] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [result, setResult] = useState<PreflightResult | null>(null);
    const [recipientType, setRecipientType] = useState<'EOA' | 'Contract' | null>(null);

    // Resolution State
    const [resolvedAddress, setResolvedAddress] = useState<Address | null>(null);
    const [isResolving, setIsResolving] = useState(false);
    const [resolutionError, setResolutionError] = useState<string | null>(null);

    // Recents State
    const [recentRecipients, setRecentRecipients] = useState<RecentRecipient[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const [txHash, setTxHash] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);

    // Handle Resolution (ENS or Address)
    useEffect(() => {
        const resolve = async () => {
            if (!inputValue) {
                setResolvedAddress(null);
                setResolutionError(null);
                return;
            }

            // Direct address handling
            if (isAddress(inputValue)) {
                setResolvedAddress(inputValue);
                setResolutionError(null);
                return;
            }

            // ENS handling
            if (inputValue.includes('.')) {
                // Use Mainnet client for ENS
                if (!mainnetPublicClient) return;

                setIsResolving(true);
                setResolutionError(null);

                try {
                    // Try to normalize
                    const normalizedName = normalize(inputValue);
                    const addr = await mainnetPublicClient.getEnsAddress({
                        name: normalizedName,
                    });

                    // Stale check: verify input hasn't changed while we were awaiting
                    // Note: inputRef.current.value tracks the real-time DOM value
                    if (inputRef.current && inputRef.current.value !== inputValue) {
                        return;
                    }

                    if (addr) {
                        setResolvedAddress(addr);
                    } else {
                        setResolvedAddress(null);
                        // Suggest why it failed
                        if (inputValue.endsWith('.eth')) {
                            setResolutionError('Name not found on Mainnet');
                        } else if (inputValue.endsWith('.base.eth')) {
                            setResolutionError('Base Names via ENS not fully supported yet');
                        } else {
                            setResolutionError('Name resolution failed');
                        }
                    }
                } catch (e) {
                    // Stale check
                    if (inputRef.current && inputRef.current.value !== inputValue) return;

                    setResolvedAddress(null);
                    if (inputValue.endsWith('.eth')) {
                        setResolutionError('Invalid or not found');
                    }
                } finally {
                    // Only turn off loading if we haven't started a new request (implicit via effect cleanup, but valid here too)
                    if (inputRef.current && inputRef.current.value === inputValue) {
                        setIsResolving(false);
                    }
                }
            } else {
                setResolvedAddress(null);
                setResolutionError(null);
            }
        };

        const timer = setTimeout(resolve, 500); // 500ms debounce
        return () => clearTimeout(timer);
    }, [inputValue, mainnetPublicClient]);

    // Validate recipient type (EOA vs Contract) on the RESOLVED address
    useEffect(() => {
        if (!publicClient || !resolvedAddress) {
            setRecipientType(null);
            return;
        }

        const checkCode = async () => {
            try {
                const code = await publicClient.getCode({ address: resolvedAddress });
                if (code && code !== '0x') {
                    setRecipientType('Contract');
                } else {
                    setRecipientType('EOA');
                }
            } catch {
                setRecipientType(null);
            }
        };
        checkCode();
    }, [resolvedAddress, publicClient]);

    const handleSendToMyself = () => {
        if (!address) {
            alert("Wallet not ready yet — connect or wait a second.");
            return;
        }

        if (address) {
            setInputValue(address);
            setResolvedAddress(address);
            // Clear previous results to force re-check if needed
            setResult(null);
        }
    };

    const addToRecents = (display: string, addr: Address) => {
        setRecentRecipients(prev => {
            const newItem = { display, address: addr, timestamp: Date.now() };
            // Filter out duplicates by address
            const filtered = prev.filter(r => r.address.toLowerCase() !== addr.toLowerCase());
            // Add new item to top, cap at 5
            return [newItem, ...filtered].slice(0, 5);
        });
    };

    const handleSelectRecent = (recent: RecentRecipient) => {
        setInputValue(recent.display);
        // We know the resolved address already, so fast track it if display is equal (address case)
        // If display is a name, the effect will resolve it again to be safe, which is fine.
        // Or we can opt to setResolvedAddress immediately to avoid flicker if we trust the recent.
        // For safety, let the resolution effect run (it will hit cache usually or be fast).
        setShowSuggestions(false);
    };

    const handleCheck = async () => {
        if (!address || !publicClient || !resolvedAddress) return;
        setIsChecking(true);
        setResult(null);
        setTxHash(null);

        try {
            // Build Tx Data
            const val = parseUnits(amount || '0', 6);
            const data = encodeFunctionData({
                abi: ERC20_ABI,
                functionName: 'transfer',
                args: [resolvedAddress, val],
            });

            const tx = {
                to: USDC_ADDRESS as Address,
                data,
                value: 0n,
            };

            const res = await runPreflight({
                from: address,
                tx,
                extra: { recipient: resolvedAddress, amount },
                publicClient
            });

            setResult(res);
            if (!res.willSucceed) {
                incrementPrevented();
            } else {
                // If it succeeds simulation, we can consider adding to recents here OR on actual send.
                // Requirement says "last ~5 recipients the user successfully resolved/validated".
                // Let's add on Preflight Success for better UX (pre-fill next time even if didn't sign)
                // OR better: add on successful Send (to be strictly "recipients").
                // User requirement: "last ~5 recipients the user successfully resolved/validated"
                // This implies validation is enough. Let's add it now.
                addToRecents(inputValue, resolvedAddress);
            }

        } catch (e) {
            console.error(e);
            alert('Error running preflight: ' + (e as Error).message);
        } finally {
            setIsChecking(false);
        }
    };

    const handleSend = async () => {
        if (!walletClient || !address || !result || !result.willSucceed || !resolvedAddress) return;
        setIsSending(true);
        try {
            const val = parseUnits(amount, 6);
            const data = encodeFunctionData({
                abi: ERC20_ABI,
                functionName: 'transfer',
                args: [resolvedAddress, val],
            });

            const hash = await walletClient.sendTransaction({
                account: address,
                to: USDC_ADDRESS as Address,
                data,
                value: 0n,
                chain: undefined
            });

            setTxHash(hash);
            incrementSuccessful();

            // Definitely add to recents on successful send
            addToRecents(inputValue, resolvedAddress);

            setResult(null);
        } catch (e: unknown) {
            console.error(e);
            alert('Send failed: ' + (e instanceof Error ? e.message : 'Unknown error'));
        } finally {
            setIsSending(false);
        }
    };

    // Filter suggestions based on input
    const suggestions = recentRecipients.filter(r =>
        r.display.toLowerCase().includes(inputValue.toLowerCase()) ||
        r.address.toLowerCase().includes(inputValue.toLowerCase())
    );

    return (
        <div className="w-full bg-white rounded-xl shadow-xl p-6 border border-gray-100" onClick={() => setShowSuggestions(false)}>
            <div className="flex items-center space-x-2 mb-6">
                <Shield className="text-blue-600" size={24} />
                <h2 className="text-xl font-bold text-gray-800">Transfer Validator</h2>
            </div>

            <div className="space-y-6">
                {/* Recipient Input */}
                <div
                    className="relative"
                    onClick={(e) => e.stopPropagation()} // Prevent closing dropdown when clicking inside
                >
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-gray-700">Recipient</label>
                        {resolutionError && (
                            <span className="text-xs text-red-500 font-medium">
                                {resolutionError}
                            </span>
                        )}
                        {!resolutionError && isResolving && (
                            <span className="text-xs text-blue-500 font-medium flex items-center">
                                <Loader2 size={10} className="animate-spin mr-1" /> Resolving...
                            </span>
                        )}
                    </div>

                    <div className="relative">
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="0x... or name.base.eth"
                            value={inputValue}
                            onChange={(e) => {
                                setInputValue(e.target.value);
                                setShowSuggestions(true);
                                // Clear old results/errors when typing
                                if (result) setResult(null);
                            }}
                            onFocus={() => {
                                if (recentRecipients.length > 0) setShowSuggestions(true);
                            }}
                            className={`w-full p-3 border rounded-lg outline-none transition font-mono text-sm text-gray-900 placeholder-gray-400 bg-white ${resolutionError ? 'border-red-300 focus:ring-2 focus:ring-red-200' : 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                                }`}
                        />

                        {/* Recipient Type Badge */}
                        {resolvedAddress && recipientType && (
                            <div className="absolute right-3 top-3 px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-500 flex items-center space-x-1 border">
                                {recipientType === 'EOA' ? <User size={12} /> : <FileCode size={12} />}
                                <span>{recipientType === 'EOA' ? 'EOA' : 'Contract'}</span>
                            </div>
                        )}
                    </div>

                    {/* Resolved Address Preview */}
                    {inputValue !== resolvedAddress && resolvedAddress && (
                        <div className="mt-1 flex items-center text-xs text-green-700 bg-green-50 p-2 rounded border border-green-100">
                            <CheckCircle2 size={12} className="mr-1.5" />
                            <span className="font-mono">{resolvedAddress}</span>
                        </div>
                    )}

                    {/* Suggestions Dropdown */}
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                            <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                                Recent
                            </div>
                            {suggestions.map((recent) => (
                                <button
                                    key={recent.address}
                                    onClick={() => handleSelectRecent(recent)}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between group transition-colors"
                                >
                                    <div>
                                        <div className="font-medium text-gray-900">{recent.display}</div>
                                        {recent.display !== recent.address && (
                                            <div className="text-xs text-gray-500 font-mono">{recent.address.slice(0, 6)}...{recent.address.slice(-4)}</div>
                                        )}
                                    </div>
                                    <History size={14} className="text-gray-300 group-hover:text-blue-400" />
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="mt-2 flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                            Enter 0x address or ENS name.
                        </p>
                        <button
                            onClick={handleSendToMyself}
                            type="button"
                            className={`text-xs font-medium underline ${!address ? 'text-gray-400 hover:text-gray-600' : 'text-blue-600 hover:text-blue-800'}`}
                            title={!address ? "Connect wallet first" : "Send to your connected address"}
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
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition font-mono text-gray-900 placeholder-gray-400 bg-white"
                    />
                </div>

                <button
                    onClick={handleCheck}
                    disabled={isChecking || !resolvedAddress || !amount || isResolving}
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
