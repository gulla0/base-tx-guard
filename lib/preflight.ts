import { type PublicClient, type Address, isAddress, parseUnits, formatUnits } from 'viem';
import { USDC_ADDRESS, ERC20_ABI } from './constants';
import { type PreflightResult, type PreflightIssue } from '@/types';

interface PreflightArgs {
    from: Address;
    tx: {
        to: Address;
        data: `0x${string}`;
        value: bigint;
    };
    extra: {
        recipient: string;
        amount: string; // Human readable amount string
    };
    publicClient: PublicClient<any, any>;
}

export async function runPreflight({ from, tx, extra, publicClient }: PreflightArgs): Promise<PreflightResult> {
    const issues: PreflightIssue[] = [];
    const amountUnits = parseUnits(extra.amount, 6); // USDC is 6 decimals

    // 1. Validate Recipient
    if (!isAddress(extra.recipient)) {
        return {
            willSucceed: false,
            issues: [{ type: 'address', severity: 'blocking', message: 'Invalid recipient address' }],
            confidence: 0,
        };
    }

    // 2. ETH Balance Check (Gas)
    try {
        const ethBalance = await publicClient.getBalance({ address: from });
        const gasWarningThreshold = parseUnits('0.00005', 18);
        const gasBlockingThreshold = parseUnits('0.00001', 18);

        if (ethBalance < gasBlockingThreshold) {
            issues.push({ type: 'address', severity: 'blocking', message: 'Insufficient ETH for gas (need > 0.00001 ETH)' });
        } else if (ethBalance < gasWarningThreshold) {
            issues.push({ type: 'address', severity: 'warning', message: 'Low ETH balance, tx might fail if gas spikes' });
        }
    } catch (err) {
        console.error('Failed to check ETH balance', err);
        issues.push({ type: 'balance', severity: 'warning', message: 'Could not verify ETH balance' });
    }

    // 3. USDC Balance Check
    try {
        const usdcBalance = await publicClient.readContract({
            address: USDC_ADDRESS as Address,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [from],
        });

        if (usdcBalance < amountUnits) {
            issues.push({
                type: 'balance',
                severity: 'blocking',
                message: `Insufficient USDC balance. Have ${formatUnits(usdcBalance, 6)}, need ${extra.amount}`
            });
        }
    } catch (err) {
        console.error('Failed to check USDC balance', err);
        issues.push({ type: 'balance', severity: 'warning', message: 'Could not verify USDC balance' });
    }

    // If we already have blocking issues, stop here to save RPC calls, 
    // OR continue to find all issues? 
    // User flow says: "Runs preflight checks... If preflight passes: execute".
    // Usually better to show all issues.

    // 4. Simulate Transaction (eth_call)
    try {
        await publicClient.call({
            account: from,
            to: tx.to,
            data: tx.data,
            value: tx.value,
        });
    } catch (err: any) {
        // Attempt to extract simplistic reason
        const msg = err.shortMessage || err.message || 'Transaction simulation reverted';
        issues.push({ type: 'revert', severity: 'blocking', message: `Simulation failed: ${msg}` });
    }

    // 5. Estimate Gas
    let estimatedGas = 0n;
    try {
        const gas = await publicClient.estimateGas({
            account: from,
            to: tx.to,
            data: tx.data,
            value: tx.value,
        });
        // Add 20% buffer
        estimatedGas = (gas * 120n) / 100n;
    } catch (err) {
        if (!issues.some(i => i.type === 'revert')) {
            issues.push({ type: 'gas', severity: 'blocking', message: 'Gas estimation failed (tx likely will revert)' });
        }
    }

    const blockingCount = issues.filter(i => i.severity === 'blocking').length;

    return {
        willSucceed: blockingCount === 0,
        issues,
        estimatedGas: blockingCount === 0 ? estimatedGas : undefined,
        confidence: blockingCount === 0 ? 95 : 0,
    };
}
