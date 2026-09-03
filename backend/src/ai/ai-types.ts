import type { PublicTransaction, RecoveryActionType } from "../simulator/types";

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

export interface AIDecision {
  recommendedAction: RecoveryActionType;
  confidence: number;
  recoveryProbability: number;
  riskScore: AIRiskScore;
  failureClassification: AIFailureClassification;
  reason: string;
  keyFactors: string[];
  expectedOutcome: AIExpectedOutcome;
  humanAdvice: AIHumanAdvice;
}

export interface AITransactionContext {
  transaction: {
    id: string;
    amountPaise: number;
    currency: string;
    paymentMethod: string;
    failureType: string;
    retryCount: number;
    maxRetries: number;
    createdAt: string;
    priorActions?: RecoveryActionType[];
    customer?: {
      segment: string;
      previousSuccessfulPayments: number;
      previousFailedPayments: number;
      lifetimeValuePaise: number;
    };
  };
  reviveContext: {
    ruleRecommendation: RecoveryActionType;
    policyAllowed: boolean;
    policyReason: string;
    isHighValue: boolean;
    isDuplicateRisk: boolean;
    isRetryExhausted: boolean;
    requiresHumanReview: boolean;
  };
}

export interface AIAnalysisResponse {
  available: boolean;
  decision?: AIDecision;
  analysis?: AIDecision;
  error?: string;
  source?: "LLM" | "UNAVAILABLE";
  evaluatedAt: string;
}
