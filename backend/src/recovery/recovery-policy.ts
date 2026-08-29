import type {
  RecoveryActionType,
  PublicTransaction,
} from "../simulator/types";

export interface RecoveryPolicyDecision {
  action: RecoveryActionType;
  allowed: boolean;
  reason: string;
}

const AUTOMATION_AMOUNT_CAP_PAISE = 10_000_00;

export function evaluateRecoveryPolicy(
  transaction: PublicTransaction,
  requestedAction: RecoveryActionType,
): RecoveryPolicyDecision {
  if (transaction.status !== "failed") {
    return {
      action: "DO_NOTHING",
      allowed: false,
      reason: "Only failed transactions are eligible for recovery.",
    };
  }

  if (requestedAction === "RETRY_PAYMENT") {
    if (transaction.retryCount >= transaction.maxRetries) {
      return {
        action: "DO_NOTHING",
        allowed: false,
        reason: "Retry limit has been exhausted.",
      };
    }

    if (transaction.failureType === "CARD_EXPIRED") {
      return {
        action: "REQUEST_PAYMENT_METHOD_UPDATE",
        allowed: false,
        reason: "Expired payment credentials cannot be recovered by retrying.",
      };
    }

    if (transaction.failureType === "HARD_DECLINE") {
      return {
        action: "DO_NOTHING",
        allowed: false,
        reason: "Hard declines must not be retried automatically.",
      };
    }

    if (transaction.failureType === "DUPLICATE_PAYMENT") {
      return {
        action: "DO_NOTHING",
        allowed: false,
        reason: "Duplicate payment risk prevents an automatic retry.",
      };
    }

    if (transaction.amountPaise > AUTOMATION_AMOUNT_CAP_PAISE) {
      return {
        action: "ESCALATE",
        allowed: false,
        reason: "High-value transactions require human authorization.",
      };
    }
  }

  if (requestedAction === "WAIT_AND_RETRY") {
    if (transaction.retryCount >= transaction.maxRetries) {
      return {
        action: "DO_NOTHING",
        allowed: false,
        reason: "Retry limit has been exhausted.",
      };
    }

    if (transaction.amountPaise > AUTOMATION_AMOUNT_CAP_PAISE) {
      return {
        action: "ESCALATE",
        allowed: false,
        reason: "High-value transactions require human authorization.",
      };
    }
  }

  if (requestedAction === "REQUEST_PAYMENT_METHOD_UPDATE") {
    if (transaction.failureType !== "CARD_EXPIRED") {
      return {
        action: "DO_NOTHING",
        allowed: false,
        reason: "Payment method update is only required for expired credentials.",
      };
    }
  }

  return {
    action: requestedAction,
    allowed: true,
    reason: "Recovery action passed the safety policy.",
  };
}