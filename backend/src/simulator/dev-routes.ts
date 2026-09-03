import type { Express } from "express";

import { baselineStrategy } from "./baseline";
import { DEFAULT_SEED } from "./constants";
import {
  evaluateResults,
  evaluateStrategy,
  incrementalRecoveryPaise,
} from "./evaluate";
import { generateDataset } from "./generate-dataset";
import { simulateRecoveryAction } from "./payment-simulator";
import { toPublicTransaction } from "./public-transaction";
import type { PublicTransaction } from "./types";
import { reviveStrategy } from "../recovery/revive-strategy";

export function registerSimulatorDevRoutes(app: Express): void {
  app.get("/simulator/transactions", (req, res) => {
    const rawSeed = req.query.seed;
    const seed =
      typeof rawSeed === "string" && rawSeed.length > 0
        ? Number(rawSeed)
        : DEFAULT_SEED;

    if (!Number.isInteger(seed)) {
      res.status(400).json({
        error: "seed must be an integer",
      });
      return;
    }

    const transactions = generateDataset(seed);

    res.status(200).json({
      seed,
      transactions: transactions.map(toPublicTransaction),
    });
  });

  app.get("/simulator/baseline-evaluation", (req, res) => {
    const rawSeed = req.query.seed;
    const seed =
      typeof rawSeed === "string" && rawSeed.length > 0
        ? Number(rawSeed)
        : DEFAULT_SEED;

    if (!Number.isInteger(seed)) {
      res.status(400).json({
        error: "seed must be an integer",
      });
      return;
    }

    const transactions = generateDataset(seed);

    const { metrics } = evaluateStrategy(
      transactions,
      baselineStrategy,
    );

    const sample = transactions[0];

    res.status(200).json({
      seed,
      metrics,
      samplePublicTransaction: sample
        ? toPublicTransaction(sample)
        : null,
    });
  });

  app.get("/simulator/revive-evaluation", (req, res) => {
    const rawSeed = req.query.seed;
    const seed =
      typeof rawSeed === "string" && rawSeed.length > 0
        ? Number(rawSeed)
        : DEFAULT_SEED;

    if (!Number.isInteger(seed)) {
      res.status(400).json({
        error: "seed must be an integer",
      });
      return;
    }

    const transactions = generateDataset(seed);

    const baseline = evaluateStrategy(
      transactions,
      baselineStrategy,
    );

    const revive = evaluateStrategy(
      transactions,
      reviveStrategy,
    );

    const incrementalRevenueRecoveredPaise =
      incrementalRecoveryPaise(
        revive.metrics,
        baseline.metrics,
      );

    const sample = transactions[0];

    res.status(200).json({
      seed,
      baseline: baseline.metrics,
      revive: revive.metrics,
      comparison: {
        incrementalRecoveryPaise:
          incrementalRevenueRecoveredPaise,

        incrementalRecoveryRate:
          revive.metrics.recoveryRate -
          baseline.metrics.recoveryRate,

        additionalSuccessfulInterventions:
          revive.metrics.successfulInterventions -
          baseline.metrics.successfulInterventions,
      },

      samplePublicTransaction: sample
        ? toPublicTransaction(sample)
        : null,
    });
  });

  app.get("/simulator/experiment", (req, res) => {
    try {
      const rawSeed = req.query.seed;
      const rawSampleSize = req.query.sampleSize;
      const seed =
        typeof rawSeed === "string" && rawSeed.length > 0
          ? Number(rawSeed)
          : DEFAULT_SEED;

      if (!Number.isInteger(seed)) {
        res.status(400).json({ error: "seed must be an integer" });
        return;
      }

      const allTransactions = generateDataset(seed);
      const sampleSize =
        typeof rawSampleSize === "string" && rawSampleSize.length > 0
          ? Math.min(Math.max(1, Number(rawSampleSize)), allTransactions.length)
          : allTransactions.length;

      const sample = allTransactions.slice(0, sampleSize);

      const baseline = evaluateStrategy(sample, baselineStrategy);
      const revive = evaluateStrategy(sample, reviveStrategy);

      const incrementalRevenueRecoveredPaise = incrementalRecoveryPaise(
        revive.metrics,
        baseline.metrics,
      );

      res.status(200).json({
        seed,
        sampleSize: sample.length,
        transactionIds: sample.map((t) => t.id),
        baseline: baseline.metrics,
        revive: revive.metrics,
        comparison: {
          incrementalRecoveryPaise: incrementalRevenueRecoveredPaise,
          incrementalRecoveryRate:
            revive.metrics.recoveryRate - baseline.metrics.recoveryRate,
          additionalSuccessfulInterventions:
            revive.metrics.successfulInterventions -
            baseline.metrics.successfulInterventions,
        },
        baselineResults: baseline.results,
        reviveResults: revive.results,
        transactions: sample.map(toPublicTransaction),
        datasetSource: "generated",
      });
    } catch (error: unknown) {
      console.error("[DevRoutes] GET /simulator/experiment failed:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Experiment evaluation failed",
      });
    }
  });

  app.post("/simulator/experiment", (req, res) => {
    try {
      const rawTransactions = req.body?.transactions;
      if (!Array.isArray(rawTransactions) || rawTransactions.length === 0) {
        res.status(400).json({ error: "transactions array is required and must not be empty" });
        return;
      }

      const publicTransactions = rawTransactions as PublicTransaction[];
      const baselineResults = publicTransactions.map((t) => {
        const action = baselineStrategy(t);
        return simulateRecoveryAction(t, action);
      });

      const reviveResults = publicTransactions.map((t) => {
        const action = reviveStrategy(t);
        return simulateRecoveryAction(t, action);
      });

      const baselineMetrics = evaluateResults(publicTransactions as any, baselineResults);
      const reviveMetrics = evaluateResults(publicTransactions as any, reviveResults);

      const incrementalRevenueRecoveredPaise = incrementalRecoveryPaise(
        reviveMetrics,
        baselineMetrics,
      );

      res.status(200).json({
        seed: null,
        sampleSize: publicTransactions.length,
        transactionIds: publicTransactions.map((t) => t.id),
        baseline: baselineMetrics,
        revive: reviveMetrics,
        comparison: {
          incrementalRecoveryPaise: incrementalRevenueRecoveredPaise,
          incrementalRecoveryRate:
            reviveMetrics.recoveryRate - baselineMetrics.recoveryRate,
          additionalSuccessfulInterventions:
            reviveMetrics.successfulInterventions -
            baselineMetrics.successfulInterventions,
        },
        baselineResults,
        reviveResults,
        transactions: publicTransactions,
        datasetSource: "imported",
      });
    } catch (error: unknown) {
      console.error("[DevRoutes] POST /simulator/experiment failed:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Imported experiment evaluation failed",
      });
    }
  });
}