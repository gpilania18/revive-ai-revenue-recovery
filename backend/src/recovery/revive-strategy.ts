import type {
  PublicTransaction,
  RecoveryActionType,
  RecoveryStrategy,
} from "../simulator/types";

const AUTOMATION_AMOUNT_CAP_PAISE = 10_000_00;

export const reviveStrategy: RecoveryStrategy = (
  transaction: PublicTransaction,
): RecoveryActionType => {
  if (transaction.status !== "failed") {
    return "DO_NOTHING";
  }

  if (transaction.retryCount >= transaction.maxRetries) {
    return "DO_NOTHING";
  }

  if (transaction.amountPaise > AUTOMATION_AMOUNT_CAP_PAISE) {
    return "ESCALATE";
  }

  switch (transaction.failureType) {
    case "DUPLICATE_PAYMENT":
      return "DO_NOTHING";

    case "HARD_DECLINE":
      return "DO_NOTHING";

    case "CARD_EXPIRED":
      return "REQUEST_PAYMENT_METHOD_UPDATE";

    case "INSUFFICIENT_FUNDS":
      return "WAIT_AND_RETRY";

    case "TEMPORARY_ISSUER_FAILURE":
    case "NETWORK_TIMEOUT":
      return "RETRY_PAYMENT";

    case "RETRY_LIMIT_EXCEEDED":
      return "DO_NOTHING";

    case "UNKNOWN_FAILURE":
      return "ESCALATE";

    default: {
      const exhaustive: never = transaction.failureType;
      return exhaustive;
    }
  }
};