import assert from "node:assert/strict";
import test from "node:test";

import type { PublicTransaction } from "../simulator/types";
import { decideRecovery } from "./decision-service";

function makeTransaction(
  overrides: Partial<PublicTransaction> = {},
): PublicTransaction {
  return {
    id: "txn_test",
    merchantId: "merchant_test",
    customerId: "cust_test",
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

test("decision chooses retry for temporary issuer failure", () => {
  const decision = decideRecovery(makeTransaction());

  assert.equal(decision.action, "RETRY_PAYMENT");
  assert.equal(decision.allowed, true);
});

test("decision waits for insufficient funds", () => {
  const decision = decideRecovery(
    makeTransaction({
      failureType: "INSUFFICIENT_FUNDS",
    }),
  );

  assert.equal(decision.action, "WAIT_AND_RETRY");
  assert.equal(decision.allowed, true);
});

test("decision requests payment method update for expired card", () => {
  const decision = decideRecovery(
    makeTransaction({
      failureType: "CARD_EXPIRED",
    }),
  );

  assert.equal(
    decision.action,
    "REQUEST_PAYMENT_METHOD_UPDATE",
  );
  assert.equal(decision.allowed, true);
});

test("decision escalates unknown failures", () => {
  const decision = decideRecovery(
    makeTransaction({
      failureType: "UNKNOWN_FAILURE",
    }),
  );

  assert.equal(decision.action, "ESCALATE");
  assert.equal(decision.allowed, true);
});

test("decision does not retry duplicate payments", () => {
  const decision = decideRecovery(
    makeTransaction({
      failureType: "DUPLICATE_PAYMENT",
    }),
  );

  assert.equal(decision.action, "DO_NOTHING");
  assert.equal(decision.allowed, true);
});

test("decision does not recover captured transactions", () => {
  const decision = decideRecovery(
    makeTransaction({
      status: "captured",
      failureType: "TEMPORARY_ISSUER_FAILURE",
    }),
  );

  assert.equal(decision.action, "DO_NOTHING");
  assert.equal(decision.allowed, false);
});

test("decision escalates high-value transactions", () => {
  const decision = decideRecovery(
    makeTransaction({
      amountPaise: 1_500_000,
      failureType: "TEMPORARY_ISSUER_FAILURE",
    }),
  );

  assert.equal(decision.action, "ESCALATE");
  assert.equal(decision.allowed, false);
});

test("decision stops exhausted transactions", () => {
  const decision = decideRecovery(
    makeTransaction({
      retryCount: 3,
      maxRetries: 3,
      failureType: "TEMPORARY_ISSUER_FAILURE",
    }),
  );

  assert.equal(decision.action, "DO_NOTHING");
  assert.equal(decision.allowed, false);
});