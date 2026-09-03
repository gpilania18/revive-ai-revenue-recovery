import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { baselineStrategy } from "./baseline";
import {
  AUTOMATION_AMOUNT_CAP_PAISE,
  DATASET_SIZE,
  DEFAULT_SEED,
  SCENARIO_COUNTS,
} from "./constants";
import {
  evaluateResults,
  evaluateStrategy,
  incrementalRecoveryPaise,
} from "./evaluate";
import { countByScenario, generateDataset } from "./generate-dataset";
import { simulateRecoveryAction } from "./payment-simulator";
import { toPublicTransaction } from "./public-transaction";
import type { PublicTransaction, RecoveryActionType, Transaction } from "./types";

function assertIntegerPaise(value: number, label: string): void {
  assert.equal(typeof value, "number", label);
  assert.ok(Number.isInteger(value), `${label} must be an integer`);
  assert.ok(value >= 0, `${label} must be non-negative`);
}

describe("dataset generation", () => {
  it("is deterministic for the same seed", () => {
    const first = generateDataset(DEFAULT_SEED);
    const second = generateDataset(DEFAULT_SEED);
    assert.deepEqual(first, second);
  });

  it("differs when the seed differs", () => {
    const first = generateDataset(DEFAULT_SEED);
    const second = generateDataset(DEFAULT_SEED + 1);
    assert.notDeepEqual(first, second);
  });

  it("generates exactly 200 transactions", () => {
    assert.equal(generateDataset(DEFAULT_SEED).length, DATASET_SIZE);
    assert.equal(DATASET_SIZE, 200);
  });

  it("matches the required scenario distribution", () => {
    const counts = countByScenario(generateDataset(DEFAULT_SEED));
    assert.deepEqual(counts, SCENARIO_COUNTS);

    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    assert.equal(total, 200);
  });

  it("represents all money fields as integer paise", () => {
    for (const transaction of generateDataset(DEFAULT_SEED)) {
      assertIntegerPaise(transaction.amountPaise, "amountPaise");
      assertIntegerPaise(transaction.customer.lifetimeValuePaise, "lifetimeValuePaise");
      assertIntegerPaise(
        transaction.groundTruth.expectedRecoveryPaise,
        "expectedRecoveryPaise",
      );
      assert.equal(transaction.currency, "INR");
    }
  });
});

describe("ground-truth separation", () => {
  it("omits groundTruth from the public transaction view", () => {
    const transaction = generateDataset(DEFAULT_SEED)[0] as Transaction;
    const publicTransaction = toPublicTransaction(transaction);

    assert.equal("groundTruth" in publicTransaction, false);
    assert.equal(JSON.stringify(publicTransaction).includes("groundTruth"), false);
    assert.equal(JSON.stringify(publicTransaction).includes("optimalAction"), false);
    assert.ok(transaction.groundTruth);
  });

  it("does not pass groundTruth into the baseline strategy", () => {
    const transaction = generateDataset(DEFAULT_SEED)[0] as Transaction;
    let observed: PublicTransaction | undefined;

    const wrapped = (input: PublicTransaction): RecoveryActionType => {
      observed = input;
      assert.equal("groundTruth" in input, false);
      return baselineStrategy(input);
    };

    wrapped(toPublicTransaction(transaction));
    assert.ok(observed);
    assert.equal("groundTruth" in (observed as object), false);
  });
});

describe("baseline behavior", () => {
  it("retries once only for retryable failures with retryCount 0", () => {
    const retryable: PublicTransaction = {
      id: "txn_test_retryable",
      merchantId: "merchant_revive_demo",
      customerId: "cust_001",
      amountPaise: 99_900,
      currency: "INR",
      paymentMethod: "UPI",
      status: "failed",
      failureType: "NETWORK_TIMEOUT",
      retryCount: 0,
      maxRetries: 3,
      createdAt: "2026-08-01T00:00:00.000Z",
      lastAttemptAt: "2026-08-01T00:01:00.000Z",
      customer: {
        segment: "consumer",
        previousSuccessfulPayments: 2,
        previousFailedPayments: 1,
        lifetimeValuePaise: 199_800,
        previousRecoveryCount: 0,
        lastPaymentAt: "2026-07-01T00:00:00.000Z",
      },
    };

    assert.equal(baselineStrategy(retryable), "RETRY_PAYMENT");
    assert.equal(baselineStrategy({ ...retryable, retryCount: 1 }), "DO_NOTHING");
    assert.equal(
      baselineStrategy({ ...retryable, failureType: "HARD_DECLINE" }),
      "DO_NOTHING",
    );
    assert.equal(
      baselineStrategy({ ...retryable, failureType: "CARD_EXPIRED" }),
      "DO_NOTHING",
    );
    assert.equal(
      baselineStrategy({ ...retryable, failureType: "UNKNOWN_FAILURE" }),
      "DO_NOTHING",
    );
  });
});

describe("retry limits and duplicate prevention", () => {
  it("blocks retries when the retry limit is exhausted", () => {
    const dataset = generateDataset(DEFAULT_SEED);
    const exhausted = dataset.find(
      (transaction) => transaction.groundTruth.scenarioId === "RETRY_LIMIT_EXCEEDED",
    );

    assert.ok(exhausted);
    assert.ok(exhausted.retryCount >= exhausted.maxRetries);

    const blocked = simulateRecoveryAction(toPublicTransaction(exhausted), "RETRY_PAYMENT");
    assert.equal(blocked.outcome, "blocked");
    assert.equal(blocked.recoveredPaise, 0);

    assert.equal(baselineStrategy(toPublicTransaction(exhausted)), "DO_NOTHING");
  });

  it("prevents duplicate payment recovery attempts", () => {
    const dataset = generateDataset(DEFAULT_SEED);
    const duplicate = dataset.find(
      (transaction) => transaction.groundTruth.scenarioId === "DUPLICATE_PAYMENT",
    );
    const recoverable = dataset.find(
      (transaction) => transaction.groundTruth.scenarioId === "TEMPORARY_ISSUER_FAILURE",
    );

    assert.ok(duplicate);
    assert.ok(recoverable);

    const duplicateAttempt = simulateRecoveryAction(
      toPublicTransaction(duplicate),
      "RETRY_PAYMENT",
    );
    assert.equal(duplicateAttempt.outcome, "duplicate_prevented");
    assert.equal(duplicateAttempt.recoveredPaise, 0);

    const first = simulateRecoveryAction(toPublicTransaction(recoverable), "RETRY_PAYMENT");
    const second = simulateRecoveryAction(toPublicTransaction(recoverable), "RETRY_PAYMENT", [
      "RETRY_PAYMENT",
    ]);
    assert.equal(first.outcome, "success");
    assert.equal(second.outcome, "duplicate_prevented");
    assert.equal(second.recoveredPaise, 0);
  });

  it("does not count recovered revenue twice for the same transaction and action", () => {
    const recoverable = generateDataset(DEFAULT_SEED).find(
      (transaction) => transaction.groundTruth.scenarioId === "TEMPORARY_ISSUER_FAILURE",
    );
    assert.ok(recoverable);

    const publicTransaction = toPublicTransaction(recoverable);
    const action: RecoveryActionType = "RETRY_PAYMENT";

    const first = simulateRecoveryAction(publicTransaction, action);
    assert.equal(first.outcome, "success");
    assert.equal(first.recoveredPaise, recoverable.amountPaise);
    assert.ok(first.recoveredPaise > 0);

    const second = simulateRecoveryAction(publicTransaction, action, [action]);
    assert.equal(second.outcome, "duplicate_prevented");
    assert.equal(second.recoveredPaise, 0);
    assert.equal(
      first.recoveredPaise + second.recoveredPaise,
      first.recoveredPaise,
      "recovered revenue must not be counted twice",
    );
  });

  it("does not recover permanent failures via retry", () => {
    const dataset = generateDataset(DEFAULT_SEED);
    const hardDecline = dataset.find(
      (transaction) => transaction.groundTruth.scenarioId === "HARD_DECLINE",
    );
    assert.ok(hardDecline);

    const result = simulateRecoveryAction(toPublicTransaction(hardDecline), "RETRY_PAYMENT");
    assert.equal(result.outcome, "failure");
    assert.equal(result.recoveredPaise, 0);
  });
});

describe("evaluation calculations", () => {
  it("computes revenue, recovery rate, and intervention counts from results", () => {
    const transactions = generateDataset(DEFAULT_SEED);
    const { metrics, results } = evaluateStrategy(transactions, baselineStrategy);

    const expectedAtRisk = transactions.reduce(
      (sum, transaction) => sum + transaction.amountPaise,
      0,
    );
    const expectedRecovered = results.reduce((sum, result) => sum + result.recoveredPaise, 0);
    const expectedSuccess = results.filter((result) => result.outcome === "success").length;
    const expectedBlocked = results.filter((result) => result.outcome === "blocked").length;
    const expectedEscalated = results.filter((result) => result.outcome === "escalated").length;
    const expectedDuplicates = results.filter(
      (result) => result.outcome === "duplicate_prevented",
    ).length;

    assert.equal(metrics.transactionCount, 200);
    assert.equal(metrics.totalRevenueAtRiskPaise, expectedAtRisk);
    assert.equal(metrics.revenueRecoveredPaise, expectedRecovered);
    assert.equal(metrics.successfulInterventions, expectedSuccess);
    assert.equal(metrics.blockedActions, expectedBlocked);
    assert.equal(metrics.escalationCount, expectedEscalated);
    assert.equal(metrics.duplicatePreventionCount, expectedDuplicates);
    assert.equal(metrics.recoveryRate, expectedRecovered / expectedAtRisk);
    assertIntegerPaise(metrics.totalRevenueAtRiskPaise, "totalRevenueAtRiskPaise");
    assertIntegerPaise(metrics.revenueRecoveredPaise, "revenueRecoveredPaise");

    const highValueCount = transactions.filter(
      (transaction) => transaction.groundTruth.scenarioId === "HIGH_VALUE_ESCALATION",
    ).length;
    assert.equal(metrics.blockedActions, highValueCount);
    assert.equal(metrics.escalationCount, 0);
  });

  it("calculates incremental recovery between two strategies", () => {
    const transactions = generateDataset(DEFAULT_SEED);
    const baseline = evaluateStrategy(transactions, baselineStrategy).metrics;

    const waitOnInsufficient = evaluateStrategy(transactions, (transaction) => {
      if (transaction.failureType === "INSUFFICIENT_FUNDS" && transaction.retryCount === 0) {
        return "WAIT_AND_RETRY";
      }
      return baselineStrategy(transaction);
    }).metrics;

    const incremental = incrementalRecoveryPaise(waitOnInsufficient, baseline);
    assert.equal(
      incremental,
      waitOnInsufficient.revenueRecoveredPaise - baseline.revenueRecoveredPaise,
    );
    assert.ok(incremental > 0);
  });

  it("does not invent recovery when results are empty", () => {
    const transactions = generateDataset(DEFAULT_SEED).slice(0, 3);
    const metrics = evaluateResults(transactions, []);
    assert.equal(metrics.revenueRecoveredPaise, 0);
    assert.equal(metrics.successfulInterventions, 0);
    assert.equal(
      metrics.totalRevenueAtRiskPaise,
      transactions.reduce((sum, transaction) => sum + transaction.amountPaise, 0),
    );
  });

  it("blocks high-value automated retries rather than forcing success", () => {
    const highValue = generateDataset(DEFAULT_SEED).find(
      (transaction) => transaction.groundTruth.scenarioId === "HIGH_VALUE_ESCALATION",
    );
    assert.ok(highValue);
    assert.ok(highValue.amountPaise > AUTOMATION_AMOUNT_CAP_PAISE);

    const result = simulateRecoveryAction(toPublicTransaction(highValue), "RETRY_PAYMENT");
    assert.equal(result.outcome, "blocked");
    assert.equal(result.recoveredPaise, 0);
  });

  it("evaluates custom imported transactions deterministically", () => {
    const now = "2026-08-01T00:00:00.000Z";
    const imported: PublicTransaction[] = [
      {
        id: "txn_201",
        merchantId: "merchant_test",
        customerId: "cust_001",
        amountPaise: 49900,
        currency: "INR",
        paymentMethod: "UPI",
        status: "failed",
        failureType: "TEMPORARY_ISSUER_FAILURE",
        retryCount: 0,
        maxRetries: 3,
        createdAt: now,
        lastAttemptAt: now,
        customer: {
          segment: "consumer",
          previousSuccessfulPayments: 2,
          previousFailedPayments: 1,
          lifetimeValuePaise: 99800,
          previousRecoveryCount: 0,
          lastPaymentAt: now,
        },
      },
      {
        id: "txn_206",
        merchantId: "merchant_test",
        customerId: "cust_006",
        amountPaise: 7500000,
        currency: "INR",
        paymentMethod: "UPI",
        status: "failed",
        failureType: "TEMPORARY_ISSUER_FAILURE",
        retryCount: 0,
        maxRetries: 3,
        createdAt: now,
        lastAttemptAt: now,
        customer: {
          segment: "enterprise",
          previousSuccessfulPayments: 10,
          previousFailedPayments: 0,
          lifetimeValuePaise: 150000000,
          previousRecoveryCount: 1,
          lastPaymentAt: now,
        },
      },
      {
        id: "txn_207",
        merchantId: "merchant_test",
        customerId: "cust_007",
        amountPaise: 49900,
        currency: "INR",
        paymentMethod: "UPI",
        status: "failed",
        failureType: "DUPLICATE_PAYMENT",
        retryCount: 0,
        maxRetries: 3,
        createdAt: now,
        lastAttemptAt: now,
        customer: {
          segment: "consumer",
          previousSuccessfulPayments: 1,
          previousFailedPayments: 1,
          lifetimeValuePaise: 49900,
          previousRecoveryCount: 0,
          lastPaymentAt: now,
        },
      },
    ];

    const baselineResults = imported.map((t) => simulateRecoveryAction(t, baselineStrategy(t)));
    const reviveResults = imported.map((t) => {
      const action = t.amountPaise > AUTOMATION_AMOUNT_CAP_PAISE ? "ESCALATE" : (t.failureType === "DUPLICATE_PAYMENT" ? "DO_NOTHING" : "RETRY_PAYMENT");
      return simulateRecoveryAction(t, action);
    });

    const metrics = evaluateResults(imported as any, reviveResults);
    assert.equal(metrics.transactionCount, 3);
    assert.equal(metrics.revenueRecoveredPaise, 49900); // Only txn_201 recovered
    assert.equal(metrics.successfulInterventions, 1);
    assert.equal(metrics.escalationCount, 1); // txn_206 escalated
  });
});
