import type { ScenarioId } from "./types";

export const DEFAULT_SEED = 42;

export const DATASET_SIZE = 200;

export const MERCHANT_ID = "merchant_revive_demo";

export const DEFAULT_MAX_RETRIES = 3;

/** ₹50,000. Auto retry/wait is blocked above this cap. */
export const AUTOMATION_AMOUNT_CAP_PAISE = 5_000_000;

export const SCENARIO_COUNTS: Record<ScenarioId, number> = {
  TEMPORARY_ISSUER_FAILURE: 35,
  NETWORK_TIMEOUT: 30,
  INSUFFICIENT_FUNDS: 25,
  CARD_EXPIRED: 20,
  HARD_DECLINE: 20,
  RETRY_LIMIT_EXCEEDED: 20,
  DUPLICATE_PAYMENT: 15,
  HIGH_VALUE_ESCALATION: 15,
  AMBIGUOUS_LOW_CONFIDENCE: 20,
};

export const RETRYABLE_FAILURE_TYPES = [
  "TEMPORARY_ISSUER_FAILURE",
  "NETWORK_TIMEOUT",
  "INSUFFICIENT_FUNDS",
] as const;
