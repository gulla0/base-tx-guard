import { PreflightResult } from '@/types';
import { CheckCircle, XCircle, AlertTriangle, ArrowRight } from 'lucide-react';

interface PreflightResultsProps {
    result: PreflightResult;
    onSend: () => void;
    isSending: boolean;
}

export function PreflightResults({ result, onSend, isSending }: PreflightResultsProps) {
    const { willSucceed, issues, estimatedGas, confidence } = result;

    return (
        <div className="mt-6 space-y-4">
            <h3 className="font-semibold text-gray-900 border-b pb-2">Preflight Checks</h3>

            {/* Status Header */}
            <div className={`p-4 rounded-lg flex items-start space-x-3 ${willSucceed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                {willSucceed ? (
                    <CheckCircle className="text-green-600 mt-1" />
                ) : (
                    <XCircle className="text-red-600 mt-1" />
                )}
                <div>
                    <h4 className={`font-bold ${willSucceed ? 'text-green-800' : 'text-red-800'}`}>
                        {willSucceed ? 'Ready to Send' : 'Checks Failed'} {willSucceed && `(${confidence}% Safe)`}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                        {willSucceed
                            ? `Estimated Gas: ${estimatedGas?.toString()} wei (includes 20% buffer)`
                            : 'Please resolve the following issues before sending.'
                        }
                    </p>
                </div>
            </div>

            {/* Issues List */}
            {issues.length > 0 && (
                <ul className="space-y-2">
                    {issues.map((issue, idx) => (
                        <li key={idx} className={`p-3 rounded text-sm flex items-start space-x-2 ${issue.severity === 'blocking' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                            <span>{issue.message}</span>
                        </li>
                    ))}
                </ul>
            )}

            {/* Action Button */}
            {willSucceed && (
                <button
                    onClick={onSend}
                    disabled={isSending}
                    className="w-full mt-4 flex justify-center items-center space-x-2 bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
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
            )}

            {!willSucceed && (
                <button disabled className="w-full mt-4 py-3 bg-gray-300 text-gray-500 font-bold rounded-lg cursor-not-allowed">
                    Send Disabled
                </button>
            )}
        </div>
    );
}
