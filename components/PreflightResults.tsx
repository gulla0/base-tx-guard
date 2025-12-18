import { PreflightResult } from '@/types';
import { CheckCircle, XCircle, AlertTriangle, ArrowRight, Info, ShieldCheck } from 'lucide-react';

interface PreflightResultsProps {
    result: PreflightResult;
    onSend: () => void;
    isSending: boolean;
}

export function PreflightResults({ result, onSend, isSending }: PreflightResultsProps) {
    const { willSucceed, issues, estimatedGas, confidence } = result;

    // Derived checklist status
    const hasGasIssue = issues.some(i => i.message.toLowerCase().includes('eth') || i.type === 'gas');
    const hasBalanceIssue = issues.some(i => i.message.toLowerCase().includes('usdc'));
    const hasSimulationIssue = issues.some(i => i.type === 'revert');

    return (
        <div className="mt-6 space-y-4">
            <h3 className="font-semibold text-gray-900 border-b pb-2 flex items-center justify-between">
                <span>Safety Checklist</span>
                <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    Analysis complete
                </span>
            </h3>

            {/* Explicit Checklist */}
            <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex items-center justify-between p-2 rounded bg-gray-50 border border-gray-100">
                    <span className="text-gray-700">ETH for Gas</span>
                    {hasGasIssue ? <XCircle size={16} className="text-red-500" /> : <CheckCircle size={16} className="text-green-500" />}
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-gray-50 border border-gray-100">
                    <span className="text-gray-700">USDC Balance</span>
                    {hasBalanceIssue ? <XCircle size={16} className="text-red-500" /> : <CheckCircle size={16} className="text-green-500" />}
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-gray-50 border border-gray-100">
                    <span className="text-gray-700">Simulation</span>
                    {hasSimulationIssue ? <XCircle size={16} className="text-red-500" /> : <CheckCircle size={16} className="text-green-500" />}
                </div>
            </div>

            {/* Status Header */}
            <div className={`p-4 rounded-lg flex items-start space-x-3 transition-colors ${willSucceed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                {willSucceed ? (
                    <ShieldCheck className="text-green-600 mt-1 shrink-0" size={24} />
                ) : (
                    <AlertTriangle className="text-red-600 mt-1 shrink-0" size={24} />
                )}
                <div>
                    <h4 className={`font-bold text-lg ${willSucceed ? 'text-green-800' : 'text-red-800'}`}>
                        {willSucceed ? 'This transaction is safe to send' : 'Checks Failed'}
                    </h4>

                    {!willSucceed && (
                        <p className="text-sm text-red-700 font-medium mt-1">
                            If you sent this directly from a wallet, it would likely fail.
                        </p>
                    )}

                    <p className="text-sm text-gray-600 mt-2 flex items-center gap-1">
                        {willSucceed ? (
                            <>
                                <span>Confidence: {confidence}%</span>
                                <div className="group relative">
                                    <Info size={14} className="text-gray-400 cursor-help" />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
                                        Confidence is based on current on-chain state. State can change before execution.
                                    </div>
                                </div>
                            </>
                        ) : 'Please resolve the issues below.'}
                    </p>
                </div>
            </div>

            {/* Detailed Issues List */}
            {issues.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</h4>
                    <ul className="space-y-2">
                        {issues.map((issue, idx) => (
                            <li key={idx} className={`p-3 rounded text-sm flex items-start space-x-2 ${issue.severity === 'blocking' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-yellow-50 text-yellow-800 border border-yellow-200'}`}>
                                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                                <span>{issue.message}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Action Button */}
            {willSucceed && (
                <div className="pt-2">
                    <button
                        onClick={onSend}
                        disabled={isSending}
                        className="w-full flex justify-center items-center space-x-2 bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg hover:shadow-xl transform active:scale-[0.98]"
                    >
                        {isSending ? (
                            <span>Processing...</span>
                        ) : (
                            <>
                                <span>Send USDC Now</span>
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                    <p className="text-center text-xs text-gray-400 mt-2">
                        Estimated Gas: ~{estimatedGas?.toString()} wei
                    </p>
                </div>
            )}

            {!willSucceed && (
                <div className="pt-2">
                    <button disabled className="w-full py-4 bg-gray-100 text-gray-400 font-bold rounded-xl cursor-not-allowed border border-gray-200">
                        Fix issues above before sending
                    </button>
                </div>
            )}
        </div>
    );
}
