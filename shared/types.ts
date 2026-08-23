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
