import test from "node:test";
import assert from "node:assert/strict";
import { validateAIDecision } from "./ai-schema";
import { AIService } from "./ai-service";
import type { AITransactionContext } from "./ai-types";

test("AI schema validation: accepts rich valid structured decision", () => {
  const validPayload = {
    recommendedAction: "WAIT_AND_RETRY",
    confidence: 0.88,
    recoveryProbability: 0.76,
    riskScore: "LOW",
    failureClassification: {
      category: "TRANSIENT",
      confidence: 0.85,
      reason: "Temporary issuer failure with remaining retry capacity.",
    },
    reason: "Temporary issuer decline with remaining retry capacity.",
    keyFactors: ["Temporary issuer decline", "No duplicate risk", "Retry capacity available"],
    expectedOutcome: {
      summary: "High likelihood of capture after a short wait window.",
      successProbability: 0.76,
    },
    humanAdvice: {
      reviewNeeded: false,
      summary: "Manual intervention is not currently required.",
      reviewTriggers: [],
    },
  };

  const res = validateAIDecision(validPayload);
  assert.equal(res.valid, true);
  assert.equal(res.decision?.recommendedAction, "WAIT_AND_RETRY");
  assert.equal(res.decision?.confidence, 0.88);
  assert.equal(res.decision?.recoveryProbability, 0.76);
  assert.equal(res.decision?.riskScore, "LOW");
  assert.equal(res.decision?.failureClassification.category, "TRANSIENT");
  assert.equal(res.decision?.failureClassification.confidence, 0.85);
  assert.equal(res.decision?.expectedOutcome.successProbability, 0.76);
  assert.equal(res.decision?.humanAdvice.reviewNeeded, false);
  assert.equal(res.decision?.keyFactors.length, 3);
});

test("AI Authority Enforcement: overrides executable action to DO_NOTHING when policyAllowed is false", () => {
  const hallucinatedPayload = {
    recommendedAction: "RETRY_PAYMENT",
    confidence: 0.9,
    recoveryProbability: 0.75,
    riskScore: "LOW",
    reason: "Attempting retry.",
    keyFactors: ["Signal 1"],
  };

  const reviveContext: AITransactionContext["reviveContext"] = {
    ruleRecommendation: "DO_NOTHING",
    policyAllowed: false,
    policyReason: "Retry limit exhausted",
    isHighValue: false,
    isDuplicateRisk: false,
    isRetryExhausted: true,
    requiresHumanReview: true,
  };

  const res = validateAIDecision(hallucinatedPayload, reviveContext);
  assert.equal(res.valid, true);
  // Code-level safety must coerce to DO_NOTHING and enforce human review
  assert.equal(res.decision?.recommendedAction, "DO_NOTHING");
  assert.equal(res.decision?.humanAdvice.reviewNeeded, true);
  assert.match(res.decision?.reason || "", /REVIVE safety policy/);
});

test("AI Authority Enforcement: overrides executable action to ESCALATE when high-value policy blocks recovery", () => {
  const hallucinatedPayload = {
    recommendedAction: "RETRY_PAYMENT",
    confidence: 0.9,
    recoveryProbability: 0.8,
    riskScore: "HIGH",
    reason: "Customer is high value.",
    keyFactors: ["Large ticket size"],
  };

  const reviveContext: AITransactionContext["reviveContext"] = {
    ruleRecommendation: "ESCALATE",
    policyAllowed: false,
    policyReason: "High-value transaction exceeds automated threshold",
    isHighValue: true,
    isDuplicateRisk: false,
    isRetryExhausted: false,
    requiresHumanReview: true,
  };

  const res = validateAIDecision(hallucinatedPayload, reviveContext);
  assert.equal(res.valid, true);
  assert.equal(res.decision?.recommendedAction, "ESCALATE");
  assert.equal(res.decision?.humanAdvice.reviewNeeded, true);
  assert.match(res.decision?.reason || "", /REVIVE safety policy/);
});

test("AI Authority Enforcement: blocks retries when duplicate risk is present", () => {
  const retryPayload = {
    recommendedAction: "RETRY_PAYMENT",
    confidence: 0.85,
    recoveryProbability: 0.6,
    riskScore: "HIGH",
    reason: "Retrying payment.",
    keyFactors: ["Duplicate flag present"],
  };

  const reviveContext: AITransactionContext["reviveContext"] = {
    ruleRecommendation: "DO_NOTHING",
    policyAllowed: false,
    policyReason: "Duplicate payment prevention",
    isHighValue: false,
    isDuplicateRisk: true,
    isRetryExhausted: false,
    requiresHumanReview: true,
  };

  const res = validateAIDecision(retryPayload, reviveContext);
  assert.equal(res.valid, true);
  assert.equal(res.decision?.recommendedAction, "DO_NOTHING");
  assert.equal(res.decision?.humanAdvice.reviewNeeded, true);
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
      requiresHumanReview: false,
    },
  };

  if (!service.isConfigured()) {
    const res = await service.analyzeTransaction(context);
    assert.equal(res.available, false);
    assert.match(res.error || "", /not configured|unavailable/i);
  }
});
