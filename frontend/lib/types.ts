// ---------------------------------------------------------------------------
// Types mirroring the backend API response shapes.
// Derived from: backend/src/simulator/types.ts, decision-service.ts,
//               recovery-service.ts, recovery-policy.ts, ai-types.ts
// ---------------------------------------------------------------------------

export type TransactionStatus = "created" | "failed" | "authorized" | "captured";

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

export type CustomerSegment = "consumer" | "smb" | "enterprise";

export interface CustomerContext {
  segment: CustomerSegment;
  previousSuccessfulPayments: number;
  previousFailedPayments: number;
  lifetimeValuePaise: number;
  previousRecoveryCount: number;
  lastPaymentAt: string;
}

/** Shape returned by GET /simulator/transactions → transactions[] */
export interface PublicTransaction {
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
}

/** Shape returned by GET /transactions/:id → transaction */
export interface TransactionDetail extends PublicTransaction {
  priorActions: RecoveryActionType[];
  updatedAt: string;
}

/** Shared metrics shape from evaluation endpoints */
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

/** GET /simulator/revive-evaluation response */
export interface ReviveEvaluation {
  seed: number | null;
  baseline: EvaluationMetrics;
  revive: EvaluationMetrics;
  comparison: {
    incrementalRecoveryPaise: number;
    incrementalRecoveryRate: number;
    additionalSuccessfulInterventions: number;
  };
  samplePublicTransaction: PublicTransaction | null;
}

/** GET /simulator/baseline-evaluation response */
export interface BaselineEvaluation {
  seed: number;
  metrics: EvaluationMetrics;
  samplePublicTransaction: PublicTransaction | null;
}

/** GET /simulator/transactions response */
export interface SimulatorTransactionsResponse {
  seed: number;
  transactions: PublicTransaction[];
}

/** Decision from GET /recovery/:id/decision */
export interface RecoveryDecision {
  action: RecoveryActionType;
  allowed: boolean;
  reason: string;
}

/** GET /recovery/:id/decision response */
export interface RecoveryDecisionResponse {
  transaction: PublicTransaction;
  decision: RecoveryDecision;
}

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

export interface RecoveryPolicyDecision {
  action: RecoveryActionType;
  allowed: boolean;
  reason: string;
}

/** POST /recovery/:id response */
export interface RecoveryServiceResult {
  transaction: PublicTransaction;
  policy: RecoveryPolicyDecision;
  simulation: SimulationResult;
}

/** GET /health response */
export interface HealthResponse {
  status: string;
  service?: string;
  message?: string;
}

/** Experiment & Batch Simulation Types */
export type ExperimentStatus = "IDLE" | "RUNNING" | "COMPLETED" | "ERROR";

export interface ExperimentResponse {
  seed: number | null;
  sampleSize: number;
  transactionIds: string[];
  baseline: EvaluationMetrics;
  revive: EvaluationMetrics;
  comparison: {
    incrementalRecoveryPaise: number;
    incrementalRecoveryRate: number;
    additionalSuccessfulInterventions: number;
  };
  baselineResults: SimulationResult[];
  reviveResults: SimulationResult[];
  transactions: PublicTransaction[];
  datasetSource?: "generated" | "imported";
}

/** Human Review / Escalation Types */
export type HumanDecisionType =
  | "APPROVE_RECOVERY"
  | "RETRY_PAYMENT"
  | "REQUEST_PAYMENT_METHOD_UPDATE"
  | "REJECT_RECOVERY"
  | "KEEP_ESCALATED";

export type EscalationPriority = "HIGH" | "MEDIUM" | "LOW";

export interface HumanReviewRecord {
  transactionId: string;
  decision: HumanDecisionType;
  note?: string;
  reviewedAt: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "RESOLVED";
}

export interface EscalatedTransactionItem {
  transaction: PublicTransaction;
  decision: RecoveryDecision;
  escalationReason: string;
  priority: EscalationPriority;
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED" | "RESOLVED";
  reviewedAt?: string;
}

/** Decision Audit Trail Types */
export type AuditEventType =
  | "PAYMENT_FAILED"
  | "REVIVE_ANALYSIS"
  | "AI_ANALYSIS"
  | "SAFETY_CHECK"
  | "RECOVERY_ALLOWED"
  | "RECOVERY_BLOCKED"
  | "ESCALATED"
  | "RECOVERY_ATTEMPTED"
  | "RECOVERY_SUCCEEDED"
  | "RECOVERY_FAILED"
  | "HUMAN_REVIEW"
  | "HUMAN_DECISION"
  | "HUMAN_OVERRIDE"
  | "EXPERIMENT_EVALUATION";

export type AuditActor = "SYSTEM" | "REVIVE" | "SAFETY_POLICY" | "HUMAN_OPERATOR";

export interface AuditEvent {
  id: string;
  transactionId: string;
  timestamp: string;
  eventType: AuditEventType;
  actor: AuditActor;
  action?: RecoveryActionType | HumanDecisionType | string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/** Outcome Feedback / Decision Record Types */
export type DecisionSource = "RULE_BASED_REVIVE" | "HUMAN_OPERATOR" | "BASELINE";

export type NormalizedOutcome =
  | "SUCCESS"
  | "FAILED"
  | "BLOCKED"
  | "ESCALATED"
  | "REJECTED"
  | "PENDING";

export interface DecisionRecord {
  transactionId: string;
  recommendedAction: RecoveryActionType;
  actualAction: RecoveryActionType | HumanDecisionType;
  decisionSource: DecisionSource;
  decisionReason: string;
  decisionAllowed: boolean;
  escalated: boolean;
  humanDecision?: HumanDecisionType;
  humanReason?: string;
  isHumanOverride: boolean;
  expectedOutcome?: string;
  outcome: NormalizedOutcome;
  recoveredPaise: number;
  timestamp: string;
  // AI Assistant Predictions & Decision Support
  aiRecommendedAction?: RecoveryActionType;
  aiConfidence?: number;
  recoveryProbability?: number;
  riskScore?: "LOW" | "MEDIUM" | "HIGH";
  aiExplanation?: string;
  aiKeyFactors?: string[];
  aiFailureCategory?: AIFailureCategory;
  aiFailureConfidence?: number;
  aiFailureReason?: string;
  aiExpectedOutcome?: string;
  aiExpectedSuccessProbability?: number;
  aiHumanReviewNeeded?: boolean;
  aiHumanAdvice?: string;
  aiHumanReviewTriggers?: string[];
}

export interface OutcomeFeedbackMetrics {
  totalDecisions: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  escalations: number;
  humanOverrides: number;
  decisionSuccessRate: number;
  recoveryRate: number;
}

/** AI Intelligence Assistant Types */
export type AIRiskScore = "LOW" | "MEDIUM" | "HIGH";

export type AIFailureCategory =
  | "TRANSIENT"
  | "CUSTOMER_ACTION_REQUIRED"
  | "TERMINAL"
  | "RISK_RELATED"
  | "UNKNOWN";

export interface AIFailureClassification {
  category: AIFailureCategory;
  confidence: number;
  reason: string;
}

export interface AIExpectedOutcome {
  summary: string;
  successProbability: number;
}

export interface AIHumanAdvice {
  reviewNeeded: boolean;
  summary: string;
  reviewTriggers: string[];
}

export interface AIAssistantDecision {
  recommendedAction: RecoveryActionType;
  confidence: number;
  recoveryProbability: number;
  riskScore: AIRiskScore;
  failureClassification: AIFailureClassification;
  reason: string;
  keyFactors: string[];
  expectedOutcome: AIExpectedOutcome;
  humanAdvice: AIHumanAdvice;
  evaluatedAt: string;
}

export interface AIAnalysisResult {
  status?: string;
  available: boolean;
  decision?: AIAssistantDecision;
  analysis?: AIAssistantDecision;
  error?: string;
  source?: "LLM" | "UNAVAILABLE";
  evaluatedAt: string;
}
