import type { PublicTransaction, RecoveryActionType } from "../simulator/types";

export type AIRiskScore = "LOW" | "MEDIUM" | "HIGH";

export interface AIDecision {
  recommendedAction: RecoveryActionType;
  confidence: number;
  recoveryProbability: number;
  riskScore: AIRiskScore;
  reason: string;
  keyFactors: string[];
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
  };
}

export interface AIAnalysisResponse {
  available: boolean;
  decision?: AIDecision;
  error?: string;
  source?: "LLM" | "UNAVAILABLE";
  evaluatedAt: string;
}
