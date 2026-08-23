import { AUTOMATION_AMOUNT_CAP_PAISE } from "./constants";
import type {
  PublicTransaction,
  RecoveryActionType,
  SimulationOutcome,
  SimulationResult,
} from "./types";

const PAYMENT_ACTIONS: ReadonlySet<RecoveryActionType> = new Set([
  "RETRY_PAYMENT",
  "WAIT_AND_RETRY",
]);

function blockedResult(
  transaction: PublicTransaction,
  action: RecoveryActionType,
  reason: string,
): SimulationResult {
  return {
    transactionId: transaction.id,
    action,
    outcome: "blocked",
    recoveredPaise: 0,
    reason,
  };
}

function result(
  transaction: PublicTransaction,
  action: RecoveryActionType,
  outcome: SimulationOutcome,
  recoveredPaise: number,
  reason: string,
): SimulationResult {
  return {
    transactionId: transaction.id,
    action,
    outcome,
    recoveredPaise,
    reason,
  };
}

export function simulateRecoveryAction(
  transaction: PublicTransaction,
  action: RecoveryActionType,
  priorActions: readonly RecoveryActionType[] = [],
): SimulationResult {
  if (action === "DO_NOTHING") {
    return result(transaction, action, "skipped", 0, "No recovery action requested.");
  }

  if (action === "ESCALATE") {
    return result(transaction, action, "escalated", 0, "Case escalated for human review.");
  }

  if (action === "REQUEST_PAYMENT_METHOD_UPDATE") {
    if (priorActions.includes("REQUEST_PAYMENT_METHOD_UPDATE")) {
      return result(
        transaction,
        action,
        "duplicate_prevented",
        0,
        "Payment-method update was already requested.",
      );
    }
    return result(
      transaction,
      action,
      "skipped",
      0,
      "Customer must update the payment method; no funds captured.",
    );
  }

  if (PAYMENT_ACTIONS.has(action) && priorActions.some((prior) => PAYMENT_ACTIONS.has(prior))) {
    return result(
      transaction,
      action,
      "duplicate_prevented",
      0,
      "A payment recovery attempt was already executed for this transaction.",
    );
  }

  if (transaction.failureType === "DUPLICATE_PAYMENT" && PAYMENT_ACTIONS.has(action)) {
    return result(
      transaction,
      action,
      "duplicate_prevented",
      0,
      "Duplicate payment signature; capture is blocked.",
    );
  }

  if (transaction.retryCount >= transaction.maxRetries && PAYMENT_ACTIONS.has(action)) {
    return blockedResult(transaction, action, "Retry limit exceeded.");
  }

  if (transaction.failureType === "RETRY_LIMIT_EXCEEDED" && PAYMENT_ACTIONS.has(action)) {
    return blockedResult(transaction, action, "Retry limit exceeded.");
  }

  if (transaction.amountPaise > AUTOMATION_AMOUNT_CAP_PAISE && PAYMENT_ACTIONS.has(action)) {
    return blockedResult(
      transaction,
      action,
      "Amount exceeds the automated recovery cap.",
    );
  }

  if (transaction.failureType === "INSUFFICIENT_FUNDS") {
    if (action === "WAIT_AND_RETRY") {
      return result(
        transaction,
        action,
        "success",
        transaction.amountPaise,
        "Funds available after wait; capture succeeded.",
      );
    }
    return result(
      transaction,
      action,
      "failure",
      0,
      "Immediate retry declined for insufficient funds.",
    );
  }

  if (
    transaction.failureType === "TEMPORARY_ISSUER_FAILURE" ||
    transaction.failureType === "NETWORK_TIMEOUT"
  ) {
    if (action === "RETRY_PAYMENT" || action === "WAIT_AND_RETRY") {
      return result(
        transaction,
        action,
        "success",
        transaction.amountPaise,
        "Retryable failure recovered by bounded retry.",
      );
    }
  }

  if (
    transaction.failureType === "CARD_EXPIRED" ||
    transaction.failureType === "HARD_DECLINE" ||
    transaction.failureType === "UNKNOWN_FAILURE"
  ) {
    return result(
      transaction,
      action,
      "failure",
      0,
      "This failure class cannot be recovered by retrying the original payment.",
    );
  }

  return result(transaction, action, "failure", 0, "Simulator rejected the recovery action.");
}
