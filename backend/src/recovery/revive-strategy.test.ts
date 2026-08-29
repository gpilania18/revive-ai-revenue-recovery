import assert from "node:assert/strict";
import test from "node:test";

import { reviveStrategy } from "./revive-strategy";
import type { PublicTransaction } from "../simulator/types";

function makeTransaction(
  overrides: Partial<PublicTransaction> = {},
): PublicTransaction {
  return {
    id: "txn_test",
    merchantId: "merchant_test",
    customerId: "customer_test",
    amountPaise: 49_900,
    currency: "INR",
    paymentMethod: "CARD",
    status: "failed",
    failureType: "TEMPORARY_ISSUER_FAILURE",
    retryCount: 0,
    maxRetries: 3,
    createdAt: "2026-08-01T00:00:00.000Z",
    lastAttemptAt: "2026-08-01T00:01:00.000Z",
    customer: {
      segment: "consumer",
      previousSuccessfulPayments: 5,
      previousFailedPayments: 1,
      lifetimeValuePaise: 249_500,
      previousRecoveryCount: 0,
      lastPaymentAt: "2026-07-31T00:00:00.000Z",
    },
    ...overrides,
  };
}

test("Revive retries temporary issuer failures", () => {
  assert.equal(
    reviveStrategy(
      makeTransaction({
        failureType: "TEMPORARY_ISSUER_FAILURE",
      }),
    ),
    "RETRY_PAYMENT",
  );
});

test("Revive retries network timeouts", () => {
  assert.equal(
    reviveStrategy(
      makeTransaction({
        failureType: "NETWORK_TIMEOUT",
      }),
    ),
    "RETRY_PAYMENT",
  );
});

test("Revive waits before retrying insufficient funds", () => {
  assert.equal(
    reviveStrategy(
      makeTransaction({
        failureType: "INSUFFICIENT_FUNDS",
      }),
    ),
    "WAIT_AND_RETRY",
  );
});

test("Revive requests payment method update for expired cards", () => {
  assert.equal(
    reviveStrategy(
      makeTransaction({
        failureType: "CARD_EXPIRED",
      }),
    ),
    "REQUEST_PAYMENT_METHOD_UPDATE",
  );
});

test("Revive does not retry hard declines", () => {
  assert.equal(
    reviveStrategy(
      makeTransaction({
        failureType: "HARD_DECLINE",
      }),
    ),
    "DO_NOTHING",
  );
});

test("Revive does not retry duplicate payments", () => {
  assert.equal(
    reviveStrategy(
      makeTransaction({
        failureType: "DUPLICATE_PAYMENT",
      }),
    ),
    "DO_NOTHING",
  );
});

test("Revive does not retry exhausted transactions", () => {
  assert.equal(
    reviveStrategy(
      makeTransaction({
        retryCount: 3,
        maxRetries: 3,
      }),
    ),
    "DO_NOTHING",
  );
});

test("Revive escalates high-value transactions", () => {
  assert.equal(
    reviveStrategy(
      makeTransaction({
        amountPaise: 1_000_001,
        failureType: "TEMPORARY_ISSUER_FAILURE",
      }),
    ),
    "ESCALATE",
  );
});

test("Revive escalates unknown failures", () => {
  assert.equal(
    reviveStrategy(
      makeTransaction({
        failureType: "UNKNOWN_FAILURE",
      }),
    ),
    "ESCALATE",
  );
});

test("Revive does nothing for already captured transactions", () => {
  assert.equal(
    reviveStrategy(
      makeTransaction({
        status: "captured",
      }),
    ),
    "DO_NOTHING",
  );
});
