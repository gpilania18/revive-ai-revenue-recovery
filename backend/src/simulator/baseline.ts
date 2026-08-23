import { RETRYABLE_FAILURE_TYPES } from "./constants";
import type { FailureType, PublicTransaction, RecoveryActionType, RecoveryStrategy } from "./types";

const RETRYABLE = new Set<FailureType>(RETRYABLE_FAILURE_TYPES);

function isRetryableFailure(failureType: FailureType): boolean {
  return RETRYABLE.has(failureType);
}

/**
 * Deterministic baseline: retry once when the failure is retryable and no retry has occurred.
 * Does not read groundTruth, customer lifetime value, or amount policy.
 */
export const baselineStrategy: RecoveryStrategy = (
  transaction: PublicTransaction,
): RecoveryActionType => {
  if (isRetryableFailure(transaction.failureType) && transaction.retryCount === 0) {
    return "RETRY_PAYMENT";
  }
  return "DO_NOTHING";
};
