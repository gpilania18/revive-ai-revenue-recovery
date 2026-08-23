import {
  AUTOMATION_AMOUNT_CAP_PAISE,
  DATASET_SIZE,
  DEFAULT_MAX_RETRIES,
  DEFAULT_SEED,
  MERCHANT_ID,
  SCENARIO_COUNTS,
} from "./constants";
import { createSeededRandom, shuffleInPlace } from "./seeded-random";
import type {
  CustomerContext,
  FailureType,
  GroundTruth,
  PaymentMethod,
  ScenarioId,
  Transaction,
} from "./types";

const PAYMENT_METHODS: readonly PaymentMethod[] = [
  "CARD",
  "UPI",
  "NETBANKING",
  "WALLET",
];

const STANDARD_AMOUNTS_PAISE = [
  9_900, 19_900, 49_900, 99_900, 1_49_900, 2_49_900, 4_99_900,
] as const;

const BASE_CREATED_AT_MS = Date.parse("2026-08-01T00:00:00.000Z");

function padId(index: number): string {
  return String(index).padStart(3, "0");
}

function buildScenarioList(): ScenarioId[] {
  const scenarios: ScenarioId[] = [];
  (Object.entries(SCENARIO_COUNTS) as [ScenarioId, number][]).forEach(
    ([scenarioId, count]) => {
      for (let i = 0; i < count; i += 1) {
        scenarios.push(scenarioId);
      }
    },
  );
  return scenarios;
}

function groundTruthFor(
  scenarioId: ScenarioId,
  amountPaise: number,
): GroundTruth {
  switch (scenarioId) {
    case "TEMPORARY_ISSUER_FAILURE":
      return {
        scenarioId,
        recoverable: true,
        optimalAction: "RETRY_PAYMENT",
        expectedRecoveryPaise: amountPaise,
        reason: "Temporary issuer failure is recoverable with an immediate retry.",
      };
    case "NETWORK_TIMEOUT":
      return {
        scenarioId,
        recoverable: true,
        optimalAction: "RETRY_PAYMENT",
        expectedRecoveryPaise: amountPaise,
        reason: "Network timeout is recoverable with a bounded retry.",
      };
    case "INSUFFICIENT_FUNDS":
      return {
        scenarioId,
        recoverable: true,
        optimalAction: "WAIT_AND_RETRY",
        expectedRecoveryPaise: amountPaise,
        reason: "Insufficient funds may clear after a wait; immediate retry should fail.",
      };
    case "CARD_EXPIRED":
      return {
        scenarioId,
        recoverable: false,
        optimalAction: "REQUEST_PAYMENT_METHOD_UPDATE",
        expectedRecoveryPaise: 0,
        reason: "Expired credentials cannot be recovered by retrying the same method.",
      };
    case "HARD_DECLINE":
      return {
        scenarioId,
        recoverable: false,
        optimalAction: "DO_NOTHING",
        expectedRecoveryPaise: 0,
        reason: "Hard declines are permanent for this payment instrument.",
      };
    case "RETRY_LIMIT_EXCEEDED":
      return {
        scenarioId,
        recoverable: false,
        optimalAction: "DO_NOTHING",
        expectedRecoveryPaise: 0,
        reason: "Retry limit is already exhausted; further retries must be blocked.",
      };
    case "DUPLICATE_PAYMENT":
      return {
        scenarioId,
        recoverable: false,
        optimalAction: "DO_NOTHING",
        expectedRecoveryPaise: 0,
        reason: "Retrying risks a duplicate capture and must be prevented.",
      };
    case "HIGH_VALUE_ESCALATION":
      return {
        scenarioId,
        recoverable: true,
        optimalAction: "ESCALATE",
        expectedRecoveryPaise: amountPaise,
        reason: "Amount exceeds the automation cap; a human must authorize recovery.",
      };
    case "AMBIGUOUS_LOW_CONFIDENCE":
      return {
        scenarioId,
        recoverable: false,
        optimalAction: "ESCALATE",
        expectedRecoveryPaise: 0,
        reason: "Failure cause is ambiguous; automated retry is not justified.",
      };
    default: {
      const exhaustive: never = scenarioId;
      throw new Error(`Unhandled scenario: ${exhaustive}`);
    }
  }
}

function failureTypeFor(scenarioId: ScenarioId): FailureType {
  switch (scenarioId) {
    case "HIGH_VALUE_ESCALATION":
      return "TEMPORARY_ISSUER_FAILURE";
    case "AMBIGUOUS_LOW_CONFIDENCE":
      return "UNKNOWN_FAILURE";
    default:
      return scenarioId;
  }
}

function amountFor(scenarioId: ScenarioId, random: ReturnType<typeof createSeededRandom>): number {
  if (scenarioId === "HIGH_VALUE_ESCALATION") {
    return random.intInclusive(AUTOMATION_AMOUNT_CAP_PAISE + 100, 25_000_000);
  }
  return random.pick(STANDARD_AMOUNTS_PAISE);
}

function customerContext(
  random: ReturnType<typeof createSeededRandom>,
  createdAtMs: number,
): CustomerContext {
  const previousSuccessfulPayments = random.intInclusive(0, 18);
  const previousFailedPayments = random.intInclusive(0, 6);
  const previousRecoveryCount = random.intInclusive(
    0,
    Math.min(4, previousFailedPayments),
  );

  return {
    segment: random.pick(["consumer", "smb", "enterprise"] as const),
    previousSuccessfulPayments,
    previousFailedPayments,
    lifetimeValuePaise: previousSuccessfulPayments * random.pick(STANDARD_AMOUNTS_PAISE),
    previousRecoveryCount,
    lastPaymentAt: new Date(createdAtMs - random.intInclusive(1, 21) * 86_400_000).toISOString(),
  };
}

export function generateDataset(seed: number = DEFAULT_SEED): Transaction[] {
  const random = createSeededRandom(seed);
  const scenarios = shuffleInPlace(buildScenarioList(), random);

  if (scenarios.length !== DATASET_SIZE) {
    throw new Error(`Expected ${DATASET_SIZE} scenarios, got ${scenarios.length}`);
  }

  return scenarios.map((scenarioId, index) => {
    const sequence = index + 1;
    const createdAtMs = BASE_CREATED_AT_MS + index * 60_000;
    const amountPaise = amountFor(scenarioId, random);
    const retryLimitExceeded = scenarioId === "RETRY_LIMIT_EXCEEDED";

    const transaction: Transaction = {
      id: `txn_${padId(sequence)}`,
      merchantId: MERCHANT_ID,
      customerId: `cust_${padId(random.intInclusive(1, 40))}`,
      amountPaise,
      currency: "INR",
      paymentMethod: random.pick(PAYMENT_METHODS),
      status: "failed",
      failureType: failureTypeFor(scenarioId),
      retryCount: retryLimitExceeded ? DEFAULT_MAX_RETRIES : 0,
      maxRetries: DEFAULT_MAX_RETRIES,
      createdAt: new Date(createdAtMs).toISOString(),
      lastAttemptAt: new Date(createdAtMs + random.intInclusive(30, 300) * 1000).toISOString(),
      customer: customerContext(random, createdAtMs),
      groundTruth: groundTruthFor(scenarioId, amountPaise),
    };

    return transaction;
  });
}

export function countByScenario(transactions: Transaction[]): Record<ScenarioId, number> {
  const counts = { ...SCENARIO_COUNTS };
  (Object.keys(counts) as ScenarioId[]).forEach((key) => {
    counts[key] = 0;
  });
  for (const transaction of transactions) {
    counts[transaction.groundTruth.scenarioId] += 1;
  }
  return counts;
}
