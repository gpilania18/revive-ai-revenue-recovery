import type {
  AIDecision,
  AIRiskScore,
  AIFailureCategory,
  AIFailureClassification,
  AIExpectedOutcome,
  AIHumanAdvice,
  AITransactionContext,
} from "./ai-types";
import type { RecoveryActionType } from "../simulator/types";

const ALLOWED_ACTIONS: Set<RecoveryActionType> = new Set([
  "RETRY_PAYMENT",
  "WAIT_AND_RETRY",
  "REQUEST_PAYMENT_METHOD_UPDATE",
  "DO_NOTHING",
  "ESCALATE",
]);

const EXECUTABLE_RECOVERY_ACTIONS: Set<RecoveryActionType> = new Set([
  "RETRY_PAYMENT",
  "WAIT_AND_RETRY",
  "REQUEST_PAYMENT_METHOD_UPDATE",
]);

const ALLOWED_RISK_SCORES: Set<AIRiskScore> = new Set(["LOW", "MEDIUM", "HIGH"]);

const ALLOWED_FAILURE_CATEGORIES: Set<AIFailureCategory> = new Set([
  "TRANSIENT",
  "CUSTOMER_ACTION_REQUIRED",
  "TERMINAL",
  "RISK_RELATED",
  "UNKNOWN",
]);

export interface ValidationResult {
  valid: boolean;
  decision?: AIDecision;
  error?: string;
}

export function validateAIDecision(
  raw: unknown,
  reviveContext?: AITransactionContext["reviveContext"]
): ValidationResult {
  if (!raw || typeof raw !== "object") {
    return { valid: false, error: "Invalid AI response: Expected a JSON object." };
  }

  const obj = raw as Record<string, unknown>;

  // 1. Validate recommendedAction
  let action = obj.recommendedAction;
  if (typeof action !== "string" || !ALLOWED_ACTIONS.has(action as RecoveryActionType)) {
    return {
      valid: false,
      error: `Invalid recommendedAction "${String(action)}". Must be one of: ${Array.from(ALLOWED_ACTIONS).join(", ")}.`,
    };
  }

  // 2. Validate confidence (How confident AI is in its assessment)
  const confidence = obj.confidence;
  if (typeof confidence !== "number" || isNaN(confidence) || confidence < 0 || confidence > 1) {
    return {
      valid: false,
      error: `Invalid confidence "${String(confidence)}". Must be a number between 0 and 1.`,
    };
  }

  // 3. Validate recoveryProbability (Estimated probability recovery succeeds if action is executed)
  const recoveryProbability = obj.recoveryProbability;
  if (
    typeof recoveryProbability !== "number" ||
    isNaN(recoveryProbability) ||
    recoveryProbability < 0 ||
    recoveryProbability > 1
  ) {
    return {
      valid: false,
      error: `Invalid recoveryProbability "${String(recoveryProbability)}". Must be a number between 0 and 1.`,
    };
  }

  // 4. Validate riskScore
  const riskScore = obj.riskScore;
  if (typeof riskScore !== "string" || !ALLOWED_RISK_SCORES.has(riskScore as AIRiskScore)) {
    return {
      valid: false,
      error: `Invalid riskScore "${String(riskScore)}". Must be "LOW", "MEDIUM", or "HIGH".`,
    };
  }

  // 5. Validate failureClassification
  const rawFailure = obj.failureClassification;
  let failureClassification: AIFailureClassification;
  if (rawFailure && typeof rawFailure === "object") {
    const fc = rawFailure as Record<string, unknown>;
    const cat = typeof fc.category === "string" && ALLOWED_FAILURE_CATEGORIES.has(fc.category as AIFailureCategory)
      ? (fc.category as AIFailureCategory)
      : "UNKNOWN";
    const fcConfidence = typeof fc.confidence === "number" && !isNaN(fc.confidence) && fc.confidence >= 0 && fc.confidence <= 1
      ? Math.round(fc.confidence * 100) / 100
      : Math.round(confidence * 100) / 100;
    const fcReason = typeof fc.reason === "string" && fc.reason.trim().length > 0
      ? fc.reason.trim()
      : "Failure classified based on supplied transaction signals.";

    failureClassification = {
      category: cat,
      confidence: fcConfidence,
      reason: fcReason,
    };
  } else {
    failureClassification = {
      category: "UNKNOWN",
      confidence: Math.round(confidence * 100) / 100,
      reason: "Insufficient signals for definitive failure category classification.",
    };
  }

  // 6. Validate reason
  let reason = typeof obj.reason === "string" ? obj.reason.trim() : "";
  if (reason.length === 0) {
    return {
      valid: false,
      error: "Invalid reason: Must be a non-empty string.",
    };
  }

  // 7. Validate keyFactors
  const keyFactors = obj.keyFactors;
  if (!Array.isArray(keyFactors) || keyFactors.length === 0 || !keyFactors.every((f) => typeof f === "string" && f.trim().length > 0)) {
    return {
      valid: false,
      error: "Invalid keyFactors: Must be a non-empty array of strings.",
    };
  }

  // 8. Validate expectedOutcome
  const rawExpected = obj.expectedOutcome;
  let expectedOutcome: AIExpectedOutcome;
  if (rawExpected && typeof rawExpected === "object") {
    const eo = rawExpected as Record<string, unknown>;
    const summary = typeof eo.summary === "string" && eo.summary.trim().length > 0
      ? eo.summary.trim()
      : `Estimated recovery likelihood: ${Math.round(recoveryProbability * 100)}%`;
    const successProb = typeof eo.successProbability === "number" && !isNaN(eo.successProbability) && eo.successProbability >= 0 && eo.successProbability <= 1
      ? Math.round(eo.successProbability * 100) / 100
      : Math.round(recoveryProbability * 100) / 100;
    expectedOutcome = {
      summary,
      successProbability: successProb,
    };
  } else {
    expectedOutcome = {
      summary: `Estimated recovery likelihood: ${Math.round(recoveryProbability * 100)}% if suggested action is followed.`,
      successProbability: Math.round(recoveryProbability * 100) / 100,
    };
  }

  // 9. Validate humanAdvice
  const rawAdvice = obj.humanAdvice;
  let humanAdvice: AIHumanAdvice;
  const isEscalationAction = action === "ESCALATE";
  const shouldRequireReview = Boolean(
    reviveContext && (
      reviveContext.requiresHumanReview ||
      reviveContext.isHighValue ||
      reviveContext.isDuplicateRisk ||
      reviveContext.isRetryExhausted ||
      !reviveContext.policyAllowed ||
      reviveContext.ruleRecommendation === "ESCALATE"
    )
  );

  if (rawAdvice && typeof rawAdvice === "object") {
    const ha = rawAdvice as Record<string, unknown>;
    const reviewNeeded = shouldRequireReview || (typeof ha.reviewNeeded === "boolean" ? ha.reviewNeeded : isEscalationAction);
    const summary = typeof ha.summary === "string" && ha.summary.trim().length > 0
      ? ha.summary.trim()
      : reviewNeeded
      ? "Manual review recommended due to policy constraints or transaction parameters."
      : "Standard automated recovery pathway eligible under current policy constraints.";
    const triggers = Array.isArray(ha.reviewTriggers)
      ? (ha.reviewTriggers.filter((t) => typeof t === "string" && t.trim().length > 0) as string[])
      : [];
    humanAdvice = {
      reviewNeeded,
      summary,
      reviewTriggers: triggers,
    };
  } else {
    humanAdvice = {
      reviewNeeded: shouldRequireReview || isEscalationAction,
      summary: (shouldRequireReview || isEscalationAction)
        ? "Manual operator inspection required before proceeding."
        : "Standard automated recovery pathway eligible.",
      reviewTriggers: [],
    };
  }

  // -------------------------------------------------------------------------
  // 10. DETERMINISTIC FINANCIAL SAFETY & AUTHORITY ENFORCEMENT
  // -------------------------------------------------------------------------
  // If REVIVE safety policy blocks automated recovery (policyAllowed === false),
  // the AI Assistant MUST NOT recommend an executable recovery action.
  let finalAction = action as RecoveryActionType;

  if (reviveContext && !reviveContext.policyAllowed) {
    if (reviveContext.isHighValue) {
      finalAction = "ESCALATE";
    } else if (EXECUTABLE_RECOVERY_ACTIONS.has(finalAction)) {
      const escalateCandidate = reviveContext.ruleRecommendation === "ESCALATE";
      finalAction = escalateCandidate ? "ESCALATE" : "DO_NOTHING";
    }

    const policyDisclaimer = "REVIVE safety policy currently blocks automated recovery. AI assessment is advisory and cannot override this restriction.";
    if (!reason.includes("REVIVE safety policy")) {
      reason = `${policyDisclaimer} ${reason}`;
    }
    humanAdvice.reviewNeeded = true;
  }

  // If retries are exhausted, never permit retry actions
  if (reviveContext && reviveContext.isRetryExhausted) {
    if (finalAction === "RETRY_PAYMENT" || finalAction === "WAIT_AND_RETRY") {
      finalAction = "DO_NOTHING";
      if (!reason.includes("Retry limit reached")) {
        reason = `Retry limit reached. ${reason}`;
      }
    }
    humanAdvice.reviewNeeded = true;
  }

  // If duplicate risk exists, never permit retry actions and elevate risk score
  let finalRiskScore = riskScore as AIRiskScore;
  let finalRecoveryProb = Math.round(recoveryProbability * 100) / 100;

  if (reviveContext && reviveContext.isDuplicateRisk) {
    finalAction = "DO_NOTHING";
    finalRiskScore = "HIGH";
    finalRecoveryProb = 0;
    failureClassification.category = "RISK_RELATED";
    if (!reason.includes("double charge") && !reason.includes("Duplicate payment")) {
      reason = `Duplicate payment risk detected. No safe recovery action is available because attempting recovery could result in an unintended double charge. ${reason}`;
    }
    humanAdvice.reviewNeeded = true;
  }

  return {
    valid: true,
    decision: {
      recommendedAction: finalAction,
      confidence: Math.round(confidence * 100) / 100,
      recoveryProbability: finalRecoveryProb,
      riskScore: finalRiskScore,
      failureClassification,
      reason: reason.trim(),
      keyFactors: keyFactors.map((f) => (f as string).trim()),
      expectedOutcome,
      humanAdvice,
    },
  };
}
