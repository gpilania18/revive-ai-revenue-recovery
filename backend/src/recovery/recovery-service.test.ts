import assert from "node:assert/strict";
import test from "node:test";

import type { TransactionRepository } from "../db/transaction-repository";
import type { TransactionDocument } from "../db/transactions";
import type {
  RecoveryActionType,
  SimulationOutcome,
} from "../simulator/types";
import { RecoveryService } from "./recovery-service";

function makeTransaction(
  overrides: Partial<TransactionDocument> = {},
): TransactionDocument {
  return {
    transactionId: "txn_test",
    customerId: "cust_test",
    merchantId: "merchant_test",
    amountPaise: 49_900,
    currency: "INR",
    paymentMethod: "CARD",
    status: "failed",
    failureType: "TEMPORARY_ISSUER_FAILURE",
    retryCount: 0,
    maxRetries: 3,
    priorActions: [],
    customer: {
      segment: "consumer",
      previousSuccessfulPayments: 5,
      previousFailedPayments: 1,
      lifetimeValuePaise: 249_500,
      previousRecoveryCount: 0,
      lastPaymentAt: "2026-07-31T00:00:00.000Z",
    },
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    lastAttemptAt: new Date("2026-08-01T00:01:00.000Z"),
    updatedAt: new Date("2026-08-01T00:01:00.000Z"),
    source: "SIMULATOR",
    seed: 42,
    ...overrides,
  };
}

function makeRepository(
  transaction: TransactionDocument | null,
) {
  let applied: {
    transactionId: string;
    action: RecoveryActionType;
    outcome: SimulationOutcome;
  } | null = null;

  const repository = {
    findByTransactionId: async () => transaction,
    applyRecoveryResult: async (
      transactionId: string,
      action: RecoveryActionType,
      outcome: SimulationOutcome,
    ) => {
      applied = { transactionId, action, outcome };
      return transaction;
    },
  } as unknown as TransactionRepository;

  return {
    repository,
    getApplied: () => applied,
  };
}

test("recovery service executes an allowed retry and persists success", async () => {
  const { repository, getApplied } = makeRepository(makeTransaction());

  const service = new RecoveryService(repository);

  const result = await service.recover(
    "txn_test",
    "RETRY_PAYMENT",
  );

  assert.equal(result.policy.allowed, true);
  assert.equal(result.simulation.outcome, "success");
  assert.equal(result.simulation.recoveredPaise, 49_900);

  assert.deepEqual(getApplied(), {
    transactionId: "txn_test",
    action: "RETRY_PAYMENT",
    outcome: "success",
  });
});

test("recovery service blocks unsafe retry without executing it", async () => {
  const { repository, getApplied } = makeRepository(
    makeTransaction({
      failureType: "HARD_DECLINE",
    }),
  );

  const service = new RecoveryService(repository);

  const result = await service.recover(
    "txn_test",
    "RETRY_PAYMENT",
  );

  assert.equal(result.policy.allowed, false);
  assert.equal(result.simulation.outcome, "blocked");
  assert.equal(getApplied(), null);
});

test("recovery service uses persisted prior actions for duplicate prevention", async () => {
  const { repository, getApplied } = makeRepository(
    makeTransaction({
      priorActions: ["RETRY_PAYMENT"],
    }),
  );

  const service = new RecoveryService(repository);

  const result = await service.recover(
    "txn_test",
    "RETRY_PAYMENT",
  );

  assert.equal(result.policy.allowed, true);
  assert.equal(result.simulation.outcome, "duplicate_prevented");
  assert.equal(getApplied(), null);
});

test("recovery service rejects missing transactions", async () => {
  const { repository } = makeRepository(null);

  const service = new RecoveryService(repository);

  await assert.rejects(
    () => service.recover("missing_txn", "RETRY_PAYMENT"),
    /Transaction not found/,
  );
});

test("recovery service does not expose ground truth", async () => {
  const { repository } = makeRepository(makeTransaction());

  const service = new RecoveryService(repository);

  const result = await service.recover(
    "txn_test",
    "RETRY_PAYMENT",
  );

  assert.equal(
    "groundTruth" in result.transaction,
    false,
  );
});