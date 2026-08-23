export type TransactionStatus =
  | "created"
  | "failed"
  | "authorized"
  | "captured";

export type PaymentMethod = "CARD" | "UPI" | "NETBANKING" | "WALLET";

export type FailureType =
  | "TEMPORARY_ISSUER_FAILURE"
  | "NETWORK_TIMEOUT"
  | "INSUFFICIENT_FUNDS"
  | "CARD_EXPIRED"
  | "HARD_DECLINE"
  | "RETRY_LIMIT_EXCEEDED"
  | "DUPLICATE_PAYMENT"
  | "UNKNOWN_FAILURE";

export type RecoveryActionType =
  | "RETRY_PAYMENT"
  | "WAIT_AND_RETRY"
  | "REQUEST_PAYMENT_METHOD_UPDATE"
  | "DO_NOTHING"
  | "ESCALATE";

export type ScenarioId =
  | "TEMPORARY_ISSUER_FAILURE"
  | "NETWORK_TIMEOUT"
  | "INSUFFICIENT_FUNDS"
  | "CARD_EXPIRED"
  | "HARD_DECLINE"
  | "RETRY_LIMIT_EXCEEDED"
  | "DUPLICATE_PAYMENT"
  | "HIGH_VALUE_ESCALATION"
  | "AMBIGUOUS_LOW_CONFIDENCE";

export type CustomerSegment = "consumer" | "smb" | "enterprise";

export interface CustomerContext {
  segment: CustomerSegment;
  previousSuccessfulPayments: number;
  previousFailedPayments: number;
  lifetimeValuePaise: number;
  previousRecoveryCount: number;
  lastPaymentAt: string;
}

/**
 * Evaluation-only. Never pass this object into baseline, policy, or AI logic.
 */
export interface GroundTruth {
  scenarioId: ScenarioId;
  recoverable: boolean;
  optimalAction: RecoveryActionType;
  expectedRecoveryPaise: number;
  reason: string;
}

export interface Transaction {
  id: string;
  merchantId: string;
  customerId: string;
  amountPaise: number;
  currency: "INR";
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  failureType: FailureType;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  lastAttemptAt: string;
  customer: CustomerContext;
  groundTruth: GroundTruth;
}

export type PublicTransaction = Omit<Transaction, "groundTruth">;

export type SimulationOutcome =
  | "success"
  | "failure"
  | "blocked"
  | "duplicate_prevented"
  | "escalated"
  | "skipped";

export interface SimulationResult {
  transactionId: string;
  action: RecoveryActionType;
  outcome: SimulationOutcome;
  recoveredPaise: number;
  reason: string;
}

export interface EvaluationMetrics {
  transactionCount: number;
  totalRevenueAtRiskPaise: number;
  revenueRecoveredPaise: number;
  recoveryRate: number;
  successfulInterventions: number;
  blockedActions: number;
  escalationCount: number;
  duplicatePreventionCount: number;
}

export type RecoveryStrategy = (transaction: PublicTransaction) => RecoveryActionType;
