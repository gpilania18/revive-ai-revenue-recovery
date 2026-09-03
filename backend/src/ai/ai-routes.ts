import type { Express } from "express";
import { aiService } from "./ai-service";
import type { AITransactionContext } from "./ai-types";
import { generateDataset } from "../simulator/generate-dataset";
import { DEFAULT_SEED } from "../simulator/constants";
import { toPublicTransaction } from "../simulator/public-transaction";
import { reviveStrategy } from "../recovery/revive-strategy";
import { evaluateRecoveryPolicy } from "../recovery/recovery-policy";
import type { PublicTransaction } from "../simulator/types";

export function registerAIRoutes(app: Express): void {
  app.post("/ai/analyze", async (req, res) => {
    try {
      const { transactionId, transaction: payloadTxn } = req.body || {};

      if (!transactionId && !payloadTxn) {
        res.status(400).json({
          status: "error",
          available: false,
          error: "transactionId or transaction object is required.",
          evaluatedAt: new Date().toISOString(),
        });
        return;
      }

      let txn: PublicTransaction | undefined = payloadTxn;

      if (!txn && transactionId) {
        // Look up in simulator dataset
        const dataset = generateDataset(DEFAULT_SEED);
        const internalTxn = dataset.find((t) => t.id.toLowerCase() === String(transactionId).trim().toLowerCase());
        if (internalTxn) {
          txn = toPublicTransaction(internalTxn);
        }
      }

      if (!txn) {
        res.status(404).json({
          status: "error",
          available: false,
          error: `Transaction "${transactionId}" not found in dataset.`,
          evaluatedAt: new Date().toISOString(),
        });
        return;
      }

      // Gather deterministic REVIVE recommendation & policy checks
      const ruleRecommendation = reviveStrategy(txn);
      const policyDecision = evaluateRecoveryPolicy(txn, ruleRecommendation);
      const isHighValue = txn.amountPaise > 5_000_000;
      const isDuplicateRisk = txn.failureType === "DUPLICATE_PAYMENT";
      const isRetryExhausted = txn.retryCount >= txn.maxRetries;
      const isUnknown = txn.failureType === "UNKNOWN_FAILURE";
      const requiresHumanReview = isHighValue || !policyDecision.allowed || isUnknown || isDuplicateRisk || ruleRecommendation === "ESCALATE";

      const context: AITransactionContext = {
        transaction: {
          id: txn.id,
          amountPaise: txn.amountPaise,
          currency: txn.currency,
          paymentMethod: txn.paymentMethod,
          failureType: txn.failureType,
          retryCount: txn.retryCount,
          maxRetries: txn.maxRetries,
          createdAt: txn.createdAt,
          customer: txn.customer
            ? {
                segment: txn.customer.segment,
                previousSuccessfulPayments: txn.customer.previousSuccessfulPayments,
                previousFailedPayments: txn.customer.previousFailedPayments,
                lifetimeValuePaise: txn.customer.lifetimeValuePaise,
              }
            : undefined,
        },
        reviveContext: {
          ruleRecommendation,
          policyAllowed: policyDecision.allowed,
          policyReason: policyDecision.reason,
          isHighValue,
          isDuplicateRisk,
          isRetryExhausted,
          requiresHumanReview,
        },
      };

      const result = await aiService.analyzeTransaction(context);

      res.status(200).json({
        status: "ok",
        available: result.available,
        decision: result.decision,
        analysis: result.decision,
        error: result.error,
        source: result.source,
        evaluatedAt: result.evaluatedAt,
      });
    } catch (error: unknown) {
      console.error("[AIRoutes] /ai/analyze failed:", error);
      res.status(500).json({
        status: "error",
        available: false,
        error: error instanceof Error ? error.message : "Internal error during AI analysis",
        evaluatedAt: new Date().toISOString(),
      });
    }
  });
}
