import type { AIDecision, AIRiskScore } from "./ai-types";
import type { RecoveryActionType } from "../simulator/types";

const ALLOWED_ACTIONS: Set<RecoveryActionType> = new Set([
  "RETRY_PAYMENT",
  "WAIT_AND_RETRY",
  "REQUEST_PAYMENT_METHOD_UPDATE",
  "DO_NOTHING",
  "ESCALATE",
]);

const ALLOWED_RISK_SCORES: Set<AIRiskScore> = new Set(["LOW", "MEDIUM", "HIGH"]);

export interface ValidationResult {
  valid: boolean;
  decision?: AIDecision;
  error?: string;
}

export function validateAIDecision(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "object") {
    return { valid: false, error: "Invalid AI response: Expected a JSON object." };
  }

  const obj = raw as Record<string, unknown>;

  // 1. Validate recommendedAction
  const action = obj.recommendedAction;
  if (typeof action !== "string" || !ALLOWED_ACTIONS.has(action as RecoveryActionType)) {
    return {
      valid: false,
      error: `Invalid recommendedAction "${String(action)}". Must be one of: ${Array.from(ALLOWED_ACTIONS).join(", ")}.`,
    };
  }

  // 2. Validate confidence
  const confidence = obj.confidence;
  if (typeof confidence !== "number" || isNaN(confidence) || confidence < 0 || confidence > 1) {
    return {
      valid: false,
      error: `Invalid confidence "${String(confidence)}". Must be a number between 0 and 1.`,
    };
  }

  // 3. Validate recoveryProbability
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

  // 5. Validate reason
  const reason = obj.reason;
  if (typeof reason !== "string" || reason.trim().length === 0) {
    return {
      valid: false,
      error: "Invalid reason: Must be a non-empty string.",
    };
  }

  // 6. Validate keyFactors
  const keyFactors = obj.keyFactors;
  if (!Array.isArray(keyFactors) || keyFactors.length === 0 || !keyFactors.every((f) => typeof f === "string" && f.trim().length > 0)) {
    return {
      valid: false,
      error: "Invalid keyFactors: Must be a non-empty array of strings.",
    };
  }

  return {
    valid: true,
    decision: {
      recommendedAction: action as RecoveryActionType,
      confidence: Math.round(confidence * 100) / 100,
      recoveryProbability: Math.round(recoveryProbability * 100) / 100,
      riskScore: riskScore as AIRiskScore,
      reason: reason.trim(),
      keyFactors: keyFactors.map((f) => (f as string).trim()),
    },
  };
}
