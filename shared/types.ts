export type TransactionStatus =
  | "created"
  | "failed"
  | "authorized"
  | "captured";

export type FailureType = "retryable" | "non_retryable";

export type RecoveryActionType =
  | "retry_payment"
  | "wait"
  | "escalate"
  | "no_action";
