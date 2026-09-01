import test from "node:test";
import assert from "node:assert/strict";
import { validateAIDecision } from "./ai-schema";
import { AIService } from "./ai-service";
import type { AITransactionContext } from "./ai-types";

test("AI schema validation: accepts valid structured decision", () => {
  const validPayload = {
    recommendedAction: "WAIT_AND_RETRY",
    confidence: 0.88,
    recoveryProbability: 0.76,
    riskScore: "LOW",
    reason: "Temporary issuer failure with remaining retry capacity.",
    keyFactors: ["Temporary issuer decline", "No duplicate risk", "Retry capacity available"],
  };

  const res = validateAIDecision(validPayload);
  assert.equal(res.valid, true);
  assert.equal(res.decision?.recommendedAction, "WAIT_AND_RETRY");
  assert.equal(res.decision?.confidence, 0.88);
  assert.equal(res.decision?.recoveryProbability, 0.76);
  assert.equal(res.decision?.riskScore, "LOW");
  assert.equal(res.decision?.keyFactors.length, 3);
});

test("AI schema validation: rejects invalid action", () => {
  const invalidPayload = {
    recommendedAction: "MAGIC_INSTANT_REFUND",
    confidence: 0.9,
    recoveryProbability: 0.8,
    riskScore: "LOW",
    reason: "Test",
    keyFactors: ["Fact 1"],
  };

  const res = validateAIDecision(invalidPayload);
  assert.equal(res.valid, false);
  assert.match(res.error || "", /Invalid recommendedAction/);
});

test("AI schema validation: rejects confidence out of bounds", () => {
  const invalidPayload = {
    recommendedAction: "RETRY_PAYMENT",
    confidence: 1.5,
    recoveryProbability: 0.8,
    riskScore: "LOW",
    reason: "Test",
    keyFactors: ["Fact 1"],
  };

  const res = validateAIDecision(invalidPayload);
  assert.equal(res.valid, false);
  assert.match(res.error || "", /Invalid confidence/);
});

test("AI schema validation: rejects recoveryProbability out of bounds", () => {
  const invalidPayload = {
    recommendedAction: "RETRY_PAYMENT",
    confidence: 0.8,
    recoveryProbability: -0.2,
    riskScore: "LOW",
    reason: "Test",
    keyFactors: ["Fact 1"],
  };

  const res = validateAIDecision(invalidPayload);
  assert.equal(res.valid, false);
  assert.match(res.error || "", /Invalid recoveryProbability/);
});

test("AI schema validation: rejects invalid risk score", () => {
  const invalidPayload = {
    recommendedAction: "RETRY_PAYMENT",
    confidence: 0.8,
    recoveryProbability: 0.7,
    riskScore: "CRITICAL_DANGER",
    reason: "Test",
    keyFactors: ["Fact 1"],
  };

  const res = validateAIDecision(invalidPayload);
  assert.equal(res.valid, false);
  assert.match(res.error || "", /Invalid riskScore/);
});

test("AI service fallback: returns safe unavailable response when API key is missing", async () => {
  const service = new AIService();
  const context: AITransactionContext = {
    transaction: {
      id: "txn_001",
      amountPaise: 49900,
      currency: "INR",
      paymentMethod: "UPI",
      failureType: "TEMPORARY_ISSUER_FAILURE",
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
    },
    reviveContext: {
      ruleRecommendation: "RETRY_PAYMENT",
      policyAllowed: true,
      policyReason: "Allowed",
      isHighValue: false,
      isDuplicateRisk: false,
      isRetryExhausted: false,
    },
  };

  // If no API key is set in environment, should return available: false gracefully
  if (!service.isConfigured()) {
    const res = await service.analyzeTransaction(context);
    assert.equal(res.available, false);
    assert.match(res.error || "", /not configured|unavailable/i);
  }
});
