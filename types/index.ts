export type IssueType = 'address' | 'gas' | 'balance' | 'revert';
export type Severity = 'blocking' | 'warning';

export interface PreflightIssue {
    type: IssueType;
    severity: Severity;
    message: string;
}

export interface PreflightResult {
    willSucceed: boolean;
    issues: PreflightIssue[];
    estimatedGas?: bigint;
    confidence: number;
}
