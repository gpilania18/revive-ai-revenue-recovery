import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { evaluateRecoveryPolicy } from "./recovery-policy";
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
    maxRetries: 2,
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

describe("recovery policy", () => {
  it("allows retry for a temporary issuer failure", () => {
    const result = evaluateRecoveryPolicy(
      makeTransaction(),
      "RETRY_PAYMENT",
    );

    assert.equal(result.allowed, true);
    assert.equal(result.action, "RETRY_PAYMENT");
  });

  it("blocks retry when retry limit is exhausted", () => {
    const result = evaluateRecoveryPolicy(
      makeTransaction({
        retryCount: 2,
        maxRetries: 2,
      }),
      "RETRY_PAYMENT",
    );

    assert.equal(result.allowed, false);
    assert.equal(result.action, "DO_NOTHING");
  });

  it("blocks retry for expired cards", () => {
    const result = evaluateRecoveryPolicy(
      makeTransaction({
        failureType: "CARD_EXPIRED",
      }),
      "RETRY_PAYMENT",
    );

    assert.equal(result.allowed, false);
    assert.equal(result.action, "REQUEST_PAYMENT_METHOD_UPDATE");
  });

  it("blocks retry for hard declines", () => {
    const result = evaluateRecoveryPolicy(
      makeTransaction({
        failureType: "HARD_DECLINE",
      }),
      "RETRY_PAYMENT",
    );

    assert.equal(result.allowed, false);
    assert.equal(result.action, "DO_NOTHING");
  });

  it("blocks retry for duplicate payments", () => {
    const result = evaluateRecoveryPolicy(
      makeTransaction({
        failureType: "DUPLICATE_PAYMENT",
      }),
      "RETRY_PAYMENT",
    );

    assert.equal(result.allowed, false);
    assert.equal(result.action, "DO_NOTHING");
  });

  it("escalates high-value retry requests", () => {
    const result = evaluateRecoveryPolicy(
      makeTransaction({
        amountPaise: 1_000_001,
      }),
      "RETRY_PAYMENT",
    );

    assert.equal(result.allowed, false);
    assert.equal(result.action, "ESCALATE");
  });

  it("rejects recovery for non-failed transactions", () => {
    const result = evaluateRecoveryPolicy(
      makeTransaction({
        status: "captured",
      }),
      "RETRY_PAYMENT",
    );

    assert.equal(result.allowed, false);
    assert.equal(result.action, "DO_NOTHING");
  });

  it("allows payment method update for expired cards", () => {
    const result = evaluateRecoveryPolicy(
      makeTransaction({
        failureType: "CARD_EXPIRED",
      }),
      "REQUEST_PAYMENT_METHOD_UPDATE",
    );

    assert.equal(result.allowed, true);
    assert.equal(result.action, "REQUEST_PAYMENT_METHOD_UPDATE");
  });
});
